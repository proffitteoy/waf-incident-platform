-- WAF 网关执行器 (Gateway Actuator)
-- 覆盖全部动作类型 (block / challenge / rate_limit) × 作用域 (ip / uri / global)
-- Redis Key 格式与后端 action-state.ts 的 buildActiveActionKey 严格对齐

local redis = require "resty.redis"
local cjson = require "cjson"

-- ── 配置 ─────────────────────────────────────────────────────────────────────
local REDIS_HOST   = os.getenv("REDIS_HOST")               or "redis"
local REDIS_PORT   = tonumber(os.getenv("REDIS_PORT"))     or 6379
local REDIS_PREFIX = os.getenv("REDIS_KEY_PREFIX")         or "waf:mvp"

-- rate_limit 默认窗口策略（后续可从 Redis 值中读取覆盖）
local RL_WINDOW_SEC = 60   -- 时间窗口（秒）
local RL_MAX_REQ    = 30   -- 窗口内最大请求数

-- ── 工具函数 ──────────────────────────────────────────────────────────────────

-- Base64URL 编码，与 Node.js Buffer.from(str).toString('base64url') 完全兼容
local function to_base64url(str)
    if not str or str == "" then return "" end
    local b64 = ngx.encode_base64(str)
    b64 = string.gsub(b64, "+", "-")
    b64 = string.gsub(b64, "/", "_")
    b64 = string.gsub(b64, "=", "")
    return b64
end

-- 构造 active_action Redis Key（与后端 buildActiveActionKey 严格对齐）
-- 格式: <prefix>:active_action:<scope>:<action_type>:<base64url(target)>
local function build_action_key(scope, action_type, target)
    return REDIS_PREFIX .. ":active_action:" .. scope .. ":" .. action_type .. ":" .. to_base64url(target)
end

-- ── Redis 连接管理 ─────────────────────────────────────────────────────────────

local function get_redis_conn()
    local red = redis:new()
    red:set_timeout(200)
    local ok, err = red:connect(REDIS_HOST, REDIS_PORT)
    if not ok then
        return nil, err
    end
    return red, nil
end

local function release_redis_conn(red)
    if not red then return end
    local ok, err = red:set_keepalive(10000, 100)
    if not ok then
        ngx.log(ngx.ERR, "redis keepalive failed: ", err)
        red:close()
    end
end

-- 查询 Key 是否存在于 Redis（存在返回 true，不存在或出错返回 false）
local function redis_key_exists(red, key)
    local res, err = red:get(key)
    if not res then
        ngx.log(ngx.ERR, "redis get error key=", key, " err=", err)
        return false
    end
    return res ~= ngx.null
end

-- 获取并解析 Redis JSON 值（用于读取动作参数，如 ttl_seconds）
local function redis_get_json(red, key)
    local res, err = red:get(key)
    if not res or res == ngx.null then return nil end
    local ok, val = pcall(cjson.decode, res)
    if not ok then return nil end
    return val
end

-- ── 本地缓存封装 ──────────────────────────────────────────────────────────────
-- 使用 lua_shared_dict policy_cache 缓存 Redis 查询结果，减少每请求的 Redis 访问次数
-- TTL 3 秒：策略变更最多延迟 3 秒生效，在响应速度与性能之间取得平衡
local CACHE_TTL = 3

-- 缓存 block/challenge key 的存在性查询结果（"1"/"0"）
local function cached_key_exists(red, key)
    local cache = ngx.shared.policy_cache
    local hit = cache:get(key)
    if hit ~= nil then
        return hit == "1"
    end
    local result = redis_key_exists(red, key)
    cache:set(key, result and "1" or "0", CACHE_TTL)
    return result
end

-- 缓存 rate_limit key 的 JSON 值（"__nil__" 表示不存在）
local function cached_get_json(red, key)
    local cache = ngx.shared.policy_cache
    local hit = cache:get(key)
    if hit ~= nil then
        if hit == "__nil__" then return nil end
        local ok, val = pcall(cjson.decode, hit)
        return ok and val or nil
    end
    local result = redis_get_json(red, key)
    if result == nil then
        cache:set(key, "__nil__", CACHE_TTL)
    else
        local ok, encoded = pcall(cjson.encode, result)
        if ok then cache:set(key, encoded, CACHE_TTL) end
    end
    return result
end

-- 滑动窗口计数器：对 counter_key 执行 INCR，超出 RL_MAX_REQ 则返回 true
-- window_sec 优先取后端存入 Redis 值里的 ttl_seconds，缺省用 RL_WINDOW_SEC
local function rate_exceeded(red, counter_key, window_sec)
    window_sec = window_sec or RL_WINDOW_SEC
    local count, err = red:incr(counter_key)
    if not count then
        ngx.log(ngx.ERR, "rate_limit incr error key=", counter_key, " err=", err)
        return false -- 出错时 Fail Open
    end
    -- 首次计数时设置时间窗口过期
    if count == 1 then
        red:expire(counter_key, window_sec)
    end
    return count > RL_MAX_REQ
end

-- ── 核心检查逻辑 ───────────────────────────────────────────────────────────────

local function check_policy()
    local client_ip  = ngx.var.remote_addr
    local client_uri = ngx.var.uri

    local red, err = get_redis_conn()
    if not red then
        -- Fail Open：Redis 不可用时放行，不影响业务可用性
        ngx.log(ngx.ERR, "redis connect failed, fail-open. err=", err)
        return
    end

    -- ── Step 1: BLOCK 检查（最高优先级，返回 403）─────────────────────────────
    -- 检查顺序：global > ip > uri
    if cached_key_exists(red, build_action_key("global", "block", "*")) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[BLOCK] scope=global ip=", client_ip)
        ngx.exit(403)
        return
    end

    if cached_key_exists(red, build_action_key("ip", "block", client_ip)) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[BLOCK] scope=ip ip=", client_ip)
        ngx.exit(403)
        return
    end

    if cached_key_exists(red, build_action_key("uri", "block", client_uri)) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[BLOCK] scope=uri uri=", client_uri, " ip=", client_ip)
        ngx.exit(403)
        return
    end

    -- ── Step 2: CHALLENGE 检查（返回 401 触发 Basic Auth 质询）───────────────
    if cached_key_exists(red, build_action_key("global", "challenge", "*")) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[CHALLENGE] scope=global ip=", client_ip)
        ngx.header["WWW-Authenticate"] = 'Basic realm="WAF Security Challenge"'
        ngx.exit(401)
        return
    end

    if cached_key_exists(red, build_action_key("ip", "challenge", client_ip)) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[CHALLENGE] scope=ip ip=", client_ip)
        ngx.header["WWW-Authenticate"] = 'Basic realm="WAF Security Challenge"'
        ngx.exit(401)
        return
    end

    if cached_key_exists(red, build_action_key("uri", "challenge", client_uri)) then
        release_redis_conn(red)
        ngx.log(ngx.WARN, "[CHALLENGE] scope=uri uri=", client_uri, " ip=", client_ip)
        ngx.header["WWW-Authenticate"] = 'Basic realm="WAF Security Challenge"'
        ngx.exit(401)
        return
    end

    -- ── Step 3: RATE_LIMIT 检查（计数超出限制返回 429）───────────────────────
    -- 从 Redis 值中读取后端配置的 ttl_seconds 作为限流窗口，与后端策略对齐
    local rl_global_val = cached_get_json(red, build_action_key("global", "rate_limit", "*"))
    if rl_global_val then
        local window = rl_global_val.ttl_seconds or RL_WINDOW_SEC
        if rate_exceeded(red, REDIS_PREFIX .. ":rl_count:global", window) then
            release_redis_conn(red)
            ngx.log(ngx.WARN, "[RATE_LIMIT] scope=global exceeded ip=", client_ip)
            ngx.header["Retry-After"] = tostring(window)
            ngx.exit(429)
            return
        end
    end

    local rl_ip_val = cached_get_json(red, build_action_key("ip", "rate_limit", client_ip))
    if rl_ip_val then
        local window = rl_ip_val.ttl_seconds or RL_WINDOW_SEC
        if rate_exceeded(red, REDIS_PREFIX .. ":rl_count:ip:" .. to_base64url(client_ip), window) then
            release_redis_conn(red)
            ngx.log(ngx.WARN, "[RATE_LIMIT] scope=ip exceeded ip=", client_ip)
            ngx.header["Retry-After"] = tostring(window)
            ngx.exit(429)
            return
        end
    end

    local rl_uri_val = cached_get_json(red, build_action_key("uri", "rate_limit", client_uri))
    if rl_uri_val then
        local window = rl_uri_val.ttl_seconds or RL_WINDOW_SEC
        if rate_exceeded(red, REDIS_PREFIX .. ":rl_count:uri:" .. to_base64url(client_uri), window) then
            release_redis_conn(red)
            ngx.log(ngx.WARN, "[RATE_LIMIT] scope=uri exceeded uri=", client_uri, " ip=", client_ip)
            ngx.header["Retry-After"] = tostring(window)
            ngx.exit(429)
            return
        end
    end

    -- 所有检查通过，放行请求
    release_redis_conn(red)
end

-- ── 入口 ──────────────────────────────────────────────────────────────────────
check_policy()

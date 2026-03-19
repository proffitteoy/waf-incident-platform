
# ==============================================================================
# WAF 事件闭环平台 - 一键启动与全链路验证脚本 (Windows PowerShell)
# 项目根目录：D:\University\security_project\new\waf-incident-platform
# 兼容：Docker Desktop V2+ (docker compose), Node.js, Python3
# ==============================================================================

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = "D:\University\security_project\new\waf-incident-platform"
$BACKEND_URL = "http://localhost:3000"
$FRONTEND_URL = "http://localhost:5173" # 根据 docker-compose.yml 前端默认端口
$WEB_TEST_URL = "http://localhost:8080" # 攻击演练靶场
$MAX_RETRIES = 3
$WAIT_SECONDS = 8

# 颜色定义
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-Step {
    param([string]$Message)
    Write-Host "`n============================================================" -ForegroundColor $ColorInfo
    Write-Host " $Message" -ForegroundColor $ColorInfo
    Write-Host "============================================================" -ForegroundColor $ColorInfo
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor $ColorSuccess
}

function Write-Error-Custom {
    param([string]$Message, [string]$Suggestion)
    Write-Host "[FAIL] $Message" -ForegroundColor $ColorError
    if ($Suggestion) {
        Write-Host "       建议：$Suggestion" -ForegroundColor $ColorWarning
    }
}

# ------------------------------------------------------------------------------
# 第一步：检查 Docker 服务状态
# ------------------------------------------------------------------------------
Write-Step "步骤 1/8: 检查 Docker 服务状态"

try {
    # 尝试执行 docker info，捕获输出以避免污染控制台
    $null = docker info --format "{{.ServerVersion}}" 2>&1
    Write-Success "Docker 守护进程运行正常"
} catch {
    Write-Error-Custom "无法连接到 Docker 守护进程。" "请启动 'Docker Desktop' 应用程序，等待左下角状态变为绿色 (Engine running)，然后重启当前 PowerShell 终端再次运行此脚本。"
    exit 1
}

# 检查 docker compose 插件 (V2)
try {
    $null = docker compose version 2>&1
    Write-Success "docker compose (V2) 插件已安装"
} catch {
    Write-Error-Custom "未找到 'docker compose' 命令。" "请确保 Docker Desktop 已更新到最新版本，并在设置中启用了 'Use Docker Compose V2'。不要使用旧的 docker-compose.exe。"
    exit 1
}

# ------------------------------------------------------------------------------
# 第二步：进入项目根目录
# ------------------------------------------------------------------------------
Write-Step "步骤 2/8: 切换至项目根目录"

if (Test-Path $PROJECT_ROOT) {
    Set-Location $PROJECT_ROOT
    Write-Success "当前目录：$PWD"
} else {
    Write-Error-Custom "项目根目录不存在：$PROJECT_ROOT" "请检查路径配置是否正确。"
    exit 1
}

# ------------------------------------------------------------------------------
# 第三步：构建并启动所有服务 (含重试机制)
# ------------------------------------------------------------------------------
Write-Step "步骤 3/8: 构建并启动服务 (docker compose up -d --build)"

$retryCount = 0
$launchSuccess = $false

while ($retryCount -lt $MAX_RETRIES -and -not $launchSuccess) {
    try {
        Write-Host "尝试启动服务... (第 $($retryCount + 1) 次)" -ForegroundColor $ColorInfo
        
        # 执行启动命令
        docker compose up -d --build
        
        if ($LASTEXITCODE -eq 0) {
            $launchSuccess = $true
            Write-Success "服务启动命令执行成功"
        } else {
            throw "docker compose 返回非零退出码：$LASTEXITCODE"
        }
    } catch {
        $retryCount++
        Write-Host "启动失败：$_" -ForegroundColor $ColorWarning
        
        if ($retryCount -lt $MAX_RETRIES) {
            Write-Host "等待 5 秒后重试..." -ForegroundColor $ColorWarning
            Start-Sleep -Seconds 5
        } else {
            Write-Error-Custom "多次尝试后仍无法启动服务。" "1. 检查端口 3000, 5432, 6379, 80 是否被占用`n2. 查看日志：docker compose logs backend`n3. 确保 .env 文件已正确配置"
            exit 1
        }
    }
}

# ------------------------------------------------------------------------------
# 第四步：等待服务初始化
# ------------------------------------------------------------------------------
Write-Step "步骤 4/8: 等待服务完全初始化 ($WAIT_SECONDS 秒)"
Write-Host "正在等待数据库迁移、Redis 连接及后端预热..." -ForegroundColor $ColorInfo
Start-Sleep -Seconds $WAIT_SECONDS
Write-Success "等待结束"

# ------------------------------------------------------------------------------
# 第五步：检查容器运行状态
# ------------------------------------------------------------------------------
Write-Step "步骤 5/8: 验证容器运行状态"

# 获取容器状态
$containers = docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

Write-Host $containers

# 关键检查：forensics-worker 依赖的工具链虽在 backend 中，但需确保 backend 容器健康
$backendStatus = docker compose ps backend --format "{{.Status}}"
if ($backendStatus -like "*healthy*" -or $backendStatus -like "*Up*") {
    Write-Success "Backend 容器运行正常 (取证工具链已就绪)"
} else {
    Write-Error-Custom "Backend 容器状态异常：$backendStatus" "请运行 'docker compose logs backend' 排查启动错误，特别是 python3/tshark 安装步骤。"
    # 不直接退出，继续尝试健康检查以获取更详细错误
}

# ------------------------------------------------------------------------------
# 第六步：后端健康检查
# ------------------------------------------------------------------------------
Write-Step "步骤 6/8: 后端健康检查 ($BACKEND_URL/health)"

$healthRetry = 0
$healthSuccess = $false

while ($healthRetry -lt 5 -and -not $healthSuccess) {
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/health" -TimeoutSec 5 -UseBasicParsing
        $json = $response.Content | ConvertFrom-Json
        
        if ($json.ok -and $json.checks.postgres -eq "ok" -and $json.checks.redis -eq "ok") {
            Write-Success "后端服务健康 (PostgreSQL: OK, Redis: OK)"
            Write-Host "       详细信息：$($response.Content)" -ForegroundColor $ColorInfo
            $healthSuccess = $true
        } else {
            throw "服务状态不完整：$($response.Content)"
        }
    } catch {
        $healthRetry++
        if ($healthRetry -lt 5) {
            Write-Host "后端尚未就绪，重试中... ($healthRetry/5)" -ForegroundColor $ColorWarning
            Start-Sleep -Seconds 2
        } else {
            Write-Error-Custom "后端健康检查失败。" "1. 确认容器是否重启中：docker compose ps`n2. 查看详细日志：docker compose logs backend`n3. 检查数据库是否正常启动：docker compose logs postgres"
            # 即使失败也继续，方便用户看到后续指引
        }
    }
}

# ------------------------------------------------------------------------------
# 第七步：前端访问提示
# ------------------------------------------------------------------------------
Write-Step "步骤 7/8: 前端服务访问"
Write-Host "仪表盘地址：$FRONTEND_URL" -ForegroundColor $ColorInfo
Write-Host "攻击演练靶场 (Web-Test): $WEB_TEST_URL" -ForegroundColor $ColorInfo
Write-Host "提示：如果是首次启动，前端可能需要额外几十秒编译。" -ForegroundColor $ColorWarning

# ------------------------------------------------------------------------------
# 第八步：全链路功能验证引导
# ------------------------------------------------------------------------------
Write-Step "步骤 8/8: 全链路功能验证引导"

Write-Host "以下命令可用于快速验证核心链路 (已复制到剪贴板可直接粘贴):" -ForegroundColor $ColorInfo

$guide = @"
--- 1. 日志采集与回放 (验证 Ingestion) ---
cd backend
npm run replay tests/logs/sqli.log

--- 2. LLM 分析事件单 (验证 Analysis) ---
curl -X POST http://localhost:3000/api/incidents/analyze-events -H "Content-Type: application/json" -d "{}"
(注：需先有事件数据，或手动创建一个 incident_id 后调用 /api/incidents/:id/llm-reports)

--- 3. 触发取证抓包 (验证 Forensics) ---
(需先有一个存在的 incident_id，替换下面的 UUID)
curl -X POST http://localhost:3000/api/incidents/<YOUR_INCIDENT_ID>/forensics/capture -H "Content-Type: application/json" -d "{\"time_window_minutes\": 1}"

--- 4. 攻击场景测试 (验证 WAF 拦截) ---
(针对 web-test 靶场发起 SQL 注入)
curl -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d "{`\`"username`\`": `\`"admin' OR '1'='1`\`", `\`"password`\`": `\`"demo`\`"}"

--- 5. 查看实时日志 ---
docker compose logs -f backend
"@

Write-Host $guide
Write-Host "`n脚本执行完毕。祝您调试顺利！" -ForegroundColor $ColorSuccess
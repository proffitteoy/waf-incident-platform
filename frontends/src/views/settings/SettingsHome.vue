<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>系统设置</h2>
      <p>配置 LLM、Redis、PostgreSQL 等全局参数并查看系统健康状态。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- LLM 配置 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>LLM 配置</span>
              <el-tag size="small" type="info">{{ persistenceLabel }}</el-tag>
            </div>
          </template>

          <el-form :model="llm" label-width="120px">
            <el-form-item label="API Key">
              <el-input
                v-model="llm.apiKey"
                type="password"
                placeholder="留空则保持现有密钥不变"
                @input="apiKeyTouched = true"
              />
            </el-form-item>
            <el-form-item label="当前密钥">
              <el-tag size="small" :type="llm.hasApiKey ? 'success' : 'warning'">
                {{ llm.hasApiKey ? llm.apiKeyMasked || '已配置' : '未配置' }}
              </el-tag>
            </el-form-item>
            <el-form-item label="Base URL">
              <el-input v-model="llm.baseUrl" placeholder="https://llm.example.com/v1" />
            </el-form-item>
            <el-form-item label="模型">
              <el-select v-model="llm.model" filterable allow-create default-first-option style="width: 260px">
                <el-option label="waf-mvp-analyzer" value="waf-mvp-analyzer" />
                <el-option label="sec-llm-1" value="sec-llm-1" />
                <el-option label="gpt-4.5-secure" value="gpt-4.5-secure" />
              </el-select>
            </el-form-item>
            <el-form-item label="超时（秒）">
              <el-input-number v-model="llm.timeout" :min="1" :max="120" />
            </el-form-item>
            <el-form-item label="重试次数">
              <el-input-number v-model="llm.retries" :min="0" :max="10" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveLlm">
                保存 LLM 配置
              </el-button>
              <el-button :loading="loading" @click="loadLlmConfig">
                刷新
              </el-button>
            </el-form-item>
          </el-form>
          <p class="muted">
            {{ lastUpdatedText }}
          </p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 系统健康状态 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>系统健康状态</span>
            </div>
          </template>
          <ul class="health-list">
            <li>
              <span>Redis 连接状态</span>
              <el-tag type="success" size="small">已连接（示例）</el-tag>
            </li>
            <li>
              <span>PostgreSQL 连接状态</span>
              <el-tag type="success" size="small">正常（示例）</el-tag>
            </li>
            <li>
              <span>消息队列</span>
              <el-tag type="info" size="small">未启用</el-tag>
            </li>
          </ul>
          <p class="muted">
            实际健康状态将由 `/api/health` 返回，这里为前端占位显示。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { SettingsApi } from '../../api/settings'

const llm = reactive({
  apiKey: '',
  baseUrl: '',
  model: 'waf-mvp-analyzer',
  timeout: 30,
  retries: 2,
  hasApiKey: false,
  apiKeyMasked: null,
  updatedAt: null,
  persistence: 'memory',
})

const loading = ref(false)
const saving = ref(false)
const apiKeyTouched = ref(false)

const persistenceLabel = computed(() => {
  return llm.persistence === 'memory' ? '运行时配置（重启失效）' : '持久化配置'
})

const lastUpdatedText = computed(() => {
  if (!llm.updatedAt) {
    return '尚未检测到配置更新时间'
  }
  return `最近更新：${new Date(llm.updatedAt).toLocaleString()}`
})

function applyLlmConfig(config) {
  llm.baseUrl = config.baseUrl || ''
  llm.model = config.model || 'waf-mvp-analyzer'
  llm.timeout = Math.max(1, Math.round((config.timeoutMs || 15000) / 1000))
  llm.retries = Number.isInteger(config.retries) ? config.retries : 2
  llm.hasApiKey = Boolean(config.hasApiKey)
  llm.apiKeyMasked = config.apiKeyMasked || null
  llm.updatedAt = config.updatedAt || null
  llm.persistence = config.persistence || 'memory'
}

async function loadLlmConfig() {
  loading.value = true
  try {
    const result = await SettingsApi.getLlm()
    applyLlmConfig(result?.llm || {})
    llm.apiKey = ''
    apiKeyTouched.value = false
  } catch (error) {
    ElMessage.error(`读取 LLM 配置失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function saveLlm() {
  saving.value = true
  try {
    const payload = {
      baseUrl: llm.baseUrl.trim() || null,
      model: llm.model.trim(),
      timeoutMs: llm.timeout * 1000,
      retries: llm.retries,
    }

    if (apiKeyTouched.value) {
      payload.apiKey = llm.apiKey
    }

    const result = await SettingsApi.updateLlm(payload)
    applyLlmConfig(result?.llm || {})
    llm.apiKey = ''
    apiKeyTouched.value = false
    ElMessage.success('LLM 配置已保存')
  } catch (error) {
    ElMessage.error(`保存 LLM 配置失败：${error?.message || '未知错误'}`)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadLlmConfig()
})
</script>

<style scoped>
.page-wrapper {
  padding: 24px;
  color: var(--text-color);
}

.page-header h2 {
  margin: 0 0 4px;
}

.page-header p {
  margin: 0 0 16px;
  color: var(--muted-color);
  font-size: 13px;
}

.card-block {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 500;
}

.health-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
}

.health-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}
</style>


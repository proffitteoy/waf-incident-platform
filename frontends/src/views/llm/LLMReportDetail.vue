<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>LLM 报告详情 {{ reportId }}</h2>
      <p>查看大模型对安全事件的结构化分析结论。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="8" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="报告加载失败"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" @click="loadDetail">重试</el-button>
      </template>
    </el-result>

    <el-row v-else :gutter="16">
      <el-col :span="16">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>报告元信息</span></div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="报告 ID">{{ report.id }}</el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link class="link" :to="{ name: 'incident-detail', params: { id: report.incident_id } }">
                {{ report.incident_id }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="生成时间">{{ formatDateTime(report.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="模型版本">{{ report.model || '-' }}</el-descriptions-item>
            <el-descriptions-item label="任务类型">{{ report.task || '-' }}</el-descriptions-item>
            <el-descriptions-item label="置信度">{{ confidenceText }}</el-descriptions-item>
            <el-descriptions-item v-if="report.incident_title" label="事件标题" :span="2">
              {{ report.incident_title }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>分析结果</span></div>
          </template>

          <h4>攻击链</h4>
          <ul v-if="attackChain.length">
            <li v-for="(step, idx) in attackChain" :key="idx">
              <strong>{{ step.stage }}</strong>：{{ step.detail }}
            </li>
          </ul>
          <p v-else class="muted">暂无攻击链数据</p>

          <h4>关键 IOC</h4>
          <ul v-if="keyIocs.length">
            <li v-for="(ioc, idx) in keyIocs" :key="idx">
              <span v-if="ioc.type"><strong>{{ ioc.type }}</strong>：</span>
              <span v-if="Array.isArray(ioc.value)">{{ ioc.value.join(', ') }}</span>
              <span v-else>{{ ioc.value ?? ioc }}</span>
            </li>
          </ul>
          <p v-else class="muted">暂无 IOC 信息</p>

          <h4>影响评估</h4>
          <template v-if="riskAssessment.length">
            <p v-for="(entry, idx) in riskAssessment" :key="idx" class="muted">
              <strong>{{ entry.key }}</strong>：{{ entry.value }}
            </p>
          </template>
          <p v-else class="muted">-</p>

          <h4>建议处置（低风险）</h4>
          <ul v-if="actionsLow.length">
            <li v-for="(a, idx) in actionsLow" :key="idx">{{ a }}</li>
          </ul>
          <p v-else class="muted">-</p>

          <h4>建议处置（高风险）</h4>
          <ul v-if="actionsHigh.length">
            <li v-for="(a, idx) in actionsHigh" :key="idx">{{ a }}</li>
          </ul>
          <p v-else class="muted">-</p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>模型元数据</span></div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="Prompt 版本">{{ report.prompt_version || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Prompt 摘要">
              <span class="mono small">{{ report.prompt_digest || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="输入摘要">
              <span class="mono small">{{ report.input_digest || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>关联信息</span></div>
          </template>
          <p>
            关联事件：
            <router-link class="link" :to="{ name: 'incident-detail', params: { id: report.incident_id } }">
              {{ report.incident_id }}
            </router-link>
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { LLMReportsApi } from '../../api/llmReports'

const route = useRoute()
const reportId = String(route.params.id || '')

const report = ref({})
const isLoading = ref(true)
const loadError = ref('')

async function loadDetail() {
  if (!reportId) {
    loadError.value = '缺少报告 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await LLMReportsApi.detail(reportId)
    report.value = data || {}
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

const attackChain = computed(() => {
  const v = report.value?.attack_chain
  return Array.isArray(v) ? v : []
})

const keyIocs = computed(() => {
  const v = report.value?.key_iocs
  return Array.isArray(v) ? v : []
})

const riskAssessment = computed(() => {
  const v = report.value?.risk_assessment
  if (!v || typeof v !== 'object' || Array.isArray(v)) return []
  return Object.entries(v).map(([key, val]) => ({
    key,
    value: typeof val === 'object' ? JSON.stringify(val) : String(val ?? ''),
  }))
})

const actionsLow = computed(() => {
  const v = report.value?.recommended_actions_low
  return Array.isArray(v) ? v : []
})

const actionsHigh = computed(() => {
  const v = report.value?.recommended_actions_high
  return Array.isArray(v) ? v : []
})

const confidenceText = computed(() => {
  const v = report.value?.confidence
  if (v === null || v === undefined || v === '') return '-'
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : `${Math.round(n)}%`
})

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

onMounted(loadDetail)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.card-block { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 500; }
h4 { margin: 12px 0 4px; font-size: 13px; }
ul { margin: 0 0 8px 18px; padding: 0; font-size: 13px; }
.muted { color: var(--muted-color); font-size: 12px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.small { font-size: 11px; word-break: break-all; }
.link { color: #2563eb; }
</style>

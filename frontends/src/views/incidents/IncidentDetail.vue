<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>事件详情 {{ incident.id || incidentId }}</h2>
      <p>查看单个安全事件的完整上下文、原始日志与 LLM 分析结果。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="8" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="事件详情加载失败"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" @click="loadIncidentDetail">重试</el-button>
      </template>
    </el-result>

    <el-row v-else :gutter="16">
      <el-col :span="16">
        <!-- 基本信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>事件基本信息</span>
              <el-tag :type="riskTagType(incident.severity)" effect="dark" size="small">
                {{ riskLabel(incident.severity) }}
              </el-tag>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="事件 ID">{{ incident.id }}</el-descriptions-item>
            <el-descriptions-item label="发生时间">
              {{ formatDateTime(incident.first_seen || incident.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="来源 IP">{{ incident.src_ip || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标 URL">{{ incident.url || '暂无' }}</el-descriptions-item>
            <el-descriptions-item label="请求方法">
              <el-tag size="small" type="info">{{ incident.method || '暂无' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="User-Agent">
              <span class="mono">{{ incident.user_agent || incident.userAgent || '暂无' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(incident.status)" size="small">
                {{ statusLabel(incident.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="来源">{{ incident.source || '事件引擎' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 原始日志 / 摘要 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>原始日志</span>
              <el-button size="small" text @click="toggleRawLog">
                <el-icon class="btn-icon"><Document /></el-icon>
                {{ showRawLog ? '收起' : '展开' }}
              </el-button>
            </div>
          </template>
          <el-collapse-transition>
            <pre v-if="showRawLog" class="log-block">{{ incident.summary || '暂无日志摘要' }}</pre>
          </el-collapse-transition>
          <p v-if="!showRawLog" class="muted">日志内容已折叠，点击右上角按钮展开查看。</p>
        </el-card>

        <!-- 关联告警 & 动作历史 -->
        <el-row :gutter="16" class="card-block">
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>关联告警</span>
                </div>
              </template>
              <el-table :data="alerts" size="small" border style="width: 100%">
                <el-table-column prop="id" label="告警 ID" width="120" />
                <el-table-column prop="title" label="规则" show-overflow-tooltip />
                <el-table-column prop="severity" label="等级" width="90">
                  <template #default="{ row }">
                    <el-tag :type="riskTagType(row.severity)" size="small" effect="plain">
                      {{ riskLabel(row.severity) }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>关联动作历史</span>
                </div>
              </template>
              <el-timeline>
                <el-timeline-item
                  v-for="item in actions"
                  :key="item.id"
                  :timestamp="formatDateTime(item.created_at || item.executed_at)"
                  :type="item.result === 'success' ? 'success' : 'primary'"
                  size="small"
                >
                  <div class="timeline-title">{{ actionTitle(item) }}</div>
                  <div class="timeline-desc muted">{{ actionDetail(item) }}</div>
                </el-timeline-item>
              </el-timeline>
            </el-card>
          </el-col>
        </el-row>

        <!-- 评论 / 备注 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>评论 / 备注</span>
            </div>
          </template>
          <div class="comments-list" v-if="comments.length">
            <div v-for="(item, idx) in comments" :key="idx" class="comment-item">
              <div class="comment-meta">
                <span class="comment-author">{{ item.author }}</span>
                <span class="comment-time muted">{{ item.time }}</span>
              </div>
              <div class="comment-content">{{ item.content }}</div>
            </div>
          </div>
          <p v-else class="muted">暂无评论，您可以添加一条处理备注。</p>

          <el-form :model="newComment" class="comment-form">
            <el-form-item>
              <el-input
                v-model="newComment.content"
                type="textarea"
                :rows="3"
                placeholder="记录本次人工分析、处置或沟通的关键信息"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :disabled="!newComment.content.trim()"
                @click="addComment"
              >
                添加备注
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- LLM 分析 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>LLM 分析</span>
              <el-tag :type="llmTagType(llmStatus)" size="small">{{ llmLabel(llmStatus) }}</el-tag>
            </div>
          </template>

          <div v-if="llmStatus === 'not_started'" class="llm-placeholder">
            <p>暂无 LLM 分析结果。</p>
          </div>
          <div v-else class="llm-result">
            <h4>攻击链</h4>
            <ul v-if="llmAttackChain.length">
              <li v-for="(step, idx) in llmAttackChain" :key="idx">
                <strong>{{ step.stage }}</strong>：{{ step.detail }}
              </li>
            </ul>
            <p v-else class="muted">暂无攻击链数据</p>

            <h4>关键 IOC</h4>
            <ul v-if="llmIocs.length">
              <li v-for="(ioc, idx) in llmIocs" :key="idx">
                <span v-if="ioc.type"><strong>{{ ioc.type }}</strong>：</span>
                <span v-if="Array.isArray(ioc.value)">{{ ioc.value.join(', ') }}</span>
                <span v-else>{{ ioc.value ?? ioc }}</span>
              </li>
            </ul>
            <p v-else class="muted">暂无 IOC 信息</p>

            <h4>影响评估</h4>
            <template v-if="llmRiskAssessment.length">
              <p v-for="(entry, idx) in llmRiskAssessment" :key="idx" class="muted">
                <strong>{{ entry.key }}</strong>：{{ entry.value }}
              </p>
            </template>
            <p v-else class="muted">暂无影响评估</p>

            <h4>建议处置（低风险）</h4>
            <ul v-if="llmActionsLow.length">
              <li v-for="(action, idx) in llmActionsLow" :key="idx">{{ action }}</li>
            </ul>
            <p v-else class="muted">-</p>

            <h4>建议处置（高风险）</h4>
            <ul v-if="llmActionsHigh.length">
              <li v-for="(action, idx) in llmActionsHigh" :key="idx">{{ action }}</li>
            </ul>
            <p v-else class="muted">-</p>

            <h4>置信度</h4>
            <p class="muted">{{ llmConfidenceText }}</p>
          </div>

          <div class="llm-actions">
            <el-button type="primary" disabled>触发分析</el-button>
            <el-button disabled>重新分析</el-button>
          </div>
          <p class="muted" style="margin-top: 8px">暂不支持在详情页重新触发分析。</p>
        </el-card>

        <!-- 状态变更 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>状态变更</span>
            </div>
          </template>
          <el-radio-group v-model="incident.status" class="status-radios" disabled>
            <el-radio-button label="pending">待分析</el-radio-button>
            <el-radio-button label="analyzed">已分析</el-radio-button>
            <el-radio-button label="handled">已处理</el-radio-button>
            <el-radio-button label="closed">已关闭</el-radio-button>
          </el-radio-group>
          <p class="muted" style="margin-top: 8px">当前版本暂不支持在详情页直接修改状态。</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { IncidentsApi } from '../../api/incidents'

const route = useRoute()
const incidentId = String(route.params.id || '')

const incident = ref({})
const alerts = ref([])
const actions = ref([])
const llmReport = ref(null)
const isLoading = ref(true)
const loadError = ref('')
const showRawLog = ref(false)
const comments = ref([])
const newComment = ref({ content: '' })

function toggleRawLog() {
  showRawLog.value = !showRawLog.value
}

async function addComment() {
  if (!newComment.value.content.trim()) return
  try {
    await IncidentsApi.addComment(incidentId, {
      comment: newComment.value.content.trim(),
      actor: '当前用户',
    })
    comments.value.unshift({
      author: '当前用户',
      time: new Date().toLocaleString(),
      content: newComment.value.content.trim(),
    })
    newComment.value.content = ''
    ElMessage.success('已添加备注')
  } catch (error) {
    ElMessage.error(error?.message || '添加备注失败')
  }
}

function riskLabel(level) {
  switch (level) {
    case 'critical':
    case 'high':
      return '高'
    case 'med':
    case 'medium':
      return '中'
    case 'low':
      return '低'
    default:
      return level || '-'
  }
}

function riskTagType(level) {
  switch (level) {
    case 'critical':
    case 'high':
      return 'danger'
    case 'med':
    case 'medium':
      return 'warning'
    case 'low':
      return 'success'
    default:
      return ''
  }
}

function statusLabel(status) {
  switch (status) {
    case 'pending':
    case 'open':
      return '待分析'
    case 'analyzed':
      return '已分析'
    case 'handled':
    case 'mitigating':
      return '处理中'
    case 'closed':
    case 'resolved':
      return '已关闭'
    default:
      return status || '-'
  }
}

function statusTagType(status) {
  switch (status) {
    case 'pending':
    case 'open':
      return 'info'
    case 'analyzed':
      return 'primary'
    case 'handled':
    case 'mitigating':
      return 'warning'
    case 'closed':
    case 'resolved':
      return 'success'
    default:
      return ''
  }
}

function llmLabel(status) {
  switch (status) {
    case 'not_started':
      return '未触发'
    case 'completed':
      return '已完成'
    default:
      return status
  }
}

function llmTagType(status) {
  switch (status) {
    case 'not_started':
      return 'default'
    case 'completed':
      return 'success'
    default:
      return ''
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function actionTitle(item) {
  return item?.action_type || '动作'
}

function actionDetail(item) {
  return item?.detail || item?.result || '-'
}

const llmStatus = computed(() => (llmReport.value ? 'completed' : 'not_started'))

const llmAttackChain = computed(() => {
  const value = llmReport.value?.attack_chain
  if (Array.isArray(value)) return value
  return []
})

const llmIocs = computed(() => {
  const value = llmReport.value?.key_iocs
  if (Array.isArray(value)) return value
  return []
})

const llmRiskAssessment = computed(() => {
  const value = llmReport.value?.risk_assessment
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).map(([key, val]) => ({
    key,
    value: typeof val === 'object' ? JSON.stringify(val) : String(val ?? ''),
  }))
})

const llmActionsLow = computed(() => {
  const value = llmReport.value?.recommended_actions_low
  if (Array.isArray(value)) return value
  return []
})

const llmActionsHigh = computed(() => {
  const value = llmReport.value?.recommended_actions_high
  if (Array.isArray(value)) return value
  return []
})

const llmConfidenceText = computed(() => {
  const value = llmReport.value?.confidence
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return `${Math.round(numeric)}%`
})

async function loadIncidentDetail() {
  if (!incidentId) {
    loadError.value = '缺少事件 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await IncidentsApi.detail(incidentId)
    incident.value = data?.incident || {}
    alerts.value = data?.alerts || []
    actions.value = data?.actions || []
    llmReport.value = (data?.llm_reports || [])[0] || null
    comments.value = []
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadIncidentDetail)
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

.btn-icon {
  margin-right: 4px;
}

.log-block {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.timeline-title {
  font-size: 13px;
  margin-bottom: 2px;
}

.timeline-desc {
  font-size: 12px;
}

.comments-list {
  margin-bottom: 16px;
}

.comment-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.comment-item:last-of-type {
  border-bottom: none;
}

.comment-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 2px;
}

.comment-author {
  font-weight: 500;
}

.comment-content {
  font-size: 13px;
}

.comment-form {
  margin-top: 8px;
}

.llm-placeholder {
  padding: 8px 0 4px;
  font-size: 13px;
}

.llm-result h4 {
  margin: 8px 0 4px;
  font-size: 13px;
}

.llm-result ul {
  margin: 0 0 8px 18px;
  padding: 0;
  font-size: 13px;
}

.llm-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.status-radios {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>

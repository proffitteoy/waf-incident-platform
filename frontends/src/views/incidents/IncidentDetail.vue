<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>事件详情 {{ incident.id }}</h2>
      <p>查看单个安全事件的完整上下文、原始日志与 LLM 分析结果。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- 基本信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>事件基本信息</span>
              <el-tag :type="riskTagType(incident.riskLevel)" effect="dark" size="small">
                {{ riskLabel(incident.riskLevel) }}
              </el-tag>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="事件 ID">
              {{ incident.id }}
            </el-descriptions-item>
            <el-descriptions-item label="发生时间">
              {{ incident.time }}
            </el-descriptions-item>
            <el-descriptions-item label="来源 IP">
              {{ incident.sourceIp }}
            </el-descriptions-item>
            <el-descriptions-item label="目标 URL">
              {{ incident.url }}
            </el-descriptions-item>
            <el-descriptions-item label="请求方法">
              <el-tag size="small" type="info">{{ incident.method }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="User-Agent">
              <span class="mono">{{ incident.userAgent }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(incident.status)" size="small">
                {{ statusLabel(incident.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="来源">
              {{ incident.source }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 原始日志 -->
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
            <pre v-if="showRawLog" class="log-block">
{{ incident.rawLog }}
            </pre>
          </el-collapse-transition>
          <p v-if="!showRawLog" class="muted">
            日志内容已折叠，点击右上角按钮展开查看。当前为假数据示例，后续接入真实原始日志。
          </p>
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
              <el-table
                :data="incident.relatedAlerts"
                size="small"
                border
                style="width: 100%"
              >
                <el-table-column prop="id" label="告警 ID" width="120" />
                <el-table-column prop="rule" label="规则" show-overflow-tooltip />
                <el-table-column prop="severity" label="等级" width="90">
                  <template #default="{ row }">
                    <el-tag
                      :type="riskTagType(row.severity)"
                      size="small"
                      effect="plain"
                    >
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
                  v-for="item in incident.actionHistory"
                  :key="item.time"
                  :timestamp="item.time"
                  :type="item.type"
                  size="small"
                >
                  <div class="timeline-title">{{ item.title }}</div>
                  <div class="timeline-desc muted">{{ item.detail }}</div>
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
            <div
              v-for="(item, idx) in comments"
              :key="idx"
              class="comment-item"
            >
              <div class="comment-meta">
                <span class="comment-author">{{ item.author }}</span>
                <span class="comment-time muted">{{ item.time }}</span>
              </div>
              <div class="comment-content">
                {{ item.content }}
              </div>
            </div>
          </div>
          <p v-else class="muted">暂无评论，您可以添加一条处理备注。</p>

          <el-form :model="newComment" class="comment-form">
            <el-form-item>
              <el-input
                v-model="newComment.content"
                type="textarea"
                :rows="3"
                placeholder="记录本次人工分析、处置或沟通的关键信息（假数据，不会持久化）"
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
              <span class="muted" style="margin-left: 8px">
                备注仅用于前端演示，后续接入后台审计日志。
              </span>
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
              <el-tag
                :type="llmTagType(incident.llmStatus)"
                size="small"
              >
                {{ llmLabel(incident.llmStatus) }}
              </el-tag>
            </div>
          </template>

          <p class="muted">
            当前为本地假数据示例，后续会根据 `/api/incidents/:id/llm-report` 返回真实内容。
          </p>

          <div v-if="incident.llmStatus === 'not_started'" class="llm-placeholder">
            <p>尚未触发 LLM 分析，可以点击下方按钮进行一次自动研判。</p>
          </div>
          <div v-else-if="incident.llmStatus === 'running'" class="llm-placeholder">
            <el-skeleton animated :rows="4" />
          </div>
          <div v-else class="llm-result">
            <h4>模型研判结论（示例）</h4>
            <ul>
              <li>疑似 SQL 注入攻击，命中了多条数据库访问关键字。</li>
              <li>请求频率与 UA 特征疑似自动化工具，不像正常用户行为。</li>
              <li>建议对源 IP 临时封禁 24 小时，并对相关规则进行加强。</li>
            </ul>
            <h4>影响评估</h4>
            <p class="muted">
              当前尚未发现实际成功入侵的证据，但如果放任该模式持续存在，可能导致数据库敏感信息泄露。
            </p>
          </div>

          <div class="llm-actions">
            <el-button
              type="primary"
              :loading="incident.llmStatus === 'running'"
              @click="triggerAnalyze"
            >
              触发分析
            </el-button>
            <el-button
              :disabled="incident.llmStatus === 'not_started'"
              @click="reAnalyze"
            >
              重新分析
            </el-button>
          </div>
        </el-card>

        <!-- 状态变更 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>状态变更</span>
            </div>
          </template>
          <el-radio-group v-model="incident.status" class="status-radios">
            <el-radio-button label="pending">待分析</el-radio-button>
            <el-radio-button label="analyzed">已分析</el-radio-button>
            <el-radio-button label="handled">已处理</el-radio-button>
            <el-radio-button label="closed">已关闭</el-radio-button>
          </el-radio-group>
          <p class="muted" style="margin-top: 8px">
            这里的状态切换为前端本地操作，后续会通过 API 回写事件状态并落库。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Cpu, Document } from '@element-plus/icons-vue'

const route = useRoute()

const incidentId = route.params.id || 'INC-20240001'

const incident = ref(buildMockIncident(String(incidentId)))

const showRawLog = ref(false)

const comments = ref([
  {
    author: 'SOC 分析员 A',
    time: '2026-03-01 09:32:10',
    content: '初步确认来源 IP 属于海外云服务商，建议短期封禁并持续观察。',
  },
])

const newComment = ref({
  content: '',
})

function toggleRawLog() {
  showRawLog.value = !showRawLog.value
}

function addComment() {
  if (!newComment.value.content.trim()) return
  comments.value.unshift({
    author: '当前用户',
    time: new Date().toLocaleString(),
    content: newComment.value.content.trim(),
  })
  newComment.value.content = ''
  ElMessage.success('已添加备注（仅前端示例，不会持久化）')
}

function triggerAnalyze() {
  if (incident.value.llmStatus === 'running') return
  incident.value.llmStatus = 'running'
  ElMessage.success('已触发 LLM 分析（假操作，后续接入后端任务）')
}

function reAnalyze() {
  incident.value.llmStatus = 'running'
  ElMessage.info('已重新触发 LLM 分析（假操作）')
}

function riskLabel(level) {
  switch (level) {
    case 'high':
      return '高'
    case 'medium':
      return '中'
    case 'low':
      return '低'
    default:
      return level
  }
}

function riskTagType(level) {
  switch (level) {
    case 'high':
      return 'danger'
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
      return '待分析'
    case 'analyzed':
      return '已分析'
    case 'handled':
      return '已处理'
    case 'closed':
      return '已关闭'
    default:
      return status
  }
}

function statusTagType(status) {
  switch (status) {
    case 'pending':
      return 'info'
    case 'analyzed':
      return 'primary'
    case 'handled':
      return 'success'
    case 'closed':
      return 'default'
    default:
      return ''
  }
}

function llmLabel(status) {
  switch (status) {
    case 'not_started':
      return '未触发'
    case 'running':
      return '分析中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

function llmTagType(status) {
  switch (status) {
    case 'not_started':
      return 'default'
    case 'running':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    default:
      return ''
  }
}

function buildMockIncident(id) {
  const baseId = Number(id.replace(/\D/g, '')) || 20240001
  const riskLevels = ['high', 'medium', 'low']
  const statuses = ['pending', 'analyzed', 'handled', 'closed']
  const riskLevel = riskLevels[baseId % riskLevels.length]
  const status = statuses[baseId % statuses.length]

  const mock = {
    id: id,
    time: '2026-03-01 08:23:45',
    sourceIp: '203.0.113.42',
    url: '/api/v1/orders?user_id=1234',
    method: 'POST',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    riskLevel,
    status,
    source: 'WAF - Web 应用防火墙',
    llmStatus: 'completed',
    rawLog: createRawLogSample(id),
    relatedAlerts: [
      {
        id: 'ALERT-1001',
        rule: 'SQL Injection - UNION SELECT pattern',
        severity: 'high',
      },
      {
        id: 'ALERT-1002',
        rule: 'Abnormal parameter length on /api/v1/orders',
        severity: 'medium',
      },
    ],
    actionHistory: [
      {
        time: '2026-03-01 08:25:10',
        title: '自动封禁 IP（示例）',
        detail: '根据策略，已对源 IP 203.0.113.42 进行 1 小时临时封禁。',
        type: 'danger',
      },
      {
        time: '2026-03-01 09:00:03',
        title: 'LLM 分析任务完成',
        detail: '模型完成对请求与上下文日志的研判，输出风险评估。',
        type: 'primary',
      },
    ],
  }

  return mock
}

function createRawLogSample(id) {
  return [
    `2026-03-01T08:23:45.123Z waf-edge app=web-api incident_id=${id}`,
    'client_ip=203.0.113.42 method=POST scheme=https host=api.example.com',
    'path="/api/v1/orders" qs="user_id=1234" status=403 bytes=512',
    'rule_id=900001 rule_name="SQLi detection: stacked queries" severity=high',
    'request_body="id=1; DROP TABLE users; --"',
    'ua="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"',
  ].join('\n')
}
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
  margin: 4px 0;
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


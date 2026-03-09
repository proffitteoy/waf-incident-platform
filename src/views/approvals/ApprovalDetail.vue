<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>审批详情 {{ approval.id }}</h2>
      <p>查看审批请求的完整信息，并执行通过或拒绝操作。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- 审批基本信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>审批基本信息</span>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="审批 ID">
              {{ approval.id }}
            </el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link
                class="link"
                :to="{ name: 'incident-detail', params: { id: approval.incidentId } }"
              >
                {{ approval.incidentId }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="请求人">
              {{ approval.requester }}
            </el-descriptions-item>
            <el-descriptions-item label="请求时间">
              {{ approval.requestedAt }}
            </el-descriptions-item>
            <el-descriptions-item label="风险等级">
              <el-tag :type="riskTagType(approval.riskLevel)" size="small">
                {{ riskLabel(approval.riskLevel) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(approval.status)" size="small">
                {{ statusLabel(approval.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 请求动作详情 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>请求动作详情</span>
            </div>
          </template>

          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="动作类型">
              {{ approval.action.type }}
            </el-descriptions-item>
            <el-descriptions-item label="动作参数">
              <pre class="mono-block">{{ approval.action.params }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="预期影响">
              {{ approval.action.expectedImpact }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 风险评估 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>风险评估结果</span>
            </div>
          </template>
          <p class="muted">
            以下内容来自 LLM 对该动作的辅助评估（假数据，后续接入真实报告）。
          </p>
          <p>{{ approval.riskAssessment }}</p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 审批操作区 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>审批操作</span>
            </div>
          </template>

          <el-form :model="form" label-position="top">
            <el-form-item label="审批意见">
              <el-input
                v-model="form.comment"
                type="textarea"
                :rows="4"
                placeholder="填写通过或拒绝的理由，将记录在审批历史中（假数据，不会落库）"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :disabled="approval.status !== 'pending'"
                @click="doApprove"
              >
                通过
              </el-button>
              <el-button
                type="danger"
                :disabled="approval.status !== 'pending'"
                @click="doReject"
              >
                拒绝
              </el-button>
            </el-form-item>
          </el-form>

          <p class="muted">
            当前为前端本地模拟，后续会调用 `/api/approvals/:id/decision` 将审批结果写入后台。
          </p>
        </el-card>

        <!-- 审批历史记录 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>审批历史记录</span>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in history"
              :key="index"
              :timestamp="item.time"
              :type="item.type"
              size="small"
            >
              <div class="timeline-title">
                {{ item.operator }} - {{ statusLabel(item.status) }}
              </div>
              <div class="timeline-desc muted">
                {{ item.comment || '无备注' }}
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const approvalId = String(route.params.id || 'APR-20240001')

const approval = ref(buildMockApproval(approvalId))

const form = ref({
  comment: '',
})

const history = ref([
  {
    time: '2026-03-01 10:00:00',
    operator: '系统',
    status: 'pending',
    comment: '自动创建审批单，等待人工确认。',
    type: 'info',
  },
])

function doApprove() {
  if (approval.value.status !== 'pending') return
  approval.value.status = 'approved'
  history.value.unshift({
    time: new Date().toLocaleString(),
    operator: '当前用户',
    status: 'approved',
    comment: form.value.comment || '同意执行该动作。',
    type: 'success',
  })
  ElMessage.success('已通过该审批（假操作）')
}

function doReject() {
  if (approval.value.status !== 'pending') return
  approval.value.status = 'rejected'
  history.value.unshift({
    time: new Date().toLocaleString(),
    operator: '当前用户',
    status: 'rejected',
    comment: form.value.comment || '不同意执行该动作。',
    type: 'danger',
  })
  ElMessage.error('已拒绝该审批（假操作）')
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
      return '待审批'
    case 'approved':
      return '已通过'
    case 'rejected':
      return '已拒绝'
    default:
      return status
  }
}

function statusTagType(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    default:
      return ''
  }
}

function buildMockApproval(id) {
  return {
    id,
    incidentId: 'INC-20240010',
    requester: 'SOC-A',
    requestedAt: '2026-03-01 09:45:12',
    riskLevel: 'high',
    status: 'pending',
    action: {
      type: '封禁 IP',
      params: JSON.stringify(
        {
          ip: '203.0.113.42',
          duration: '24h',
          reason: '多次疑似 SQL 注入攻击',
        },
        null,
        2,
      ),
      expectedImpact:
        '封禁该 IP 后，该来源的恶意流量将被全部阻断，可能对少量正常用户产生短期影响。',
    },
    riskAssessment:
      '根据近期流量特征，该 IP 的恶意请求占比超过 95%，综合评估建议立即封禁，并在 24 小时后复盘策略效果。',
  }
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

.mono-block {
  margin: 0;
  padding: 8px;
  border-radius: 4px;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
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

.link {
  color: #2563eb;
}
</style>


<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>审批详情 {{ approvalId }}</h2>
      <p>查看审批请求的完整信息，并执行通过或拒绝操作。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="6" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="审批详情加载失败"
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
            <div class="card-header"><span>审批基本信息</span></div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="审批 ID">{{ approval.id }}</el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link class="link" :to="{ name: 'incident-detail', params: { id: approval.incident_id } }">
                {{ approval.incident_id }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="请求人">{{ approval.requested_by || '-' }}</el-descriptions-item>
            <el-descriptions-item label="请求时间">{{ formatDateTime(approval.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="风险等级">
              <el-tag :type="riskTagType(approval.risk_level)" size="small">
                {{ riskLabel(approval.risk_level) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(approval.status)" size="small">
                {{ statusLabel(approval.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="approval.reviewed_by" label="审批人">
              {{ approval.reviewed_by }}
            </el-descriptions-item>
            <el-descriptions-item v-if="approval.reviewed_at" label="审批时间">
              {{ formatDateTime(approval.reviewed_at) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>请求动作详情</span></div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="动作类型">{{ actionDraft.action_type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="作用范围">{{ actionDraft.scope || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标">{{ actionDraft.target || '-' }}</el-descriptions-item>
            <el-descriptions-item label="TTL（秒）">{{ actionDraft.ttl_seconds ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="完整参数">
              <pre class="mono-block">{{ JSON.stringify(actionDraft, null, 2) }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="approval.comment" shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>审批意见</span></div>
          </template>
          <p>{{ approval.comment }}</p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>审批操作</span></div>
          </template>

          <el-form :model="form" label-position="top">
            <el-form-item label="审批意见">
              <el-input
                v-model="form.comment"
                type="textarea"
                :rows="4"
                placeholder="填写通过或拒绝的理由，将记录在审批历史中"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                :disabled="approval.status !== 'pending'"
                :loading="submitting"
                @click="doApprove"
              >
                通过
              </el-button>
              <el-button
                type="danger"
                :disabled="approval.status !== 'pending' || !form.comment.trim()"
                :loading="submitting"
                @click="doReject"
              >
                拒绝
              </el-button>
            </el-form-item>
          </el-form>

          <p v-if="approval.status !== 'pending'" class="muted">该审批已处理完毕，不可再次操作。</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ApprovalsApi } from '../../api/approvals'

const route = useRoute()
const approvalId = String(route.params.id || '')

const approval = ref({})
const isLoading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const form = ref({ comment: '' })

const actionDraft = computed(() => {
  const draft = approval.value?.action_draft
  if (!draft) return {}
  if (typeof draft === 'string') {
    try { return JSON.parse(draft) } catch { return {} }
  }
  return draft
})

async function loadDetail() {
  if (!approvalId) {
    loadError.value = '缺少审批 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await ApprovalsApi.detail(approvalId)
    approval.value = data || {}
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

async function doApprove() {
  if (approval.value.status !== 'pending') return
  submitting.value = true
  try {
    await ApprovalsApi.approve(approvalId, {
      reviewer: '当前用户',
      comment: form.value.comment || undefined,
    })
    ElMessage.success('已通过该审批')
    await loadDetail()
    form.value.comment = ''
  } catch (error) {
    ElMessage.error(error?.message || '审批通过失败')
  } finally {
    submitting.value = false
  }
}

async function doReject() {
  if (approval.value.status !== 'pending') return
  if (!form.value.comment.trim()) {
    ElMessage.warning('拒绝时需填写审批意见')
    return
  }
  submitting.value = true
  try {
    await ApprovalsApi.reject(approvalId, {
      reviewer: '当前用户',
      comment: form.value.comment.trim(),
    })
    ElMessage.error('已拒绝该审批')
    await loadDetail()
    form.value.comment = ''
  } catch (error) {
    ElMessage.error(error?.message || '审批拒绝失败')
  } finally {
    submitting.value = false
  }
}

function riskLabel(level) {
  switch (level) {
    case 'high': return '高'
    case 'med':
    case 'medium': return '中'
    case 'low': return '低'
    default: return level || '-'
  }
}

function riskTagType(level) {
  switch (level) {
    case 'high': return 'danger'
    case 'med':
    case 'medium': return 'warning'
    case 'low': return 'success'
    default: return ''
  }
}

function statusLabel(status) {
  switch (status) {
    case 'pending': return '待审批'
    case 'approved': return '已通过'
    case 'rejected': return '已拒绝'
    default: return status || '-'
  }
}

function statusTagType(status) {
  switch (status) {
    case 'pending': return 'warning'
    case 'approved': return 'success'
    case 'rejected': return 'danger'
    default: return ''
  }
}

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
.mono-block { margin: 0; padding: 8px; border-radius: 4px; background: #020617; color: #e5e7eb; font-size: 12px; line-height: 1.5; white-space: pre; }
.muted { color: var(--muted-color); font-size: 12px; }
.link { color: #2563eb; }
</style>

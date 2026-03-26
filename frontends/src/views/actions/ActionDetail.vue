<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>动作详情 {{ actionId }}</h2>
      <p>查看动作执行详情及回滚信息。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="6" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="动作详情加载失败"
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
            <div class="card-header"><span>动作基本信息</span></div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="动作 ID">{{ action.id }}</el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link class="link" :to="{ name: 'incident-detail', params: { id: action.incident_id } }">
                {{ action.incident_id }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="动作类型">{{ action.action_type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="当前结果">
              <el-tag :type="resultTagType(action.result)" size="small">
                {{ resultLabel(action.result) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="作用范围">{{ action.scope || '-' }}</el-descriptions-item>
            <el-descriptions-item label="目标">{{ action.target || '-' }}</el-descriptions-item>
            <el-descriptions-item label="TTL（秒）">{{ action.ttl_seconds ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="请求人">{{ action.requested_by || '-' }}</el-descriptions-item>
            <el-descriptions-item label="执行人">{{ action.executed_by || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDateTime(action.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="执行时间">{{ formatDateTime(action.executed_at) }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="action.detail" shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>执行详情</span></div>
          </template>
          <p>{{ action.detail }}</p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>回滚操作</span></div>
          </template>
          <el-button
            type="warning"
            :disabled="action.result !== 'success' || action.action_type === 'rollback'"
            :loading="submitting"
            @click="doRollback"
          >
            触发回滚
          </el-button>
          <p class="muted" style="margin-top: 8px">
            只有执行成功（非 rollback 类型）的动作才允许回滚。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ActionsApi } from '../../api/actions'

const route = useRoute()
const actionId = String(route.params.id || '')

const action = ref({})
const isLoading = ref(true)
const loadError = ref('')
const submitting = ref(false)

async function loadDetail() {
  if (!actionId) {
    loadError.value = '缺少动作 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await ActionsApi.detail(actionId)
    action.value = data || {}
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

async function doRollback() {
  if (action.value.result !== 'success') return
  submitting.value = true
  try {
    await ActionsApi.rollback(actionId, {
      actor: '当前用户',
      reason: '手动回滚',
    })
    ElMessage.success('已触发回滚，请稍后刷新查看最新状态')
    await loadDetail()
  } catch (error) {
    ElMessage.error(error?.message || '回滚失败')
  } finally {
    submitting.value = false
  }
}

function resultLabel(result) {
  switch (result) {
    case 'pending': return '待执行'
    case 'success': return '已完成'
    case 'fail': return '已失败'
    default: return result || '-'
  }
}

function resultTagType(result) {
  switch (result) {
    case 'pending': return 'info'
    case 'success': return 'success'
    case 'fail': return 'danger'
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
.muted { color: var(--muted-color); font-size: 12px; }
.link { color: #2563eb; }
</style>

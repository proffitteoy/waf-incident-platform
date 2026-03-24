<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>动作列表</h2>
      <p>查看所有已执行和待执行的安全动作，并支持回滚操作。</p>
    </header>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部"
            clearable
            style="width: 180px"
          >
            <el-option label="待执行" value="pending" />
            <el-option label="已完成" value="success" />
            <el-option label="已失败" value="failed" />
            <el-option label="已回滚" value="rolled_back" />
          </el-select>
        </el-form-item>
        <el-form-item label="动作类型">
          <el-select
            v-model="filters.actionType"
            placeholder="全部"
            clearable
            style="width: 200px"
          >
            <el-option label="封禁" value="block" />
            <el-option label="挑战" value="challenge" />
            <el-option label="回滚" value="rollback" />
            <el-option label="限流" value="rate_limit" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            查询
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="filteredActions" border stripe style="width: 100%">
        <el-table-column prop="id" label="动作 ID" width="140" />
        <el-table-column prop="incidentId" label="关联事件 ID" width="150">
          <template #default="{ row }">
            <router-link
              class="link"
              :to="{ name: 'incident-detail', params: { id: row.incidentId } }"
            >
              {{ row.incidentId }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="typeLabel" label="动作类型" width="140" />
        <el-table-column prop="executedAt" label="执行时间" width="180" />
        <el-table-column prop="status" label="执行状态" width="130">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result" label="执行结果" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" fixed="right" width="220">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row)">
              查看详情
            </el-button>
            <el-button
              size="small"
              text
              type="warning"
              :disabled="!canRollback(row)"
              @click="rollback(row)"
            >
              回滚
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="muted" style="margin-top: 8px">
        执行状态当前由 API 拉取，点击查询或刷新页面可更新。
      </p>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ActionsApi } from '../../api/actions'

const router = useRouter()

const filters = reactive({
  status: '',
  actionType: '',
  dateRange: [],
})

const loading = ref(false)
const actions = ref([])

const filteredActions = computed(() => {
  const { status, actionType, dateRange } = filters

  return actions.value.filter((item) => {
    if (status && item.status !== status) return false
    if (actionType && item.actionType !== actionType) return false

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      if (item.date < start || item.date > end) return false
    }

    return true
  })
})

async function loadActions() {
  loading.value = true
  try {
    const query = { limit: 200, offset: 0 }

    if (filters.actionType) {
      query.action_type = filters.actionType
    }

    if (filters.status === 'pending') query.result = 'pending'
    if (filters.status === 'success') query.result = 'success'
    if (filters.status === 'failed') query.result = 'fail'
    if (filters.status === 'rolled_back') {
      query.result = 'success'
      query.action_type = 'rollback'
    }

    const result = await ActionsApi.list(query)
    const items = Array.isArray(result?.items) ? result.items : []
    actions.value = items.map(mapAction)
  } catch (error) {
    ElMessage.error(`加载动作列表失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  void loadActions()
}

function handleReset() {
  filters.status = ''
  filters.actionType = ''
  filters.dateRange = []
  void loadActions()
}

function goDetail(row) {
  router.push({ name: 'action-detail', params: { id: row.id } })
}

function canRollback(row) {
  return row.status === 'success' && row.actionType !== 'rollback'
}

async function rollback(row) {
  if (!canRollback(row)) return
  loading.value = true
  try {
    await ActionsApi.rollback(row.id, {
      actor: 'frontend-user',
      reason: 'rollback from ui',
    })
    ElMessage.success(`已对动作 ${row.id} 触发回滚`)
    await loadActions()
  } catch (error) {
    ElMessage.error(`回滚失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

function statusLabel(status) {
  switch (status) {
    case 'pending':
      return '待执行'
    case 'success':
      return '已完成'
    case 'fail':
    case 'failed':
      return '已失败'
    case 'rolled_back':
      return '已回滚'
    default:
      return status
  }
}

function statusTagType(status) {
  switch (status) {
    case 'pending':
      return 'info'
    case 'success':
      return 'success'
    case 'fail':
    case 'failed':
      return 'danger'
    case 'rolled_back':
      return 'default'
    default:
      return ''
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function toDateOnly(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function actionTypeLabel(actionType) {
  switch (actionType) {
    case 'block':
      return '封禁'
    case 'challenge':
      return '挑战'
    case 'rollback':
      return '回滚'
    case 'rate_limit':
      return '限流'
    default:
      return actionType || '-'
  }
}

function mapAction(item) {
  const normalizedResult = item.result === 'fail' ? 'failed' : item.result
  const status = item.action_type === 'rollback' && normalizedResult === 'success' ? 'rolled_back' : normalizedResult
  return {
    id: item.id,
    incidentId: item.incident_id,
    actionType: item.action_type,
    typeLabel: actionTypeLabel(item.action_type),
    executedAt: formatDateTime(item.executed_at || item.created_at),
    date: toDateOnly(item.executed_at || item.created_at),
    status,
    result: item.detail || (status === 'success' ? '执行成功' : status === 'pending' ? '排队中' : '执行失败'),
  }
}

onMounted(() => {
  void loadActions()
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

.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.table-card {
  margin-top: 8px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.link {
  color: #2563eb;
}
</style>


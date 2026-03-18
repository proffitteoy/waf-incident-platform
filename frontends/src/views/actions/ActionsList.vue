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
            <el-option label="执行中" value="running" />
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
            <el-option label="封禁 IP" value="block-ip" />
            <el-option label="修改规则" value="update-rule" />
            <el-option label="回滚配置" value="rollback" />
            <el-option label="限流" value="rate-limit" />
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
      <el-table :data="filteredActions" border stripe style="width: 100%">
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
        执行状态实时更新可通过 WebSocket 或轮询实现，当前为本地假数据静态展示。
      </p>
    </el-card>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

const filters = reactive({
  status: '',
  actionType: '',
  dateRange: [],
})

const actions = ref(createMockActions())

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

function handleSearch() {}

function handleReset() {
  filters.status = ''
  filters.actionType = ''
  filters.dateRange = []
}

function goDetail(row) {
  router.push({ name: 'action-detail', params: { id: row.id } })
}

function canRollback(row) {
  return row.status === 'success' && row.supportRollback && !row.rolledBack
}

function rollback(row) {
  if (!canRollback(row)) return
  row.status = 'rolled_back'
  row.result = '已执行回滚操作（假数据）'
  ElMessage.success(`已对动作 ${row.id} 触发回滚（假操作）`)
}

function statusLabel(status) {
  switch (status) {
    case 'pending':
      return '待执行'
    case 'running':
      return '执行中'
    case 'success':
      return '已完成'
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
    case 'running':
      return 'warning'
    case 'success':
      return 'success'
    case 'failed':
      return 'danger'
    case 'rolled_back':
      return 'default'
    default:
      return ''
  }
}

function createMockActions() {
  const today = new Date()
  const pad = (n) => (n < 10 ? `0${n}` : n)

  const types = [
    { key: 'block-ip', label: '封禁 IP' },
    { key: 'update-rule', label: '修改规则' },
    { key: 'rollback', label: '回滚配置' },
    { key: 'rate-limit', label: '限流' },
  ]
  const statuses = ['pending', 'running', 'success', 'failed', 'success']

  const list = []
  for (let i = 1; i <= 24; i += 1) {
    const day = new Date(today.getTime() - (i % 5) * 24 * 60 * 60 * 1000)
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const time = `${date} ${pad(10 + (i % 6))}:${pad((i * 4) % 60)}:${pad((i * 9) % 60)}`
    const type = types[i % types.length]
    const status = statuses[i % statuses.length]

    list.push({
      id: `ACT-${20240000 + i}`,
      incidentId: `INC-${20240001 + (i % 12)}`,
      actionType: type.key,
      typeLabel: type.label,
      executedAt: time,
      date,
      status,
      result:
        status === 'success'
          ? '执行成功，已同步到下游系统。'
          : status === 'failed'
            ? '执行失败，等待人工排查。'
            : '任务排队或执行中。',
      supportRollback: type.key !== 'rate-limit',
      rolledBack: false,
    })
  }

  return list
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


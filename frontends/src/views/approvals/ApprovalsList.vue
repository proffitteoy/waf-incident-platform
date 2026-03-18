<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>审批列表</h2>
      <p>管理所有待审批和已审批的动作请求，支持批量操作。</p>
    </header>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option label="待审批" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="风险等级">
          <el-select
            v-model="filters.riskLevel"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
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

    <el-card class="table-card" shadow="never">
      <div class="table-toolbar">
        <div class="left">
          <el-button
            type="primary"
            :disabled="!multipleSelection.length"
            @click="handleBulkApprove"
          >
            批量通过
          </el-button>
          <el-button
            type="danger"
            :disabled="!multipleSelection.length"
            @click="handleBulkReject"
          >
            批量拒绝
          </el-button>
        </div>
        <div class="right">
          <span class="muted">
            当前展示 {{ filteredApprovals.length }} 条审批（假数据，后续接入 /api/approvals）
          </span>
        </div>
      </div>

      <el-table
        :data="pagedApprovals"
        border
        stripe
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column prop="id" label="审批 ID" width="140" />
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
        <el-table-column prop="actionType" label="请求动作类型" width="160" />
        <el-table-column prop="riskLevel" label="风险等级" width="100">
          <template #default="{ row }">
            <el-tag :type="riskTagType(row.riskLevel)" size="small">
              {{ riskLabel(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="requestedAt" label="请求时间" width="180" />
        <el-table-column prop="requester" label="请求人" width="120" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              type="primary"
              @click="goDetail(row)"
            >
              查看详情
            </el-button>
            <el-button
              size="small"
              text
              type="success"
              :disabled="row.status !== 'pending'"
              @click="approve(row)"
            >
              通过
            </el-button>
            <el-button
              size="small"
              text
              type="danger"
              :disabled="row.status !== 'pending'"
              @click="reject(row)"
            >
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :total="filteredApprovals.length"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
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
  riskLevel: '',
  dateRange: [],
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
})

const allApprovals = ref(generateMockApprovals())

const filteredApprovals = computed(() => {
  const { status, riskLevel, dateRange } = filters

  return allApprovals.value.filter((item) => {
    if (status && item.status !== status) return false
    if (riskLevel && item.riskLevel !== riskLevel) return false

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      if (item.date < start || item.date > end) return false
    }

    return true
  })
})

const pagedApprovals = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredApprovals.value.slice(start, end)
})

const multipleSelection = ref([])

function handleSearch() {
  pagination.currentPage = 1
}

function handleReset() {
  filters.status = ''
  filters.riskLevel = ''
  filters.dateRange = []
  pagination.currentPage = 1
}

function handleSelectionChange(selection) {
  multipleSelection.value = selection
}

function handleBulkApprove() {
  if (!multipleSelection.value.length) return
  multipleSelection.value.forEach((item) => {
    if (item.status === 'pending') item.status = 'approved'
  })
  ElMessage.success(`已批量通过 ${multipleSelection.value.length} 条审批（假操作）`)
}

function handleBulkReject() {
  if (!multipleSelection.value.length) return
  multipleSelection.value.forEach((item) => {
    if (item.status === 'pending') item.status = 'rejected'
  })
  ElMessage.warning(`已批量拒绝 ${multipleSelection.value.length} 条审批（假操作）`)
}

function goDetail(row) {
  router.push({ name: 'approval-detail', params: { id: row.id } })
}

function approve(row) {
  if (row.status !== 'pending') return
  row.status = 'approved'
  ElMessage.success(`审批 ${row.id} 已通过（假操作）`)
}

function reject(row) {
  if (row.status !== 'pending') return
  row.status = 'rejected'
  ElMessage.error(`审批 ${row.id} 已拒绝（假操作）`)
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

function generateMockApprovals() {
  const today = new Date()
  const pad = (n) => (n < 10 ? `0${n}` : n)
  const riskLevels = ['high', 'medium', 'low']
  const statuses = ['pending', 'approved', 'rejected']
  const actionTypes = ['封禁 IP', '修改规则', '回滚配置', '限流策略']
  const requesters = ['SOC-A', 'SOC-B', 'SOC-C']

  const list = []
  for (let i = 1; i <= 24; i += 1) {
    const day = new Date(today.getTime() - (i % 7) * 24 * 60 * 60 * 1000)
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const time = `${date} ${pad(9 + (i % 8))}:${pad((i * 3) % 60)}:${pad((i * 11) % 60)}`

    const riskLevel = riskLevels[i % riskLevels.length]
    const status = statuses[i % statuses.length]

    list.push({
      id: `APR-${20240000 + i}`,
      incidentId: `INC-${20240010 + (i % 10)}`,
      actionType: actionTypes[i % actionTypes.length],
      riskLevel,
      requestedAt: time,
      date,
      requester: requesters[i % requesters.length],
      status,
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

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.table-toolbar .left {
  display: flex;
  gap: 8px;
}

.table-toolbar .right .muted {
  font-size: 12px;
  color: var(--muted-color);
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.link {
  color: #2563eb;
}
</style>


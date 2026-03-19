<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>事件列表</h2>
      <p>集中查看与管理所有安全事件，支持多维度筛选与批量操作。</p>
    </header>

    <!-- 筛选区 -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
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
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部"
            clearable
            style="width: 150px"
          >
            <el-option label="待分析" value="pending" />
            <el-option label="已分析" value="analyzed" />
            <el-option label="已处理" value="handled" />
            <el-option label="已关闭" value="closed" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select
            v-model="filters.source"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option label="WAF - Web 应用防火墙" value="waf-web" />
            <el-option label="WAF - API 网关" value="waf-api" />
            <el-option label="WAF - Edge/CDN" value="waf-edge" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input
            v-model="filters.keyword"
            placeholder="事件 ID / IP / URL 关键字"
            clearable
            style="width: 260px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon class="btn-icon"><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格与批量操作 -->
    <el-card class="table-card" shadow="never">
      <div class="table-toolbar">
        <div class="left">
          <el-button
            type="primary"
            :disabled="multipleSelection.length === 0"
            @click="handleBulkAnalyze"
          >
            <el-icon class="btn-icon"><Cpu /></el-icon>
            批量分析
          </el-button>
          <el-button
            :disabled="multipleSelection.length === 0"
            @click="handleBulkExport"
          >
            <el-icon class="btn-icon"><Download /></el-icon>
            批量导出
          </el-button>
        </div>
        <div class="right">
          <span class="muted">
            当前展示 {{ filteredIncidents.length }} 条事件（假数据演示，后续接入 API）
          </span>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="pagedIncidents"
        border
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="48"
          align="center"
        />
        <el-table-column
          prop="id"
          label="事件 ID"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="time"
          label="发生时间"
          width="180"
        />
        <el-table-column
          prop="sourceIp"
          label="来源 IP"
          width="140"
        />
        <el-table-column
          prop="riskLevel"
          label="风险等级"
          width="110"
        >
          <template #default="{ row }">
            <el-tag
              :type="riskTagType(row.riskLevel)"
              effect="dark"
              size="small"
            >
              {{ riskLabel(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              :type="statusTagType(row.status)"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="llmStatus"
          label="LLM 分析状态"
          width="150"
        >
          <template #default="{ row }">
            <el-tag
              :type="llmTagType(row.llmStatus)"
              size="small"
            >
              {{ llmLabel(row.llmStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="source"
          label="来源"
          width="150"
          show-overflow-tooltip
        />
        <el-table-column
          label="操作"
          fixed="right"
          width="210"
        >
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
              :disabled="row.llmStatus === 'completed' || row.llmStatus === 'running'"
              @click="triggerAnalyze(row)"
            >
              触发分析
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :total="filteredIncidents.length"
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
import { Cpu, Download, Search } from '@element-plus/icons-vue'

const router = useRouter()

const loading = ref(false)

const filters = reactive({
  dateRange: [],
  riskLevel: '',
  status: '',
  source: '',
  keyword: '',
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
})

const allIncidents = ref(generateMockIncidents())

const filteredIncidents = computed(() => {
  const { dateRange, riskLevel, status, source, keyword } = filters
  return allIncidents.value.filter((item) => {
    if (riskLevel && item.riskLevel !== riskLevel) return false
    if (status && item.status !== status) return false
    if (source && item.sourceKey !== source) return false

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      if (item.date < start || item.date > end) return false
    }

    if (keyword && keyword.trim()) {
      const k = keyword.trim().toLowerCase()
      const hit =
        item.id.toLowerCase().includes(k) ||
        item.sourceIp.toLowerCase().includes(k) ||
        (item.url && item.url.toLowerCase().includes(k))
      if (!hit) return false
    }

    return true
  })
})

const pagedIncidents = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredIncidents.value.slice(start, end)
})

const multipleSelection = ref([])

function handleSearch() {
  pagination.currentPage = 1
}

function handleReset() {
  filters.dateRange = []
  filters.riskLevel = ''
  filters.status = ''
  filters.source = ''
  filters.keyword = ''
  pagination.currentPage = 1
}

function handleSelectionChange(selection) {
  multipleSelection.value = selection
}

function handleBulkAnalyze() {
  if (!multipleSelection.value.length) return
  const ids = multipleSelection.value.map((i) => i.id).join(', ')
  ElMessage.success(`已触发对 ${multipleSelection.value.length} 个事件的分析（假操作）：${ids}`)
}

function handleBulkExport() {
  if (!multipleSelection.value.length) return
  ElMessage.info(`已导出 ${multipleSelection.value.length} 条事件（假操作，后续接入导出 API）`)
}

function goDetail(row) {
  router.push({ name: 'incident-detail', params: { id: row.id } })
}

function triggerAnalyze(row) {
  row.llmStatus = 'running'
  ElMessage.success(`已触发事件 ${row.id} 的 LLM 分析（假操作）`)
  // 模拟几秒后完成可在接入真实 API 时由后端状态驱动，这里保持为 running
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

function generateMockIncidents() {
  const sources = [
    { key: 'waf-web', label: 'WAF - Web 应用防火墙' },
    { key: 'waf-api', label: 'WAF - API 网关' },
    { key: 'waf-edge', label: 'WAF - Edge/CDN' },
  ]
  const riskLevels = ['high', 'medium', 'low']
  const statuses = ['pending', 'analyzed', 'handled', 'closed']
  const llmStatuses = ['not_started', 'running', 'completed']

  const today = new Date()
  const pad = (n) => (n < 10 ? `0${n}` : n)

  const list = []
  for (let i = 1; i <= 32; i += 1) {
    const day = new Date(today.getTime() - (i % 7) * 24 * 60 * 60 * 1000)
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const time = `${date} ${pad(8 + (i % 10))}:${pad((i * 7) % 60)}:${pad((i * 13) % 60)}`
    const source = sources[i % sources.length]

    const riskLevel = riskLevels[i % riskLevels.length]
    const status = statuses[i % statuses.length]
    const llmStatus = llmStatuses[i % llmStatuses.length]

    list.push({
      id: `INC-${20240000 + i}`,
      date,
      time,
      sourceIp: `192.168.${i % 10}.${(i * 3) % 255}`,
      url: `/api/v1/resource/${i}`,
      method: i % 2 === 0 ? 'GET' : 'POST',
      riskLevel,
      status,
      llmStatus,
      source: source.label,
      sourceKey: source.key,
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

.btn-icon {
  margin-right: 4px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>


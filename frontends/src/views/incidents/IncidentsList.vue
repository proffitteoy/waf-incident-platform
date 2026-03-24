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
            <el-option label="事件引擎" value="backend" />
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
            当前展示 {{ filteredIncidents.length }} 条事件（实时数据）
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Cpu, Download, Search } from '@element-plus/icons-vue'
import { IncidentsApi } from '../../api/incidents'

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

const allIncidents = ref([])

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
  void loadIncidents()
}

function handleReset() {
  filters.dateRange = []
  filters.riskLevel = ''
  filters.status = ''
  filters.source = ''
  filters.keyword = ''
  pagination.currentPage = 1
  void loadIncidents()
}

function handleSelectionChange(selection) {
  multipleSelection.value = selection
}

async function handleBulkAnalyze() {
  if (!multipleSelection.value.length) return
  try {
    const targets = [...new Set(multipleSelection.value.map((item) => item.sourceIp).filter(Boolean))]
    const results = await Promise.allSettled(
      targets.map((srcIp) =>
        IncidentsApi.analyzeEvents({
          src_ip: srcIp,
          limit: 100,
          requested_by: 'frontend-user',
        })
      )
    )
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    ElMessage.success(`已触发 ${successCount}/${targets.length} 个来源 IP 的分析任务`)
  } catch (error) {
    ElMessage.error(`批量分析触发失败：${error?.message || '未知错误'}`)
  }
}

function handleBulkExport() {
  if (!multipleSelection.value.length) return
  ElMessage.info(`已导出 ${multipleSelection.value.length} 条事件（导出 API 暂未接入）`)
}

function goDetail(row) {
  router.push({ name: 'incident-detail', params: { id: row.id } })
}

async function triggerAnalyze(row) {
  row.llmStatus = 'running'
  try {
    await IncidentsApi.analyzeEvents({
      src_ip: row.sourceIp,
      limit: 100,
      requested_by: 'frontend-user',
    })
    ElMessage.success(`已触发事件 ${row.id} 的 LLM 分析`)
  } catch (error) {
    row.llmStatus = 'failed'
    ElMessage.error(`触发分析失败：${error?.message || '未知错误'}`)
  }
}

function riskLabel(level) {
  switch (level) {
    case 'high':
      return '高'
    case 'med':
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

function mapSeverityToUi(value) {
  if (value === 'med') return 'medium'
  return value || 'low'
}

function mapStatusToUi(value) {
  if (value === 'open') return 'pending'
  if (value === 'mitigating') return 'handled'
  if (value === 'resolved') return 'closed'
  return value || 'pending'
}

function statusToApi(value) {
  if (value === 'pending') return 'open'
  if (value === 'analyzed' || value === 'handled') return 'mitigating'
  if (value === 'closed') return 'resolved'
  return undefined
}

function severityToApi(value) {
  if (value === 'medium') return 'med'
  return value || undefined
}

async function loadIncidents() {
  loading.value = true
  try {
    const result = await IncidentsApi.list({
      limit: 300,
      offset: 0,
      status: statusToApi(filters.status),
      severity: severityToApi(filters.riskLevel),
    })

    const items = Array.isArray(result?.items) ? result.items : []
    allIncidents.value = items.map((item) => {
      const ts = item.last_seen || item.created_at
      return {
        id: item.id,
        date: toDateOnly(ts),
        time: formatDateTime(ts),
        sourceIp: item.src_ip || '-',
        url: item.summary || item.title || '',
        method: '-',
        riskLevel: mapSeverityToUi(item.severity),
        status: mapStatusToUi(item.status),
        llmStatus: 'not_started',
        source: '事件引擎',
        sourceKey: 'backend',
      }
    })
  } catch (error) {
    ElMessage.error(`加载事件列表失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadIncidents()
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


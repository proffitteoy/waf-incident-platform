<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>取证任务列表</h2>
      <p>管理网络取证抓包任务，支持查看详情和下载 PCAP 文件。</p>
    </header>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 180px">
            <el-option label="排队中" value="queued" />
            <el-option label="抓包中" value="capturing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已失败" value="failed" />
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
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="filteredTasks" border stripe style="width: 100%">
        <el-table-column prop="id" label="任务 ID" width="160" show-overflow-tooltip />
        <el-table-column label="关联事件 ID" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <router-link
              v-if="row.incident_id"
              class="link"
              :to="{ name: 'incident-detail', params: { id: row.incident_id } }"
            >
              {{ row.incident_id }}
            </router-link>
            <span v-else class="muted">未关联</span>
          </template>
        </el-table-column>
        <el-table-column label="抓包时间范围" width="240">
          <template #default="{ row }">{{ formatTimeRange(row.ts_start, row.ts_end) }}</template>
        </el-table-column>
        <el-table-column label="过滤表达式" prop="filter" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="完成时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.completed_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="140">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ForensicsApi } from '../../api/forensics'

const router = useRouter()
const loading = ref(false)
const allTasks = ref([])

const filters = reactive({
  status: '',
  dateRange: [],
})

const filteredTasks = computed(() => {
  const { status, dateRange } = filters
  return allTasks.value.filter((item) => {
    if (status && item.status !== status) return false
    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      const date = toDateOnly(item.created_at)
      if (date < start || date > end) return false
    }
    return true
  })
})

function handleSearch() {}

function handleReset() {
  filters.status = ''
  filters.dateRange = []
}

function goDetail(row) {
  router.push({ name: 'forensics-detail', params: { id: row.id } })
}

function statusLabel(status) {
  switch (status) {
    case 'queued': return '排队中'
    case 'capturing': return '抓包中'
    case 'completed': return '已完成'
    case 'failed': return '已失败'
    default: return status || '-'
  }
}

function statusTagType(status) {
  switch (status) {
    case 'queued': return 'info'
    case 'capturing': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    default: return ''
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatTimeRange(start, end) {
  if (!start && !end) return '-'
  return `${formatDateTime(start)} ~ ${formatDateTime(end)}`
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

async function loadTasks() {
  loading.value = true
  try {
    const result = await ForensicsApi.list({ limit: 200, offset: 0 })
    allTasks.value = Array.isArray(result?.items) ? result.items : []
  } catch (error) {
    ElMessage.error(`加载取证任务列表失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.filter-card { margin-bottom: 16px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.table-card { margin-top: 8px; }
.muted { color: var(--muted-color); font-size: 12px; }
.link { color: #2563eb; }
</style>

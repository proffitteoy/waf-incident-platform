<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>LLM 报告列表</h2>
      <p>查看所有由大模型生成的安全分析报告，并按事件、时间快速检索。</p>
    </header>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="关联事件 ID">
          <el-input
            v-model="filters.incidentId"
            placeholder="输入事件 ID 关键字"
            clearable
            style="width: 280px"
            @keyup.enter="handleSearch"
          />
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

    <el-card class="table-card" shadow="never">
      <div class="table-toolbar">
        <span class="muted">共 {{ filteredReports.length }} 条报告</span>
      </div>

      <el-table v-loading="loading" :data="pagedReports" border stripe style="width: 100%">
        <el-table-column prop="id" label="报告 ID" width="160" show-overflow-tooltip />
        <el-table-column prop="incident_id" label="关联事件 ID" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <router-link
              class="link"
              :to="{ name: 'incident-detail', params: { id: row.incident_id } }"
            >
              {{ row.incident_id }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="model" label="模型版本" width="160" show-overflow-tooltip />
        <el-table-column label="报告摘要" show-overflow-tooltip>
          <template #default="{ row }">{{ row.incident_title || '-' }}</template>
        </el-table-column>
        <el-table-column label="置信度" width="90" align="center">
          <template #default="{ row }">
            {{ row.confidence != null ? Math.round(Number(row.confidence)) + '%' : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="120">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :total="filteredReports.length"
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
import { LLMReportsApi } from '../../api/llmReports'

const router = useRouter()

const loading = ref(false)
const allReports = ref([])

const filters = reactive({
  incidentId: '',
  dateRange: [],
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
})

const filteredReports = computed(() => {
  const { incidentId, dateRange } = filters

  return allReports.value.filter((item) => {
    if (incidentId && !item.incident_id.toLowerCase().includes(incidentId.trim().toLowerCase())) {
      return false
    }

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      const date = toDateOnly(item.created_at)
      if (date < start || date > end) return false
    }

    return true
  })
})

const pagedReports = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredReports.value.slice(start, end)
})

function handleSearch() {
  pagination.currentPage = 1
}

function handleReset() {
  filters.incidentId = ''
  filters.dateRange = []
  pagination.currentPage = 1
}

function goDetail(row) {
  router.push({ name: 'incident-detail', params: { id: row.incident_id } })
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

async function loadReports() {
  loading.value = true
  try {
    const result = await LLMReportsApi.list({ limit: 500, offset: 0 })
    allReports.value = Array.isArray(result?.items) ? result.items : []
  } catch (error) {
    ElMessage.error(`加载报告列表失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadReports)
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
  margin-bottom: 12px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.link {
  color: #2563eb;
}
</style>

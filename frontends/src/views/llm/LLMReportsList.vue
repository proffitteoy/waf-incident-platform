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
            placeholder="例如：INC-20240001"
            clearable
            style="width: 220px"
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
        <el-form-item label="模型版本">
          <el-select
            v-model="filters.modelVersion"
            placeholder="全部"
            clearable
            style="width: 180px"
          >
            <el-option label="llm-sec-1.0" value="llm-sec-1.0" />
            <el-option label="llm-sec-1.1" value="llm-sec-1.1" />
            <el-option label="llm-sec-2.0" value="llm-sec-2.0" />
          </el-select>
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
          <span class="muted">
            当前展示 {{ filteredReports.length }} 条报告（假数据，后续接入 /api/llm-reports）
          </span>
        </div>
      </div>

      <el-table
        :data="pagedReports"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column
          prop="id"
          label="报告 ID"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="incidentId"
          label="关联事件 ID"
          width="150"
        >
          <template #default="{ row }">
            <router-link
              class="link"
              :to="{ name: 'incident-detail', params: { id: row.incidentId } }"
            >
              {{ row.incidentId }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="生成时间"
          width="180"
        />
        <el-table-column
          prop="modelVersion"
          label="模型版本"
          width="140"
        />
        <el-table-column
          prop="summary"
          label="报告摘要"
          show-overflow-tooltip
        />
        <el-table-column
          label="操作"
          fixed="right"
          width="140"
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
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const filters = reactive({
  incidentId: '',
  dateRange: [],
  modelVersion: '',
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
})

const allReports = ref(generateMockReports())

const filteredReports = computed(() => {
  const { incidentId, dateRange, modelVersion } = filters

  return allReports.value.filter((item) => {
    if (incidentId && !item.incidentId.toLowerCase().includes(incidentId.trim().toLowerCase())) {
      return false
    }

    if (modelVersion && item.modelVersion !== modelVersion) {
      return false
    }

    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange
      if (item.date < start || item.date > end) return false
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
  filters.modelVersion = ''
  pagination.currentPage = 1
}

function goDetail(row) {
  router.push({ name: 'llm-report-detail', params: { id: row.id } })
}

function generateMockReports() {
  const today = new Date()
  const pad = (n) => (n < 10 ? `0${n}` : n)
  const models = ['llm-sec-1.0', 'llm-sec-1.1', 'llm-sec-2.0']

  const list = []
  for (let i = 1; i <= 26; i += 1) {
    const day = new Date(today.getTime() - (i % 10) * 24 * 60 * 60 * 1000)
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const time = `${date} ${pad(9 + (i % 6))}:${pad((i * 5) % 60)}:${pad((i * 13) % 60)}`

    list.push({
      id: `LLM-${20240000 + i}`,
      incidentId: `INC-${20240000 + (i % 20) + 1}`,
      date,
      createdAt: time,
      modelVersion: models[i % models.length],
      summary:
        i % 2 === 0
          ? '疑似 SQL 注入攻击，请求参数中包含可疑关键字和堆叠查询。'
          : '触发多次异常访问规则，疑似暴力破解或弱口令探测行为。',
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

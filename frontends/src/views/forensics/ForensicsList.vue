<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>取证任务列表</h2>
      <p>管理网络取证抓包任务，支持查看详情和下载 PCAP 文件。</p>
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
            <el-option label="排队中" value="queued" />
            <el-option label="进行中" value="running" />
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
          <el-button type="primary" @click="handleSearch">
            查询
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="goNewTask">
            新建取证任务
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="filteredTasks" border stripe style="width: 100%">
        <el-table-column prop="id" label="任务 ID" width="140" />
        <el-table-column prop="incidentId" label="关联事件 ID" width="150">
          <template #default="{ row }">
            <router-link
              v-if="row.incidentId"
              class="link"
              :to="{ name: 'incident-detail', params: { id: row.incidentId } }"
            >
              {{ row.incidentId }}
            </router-link>
            <span v-else class="muted">未关联</span>
          </template>
        </el-table-column>
        <el-table-column prop="timeRange" label="抓包时间范围" width="220" />
        <el-table-column prop="interface" label="网卡接口" width="120" />
        <el-table-column prop="bpf" label="BPF 过滤表达式" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column prop="finishedAt" label="完成时间" width="180" />
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goDetail(row)">
              查看详情
            </el-button>
            <el-button
              size="small"
              text
              type="success"
              :disabled="row.status !== 'completed'"
            >
              下载 PCAP
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const filters = reactive({
  status: '',
  dateRange: [],
})

const tasks = ref(createMockTasks())

const filteredTasks = computed(() => {
  const { status, dateRange } = filters

  return tasks.value.filter((item) => {
    if (status && item.status !== status) return false
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
  filters.dateRange = []
}

function goNewTask() {
  router.push({ name: 'forensics-new' })
}

function goDetail(row) {
  router.push({ name: 'forensics-detail', params: { id: row.id } })
}

function statusLabel(status) {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '进行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '已失败'
    default:
      return status
  }
}

function statusTagType(status) {
  switch (status) {
    case 'queued':
      return 'info'
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

function createMockTasks() {
  const today = new Date()
  const pad = (n) => (n < 10 ? `0${n}` : n)
  const statuses = ['queued', 'running', 'completed', 'failed', 'completed']

  const list = []
  for (let i = 1; i <= 18; i += 1) {
    const day = new Date(today.getTime() - (i % 6) * 24 * 60 * 60 * 1000)
    const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const createdAt = `${date} ${pad(9 + (i % 5))}:${pad((i * 3) % 60)}:${pad((i * 7) % 60)}`
    const finishedAt =
      i % 3 === 0
        ? `${date} ${pad(10 + (i % 5))}:${pad((i * 3 + 10) % 60)}:${pad((i * 7 + 20) % 60)}`
        : ''
    const status = statuses[i % statuses.length]

    list.push({
      id: `FOR-${20240000 + i}`,
      incidentId: i % 2 === 0 ? `INC-${20240020 + (i % 5)}` : '',
      timeRange: `${date} 09:00 ~ ${date} 10:00`,
      interface: `eth${i % 3}`,
      bpf: 'tcp port 443 and host api.example.com',
      status,
      date,
      createdAt,
      finishedAt: status === 'completed' ? finishedAt : '',
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


<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>取证任务详情 {{ taskId }}</h2>
      <p>查看取证任务配置、状态及 PCAP 结果信息。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="6" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="取证任务加载失败"
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
            <div class="card-header"><span>任务基本信息</span></div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="任务 ID">{{ task.id }}</el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link
                v-if="task.incident_id"
                class="link"
                :to="{ name: 'incident-detail', params: { id: task.incident_id } }"
              >
                {{ task.incident_id }}
              </router-link>
              <span v-else class="muted">未关联</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDateTime(task.created_at) }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{ formatDateTime(task.completed_at) }}</el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(task.status)" size="small">{{ statusLabel(task.status) }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>抓包配置</span></div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="时间范围">
              {{ formatTimeRange(task.ts_start, task.ts_end) }}
            </el-descriptions-item>
            <el-descriptions-item label="过滤表达式（BPF）">
              <span class="mono">{{ task.filter || '未设置' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card v-if="task.status === 'completed'" shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>抓包结果</span></div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="PCAP 文件大小">
              {{ task.size_bytes != null ? formatBytes(task.size_bytes) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="SHA256 校验">
              <span class="mono" style="font-size: 11px; word-break: break-all;">{{ task.sha256 || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
          <el-button
            type="primary"
            style="margin-top: 12px"
            :disabled="!task.download_url"
            @click="downloadPcap"
          >
            下载 PCAP
          </el-button>
        </el-card>

        <el-card v-if="task.error_message" shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>错误信息</span></div>
          </template>
          <p class="muted">{{ task.error_message }}</p>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header"><span>状态说明</span></div>
          </template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(task.status)" size="small">{{ statusLabel(task.status) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item v-if="task.status === 'capturing'" label="提示">
              抓包任务正在执行中，请稍后刷新查看最新状态。
            </el-descriptions-item>
          </el-descriptions>
          <el-button size="small" @click="loadDetail" style="margin-top: 8px">刷新状态</el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ForensicsApi } from '../../api/forensics'

const route = useRoute()
const taskId = String(route.params.id || '')

const task = ref({})
const isLoading = ref(true)
const loadError = ref('')

async function loadDetail() {
  if (!taskId) {
    loadError.value = '缺少任务 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await ForensicsApi.detail(taskId)
    task.value = data || {}
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

function downloadPcap() {
  if (!task.value.download_url) return
  const url = task.value.download_url.startsWith('/')
    ? `${window.location.origin}${task.value.download_url}`
    : task.value.download_url
  window.open(url, '_blank')
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
  return d.toLocaleString()
}

function formatTimeRange(start, end) {
  if (!start && !end) return '-'
  return `${formatDateTime(start)} ~ ${formatDateTime(end)}`
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
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
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.link { color: #2563eb; }
</style>

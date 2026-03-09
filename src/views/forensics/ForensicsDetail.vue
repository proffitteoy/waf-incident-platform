<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>取证任务详情 {{ task.id }}</h2>
      <p>查看取证任务配置、状态时间线及 PCAP 结果信息。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- 任务基本信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>任务基本信息</span>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="任务 ID">
              {{ task.id }}
            </el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link
                v-if="task.incidentId"
                class="link"
                :to="{ name: 'incident-detail', params: { id: task.incidentId } }"
              >
                {{ task.incidentId }}
              </router-link>
              <span v-else class="muted">未关联</span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ task.createdAt }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ task.finishedAt || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(task.status)" size="small">
                {{ statusLabel(task.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 抓包配置 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>抓包配置</span>
            </div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="时间范围">
              {{ task.timeRange }}
            </el-descriptions-item>
            <el-descriptions-item label="网卡接口">
              {{ task.interface }}
            </el-descriptions-item>
            <el-descriptions-item label="BPF 过滤表达式">
              <span class="mono">{{ task.bpf }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 抓包结果 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>抓包结果</span>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="PCAP 文件大小">
              {{ task.result.size }}
            </el-descriptions-item>
            <el-descriptions-item label="包数量">
              {{ task.result.packetCount }}
            </el-descriptions-item>
            <el-descriptions-item label="捕获持续时长">
              {{ task.result.duration }}
            </el-descriptions-item>
          </el-descriptions>
          <el-button
            type="primary"
            style="margin-top: 12px"
            :disabled="task.status !== 'completed'"
          >
            下载 PCAP（假操作）
          </el-button>
        </el-card>

        <!-- 任务日志 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>任务日志</span>
            </div>
          </template>
          <pre class="log-block">{{ task.logs }}</pre>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 状态时间线 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>任务状态时间线</span>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in task.timeline"
              :key="index"
              :timestamp="item.time"
              :type="item.type"
              size="small"
            >
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-desc muted">{{ item.detail }}</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const taskId = String(route.params.id || 'FOR-20240001')

const task = ref(buildMockTask(taskId))

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

function buildMockTask(id) {
  return {
    id,
    incidentId: 'INC-20240030',
    createdAt: '2026-03-01 10:00:00',
    finishedAt: '2026-03-01 10:05:32',
    status: 'completed',
    timeRange: '2026-03-01 09:55 ~ 2026-03-01 10:05',
    interface: 'eth0',
    bpf: 'tcp port 443 and host api.example.com',
    result: {
      size: '120 MB',
      packetCount: 185432,
      duration: '10 分钟',
    },
    logs: [
      '2026-03-01T10:00:00Z create forensics task FOR-20240001',
      '2026-03-01T10:00:02Z start capture on eth0',
      '2026-03-01T10:05:02Z stop capture, writing PCAP',
      '2026-03-01T10:05:32Z task completed successfully',
    ].join('\n'),
    timeline: [
      {
        time: '2026-03-01 10:00:00',
        title: '任务创建',
        detail: '由事件 INC-20240030 发起的取证请求。',
        type: 'info',
      },
      {
        time: '2026-03-01 10:00:02',
        title: '开始抓包',
        detail: '在接口 eth0 上启动 tcpdump，应用 BPF 过滤。',
        type: 'primary',
      },
      {
        time: '2026-03-01 10:05:02',
        title: '结束抓包',
        detail: '停止抓包并开始写入 PCAP 文件。',
        type: 'primary',
      },
      {
        time: '2026-03-01 10:05:32',
        title: '任务完成',
        detail: 'PCAP 文件已生成，可供下载和离线分析。',
        type: 'success',
      },
    ],
  }
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

.card-block {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 500;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.log-block {
  margin: 0;
  padding: 8px;
  border-radius: 4px;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
}

.timeline-title {
  font-size: 13px;
  margin-bottom: 2px;
}

.timeline-desc {
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.link {
  color: #2563eb;
}
</style>


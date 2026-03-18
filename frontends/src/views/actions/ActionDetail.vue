<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>动作详情 {{ action.id }}</h2>
      <p>查看动作执行详情、状态时间线和回滚信息。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- 动作基本信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>动作基本信息</span>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="动作 ID">
              {{ action.id }}
            </el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link
                class="link"
                :to="{ name: 'incident-detail', params: { id: action.incidentId } }"
              >
                {{ action.incidentId }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="动作类型">
              {{ action.typeLabel }}
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <el-tag :type="statusTagType(action.status)" size="small">
                {{ statusLabel(action.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="执行时间">
              {{ action.executedAt }}
            </el-descriptions-item>
            <el-descriptions-item label="执行耗时">
              {{ action.latencyMs }} ms
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 执行参数 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>执行参数</span>
            </div>
          </template>
          <pre class="mono-block">{{ action.params }}</pre>
        </el-card>

        <!-- 执行结果详情 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>执行结果详情</span>
            </div>
          </template>
          <p>{{ action.resultDetail }}</p>
        </el-card>

        <!-- 执行日志 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>执行日志</span>
            </div>
          </template>
          <pre class="log-block">{{ action.logs }}</pre>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 状态时间线 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>执行状态时间线</span>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in action.timeline"
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

        <!-- 回滚操作区 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>回滚操作</span>
            </div>
          </template>
          <p class="muted">
            当前为前端模拟，后续会调用 `/api/actions/:id/rollback` 触发真实回滚。
          </p>
          <el-button
            type="warning"
            :disabled="!canRollback"
            @click="doRollback"
          >
            触发回滚
          </el-button>
          <p class="muted" style="margin-top: 8px">
            只有执行成功且支持回滚的动作才允许回滚，回滚后状态会变为「已回滚」。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const actionId = String(route.params.id || 'ACT-20240001')

const action = ref(buildMockAction(actionId))

const canRollback = computed(
  () => action.value.status === 'success' && action.value.supportRollback && !action.value.rolledBack,
)

function doRollback() {
  if (!canRollback.value) return
  action.value.status = 'rolled_back'
  action.value.rolledBack = true
  action.value.timeline.push({
    time: new Date().toLocaleString(),
    title: '触发回滚（示例）',
    detail: '已在前端模拟执行回滚，请接入真实接口后替换。',
    type: 'warning',
  })
  ElMessage.success('已触发回滚（假操作）')
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

function buildMockAction(id) {
  return {
    id,
    incidentId: 'INC-20240005',
    typeLabel: '封禁 IP',
    status: 'success',
    executedAt: '2026-03-01 10:15:23',
    latencyMs: 800,
    supportRollback: true,
    rolledBack: false,
    params: JSON.stringify(
      {
        ip: '203.0.113.42',
        duration: '24h',
        reason: '疑似 SQL 注入多次攻击',
      },
      null,
      2,
    ),
    resultDetail: '已在边缘 WAF 和核心防火墙上同步封禁策略。',
    logs: [
      '2026-03-01T10:15:23.000Z start action block-ip for 203.0.113.42',
      '2026-03-01T10:15:23.200Z update waf-edge success',
      '2026-03-01T10:15:23.500Z update core-firewall success',
      '2026-03-01T10:15:23.800Z action completed with status=success',
    ].join('\n'),
    timeline: [
      {
        time: '2026-03-01 10:15:23',
        title: '创建动作任务',
        detail: '由策略「默认 Web 防护」自动创建封禁动作。',
        type: 'info',
      },
      {
        time: '2026-03-01 10:15:23',
        title: '开始执行',
        detail: '开始在 WAF 集群上下发封禁规则。',
        type: 'primary',
      },
      {
        time: '2026-03-01 10:15:23',
        title: '执行完成',
        detail: '所有目标节点更新成功，动作标记为已完成。',
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

.mono-block {
  margin: 0;
  padding: 8px;
  border-radius: 4px;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
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

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.link {
  color: #2563eb;
}
</style>


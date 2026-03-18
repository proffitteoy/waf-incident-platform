<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>策略列表</h2>
      <p>管理安全策略配置，包括风险阈值和自动动作规则。</p>
    </header>

    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar">
        <div class="left">
          <el-button type="primary" @click="goNewPolicy">
            新增策略
          </el-button>
        </div>
        <div class="right">
          <el-switch
            v-model="showOnlyEnabled"
            active-text="仅显示启用"
          />
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="filteredPolicies" border stripe style="width: 100%">
        <el-table-column prop="name" label="策略名称" min-width="180" />
        <el-table-column prop="type" label="策略类型" width="140" />
        <el-table-column label="风险等级阈值" min-width="220">
          <template #default="{ row }">
            低 {{ row.thresholds.low }} ／ 中 {{ row.thresholds.medium }} ／ 高 {{ row.thresholds.high }}
          </template>
        </el-table-column>
        <el-table-column label="自动动作配置" min-width="220">
          <template #default="{ row }">
            <span class="muted">
              高：{{ row.actions.high }}；中：{{ row.actions.medium }}；低：{{ row.actions.low }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goEdit(row)">
              编辑
            </el-button>
            <el-button size="small" text @click="toggleEnable(row)">
              {{ row.enabled ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" text type="danger" @click="deletePolicy(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

const showOnlyEnabled = ref(false)
const policies = ref(createMockPolicies())

const filteredPolicies = computed(() => {
  if (!showOnlyEnabled.value) return policies.value
  return policies.value.filter((p) => p.enabled)
})

function goNewPolicy() {
  router.push({ name: 'policy-new' })
}

function goEdit(row) {
  router.push({ name: 'policy-edit', params: { id: row.id } })
}

function toggleEnable(row) {
  row.enabled = !row.enabled
  ElMessage.success(`策略「${row.name}」已${row.enabled ? '启用' : '禁用'}（假数据）`)
}

function deletePolicy(row) {
  ElMessageBox.confirm(
    `确定要删除策略「${row.name}」吗？该操作仅为前端演示，不会影响真实配置。`,
    '删除策略',
    { type: 'warning' },
  )
    .then(() => {
      policies.value = policies.value.filter((p) => p.id !== row.id)
      ElMessage.success('策略已删除（假数据）')
    })
    .catch(() => {})
}

function createMockPolicies() {
  return [
    {
      id: 'policy-1',
      name: '默认 Web 攻击防护',
      type: 'WAF',
      thresholds: { low: 10, medium: 30, high: 70 },
      actions: {
        low: '仅告警',
        medium: '告警 + 人工审批动作',
        high: '自动封禁 IP + 审批后持久化规则',
      },
      enabled: true,
    },
    {
      id: 'policy-2',
      name: '登录暴力破解防护',
      type: 'Auth',
      thresholds: { low: 5, medium: 15, high: 40 },
      actions: {
        low: '提高验证码频率',
        medium: '临时封禁账户 10 分钟',
        high: '封禁 IP 段 + 通知安全团队',
      },
      enabled: true,
    },
    {
      id: 'policy-3',
      name: '后台管理接口加固',
      type: 'Admin API',
      thresholds: { low: 1, medium: 5, high: 15 },
      actions: {
        low: '记录审计日志',
        medium: '触发 LLM 深度分析',
        high: '自动关闭相关入口并创建事件',
      },
      enabled: false,
    },
  ]
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

.toolbar-card {
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-card {
  margin-top: 8px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}
</style>


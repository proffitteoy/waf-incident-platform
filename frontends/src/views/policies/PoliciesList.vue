<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>策略列表</h2>
      <p>管理安全策略配置，包括风险阈值和自动动作规则。</p>
    </header>

    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar">
        <el-switch v-model="showOnlyEnabled" active-text="仅显示启用" />
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="filteredPolicies" border stripe style="width: 100%">
        <el-table-column prop="name" label="策略名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="低风险阈值" width="120" align="center">
          <template #default="{ row }">{{ row.risk_threshold_low }}</template>
        </el-table-column>
        <el-table-column label="高风险阈值" width="120" align="center">
          <template #default="{ row }">{{ row.risk_threshold_high }}</template>
        </el-table-column>
        <el-table-column label="低风险动作" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatActions(row.low_risk_actions) }}</template>
        </el-table-column>
        <el-table-column label="高风险动作" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ formatActions(row.high_risk_actions) }}</template>
        </el-table-column>
        <el-table-column label="默认 TTL（秒）" width="140" align="center">
          <template #default="{ row }">{{ row.default_ttl_seconds }}</template>
        </el-table-column>
        <el-table-column label="启用状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="160">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="goEdit(row)">编辑</el-button>
            <el-button size="small" text :loading="row._toggling" @click="toggleEnable(row)">
              {{ row.is_active ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { PoliciesApi } from '../../api/policies'

const router = useRouter()
const loading = ref(false)
const showOnlyEnabled = ref(false)
const policies = ref([])

const filteredPolicies = computed(() => {
  if (!showOnlyEnabled.value) return policies.value
  return policies.value.filter((p) => p.is_active)
})

function goEdit(row) {
  router.push({ name: 'policy-edit', params: { id: row.id } })
}

async function toggleEnable(row) {
  row._toggling = true
  try {
    await PoliciesApi.update(row.id, {
      risk_threshold_low: row.risk_threshold_low,
      risk_threshold_high: row.risk_threshold_high,
      low_risk_actions: Array.isArray(row.low_risk_actions) ? row.low_risk_actions : [],
      high_risk_actions: Array.isArray(row.high_risk_actions) ? row.high_risk_actions : [],
      default_ttl_seconds: row.default_ttl_seconds,
      is_active: !row.is_active,
    })
    row.is_active = !row.is_active
    ElMessage.success(`策略「${row.name}」已${row.is_active ? '启用' : '禁用'}`)
  } catch (error) {
    ElMessage.error(error?.message || '操作失败')
  } finally {
    row._toggling = false
  }
}

function formatActions(actions) {
  if (Array.isArray(actions)) return actions.join('、') || '-'
  return '-'
}

async function loadPolicies() {
  loading.value = true
  try {
    const result = await PoliciesApi.list()
    policies.value = Array.isArray(result?.items) ? result.items : []
  } catch (error) {
    ElMessage.error(`加载策略列表失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadPolicies)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.toolbar-card { margin-bottom: 12px; }
.toolbar { display: flex; justify-content: flex-end; align-items: center; }
.table-card { margin-top: 8px; }
</style>

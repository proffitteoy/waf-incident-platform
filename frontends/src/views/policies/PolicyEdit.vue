<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>编辑策略 {{ form.name || route.params.id }}</h2>
      <p>修改策略的风险阈值、动作规则和启用状态。</p>
    </header>

    <el-skeleton v-if="isLoading" animated :rows="6" />

    <el-result
      v-else-if="loadError"
      icon="error"
      title="策略加载失败"
      :sub-title="loadError"
    >
      <template #extra>
        <el-button type="primary" @click="loadPolicy">重试</el-button>
      </template>
    </el-result>

    <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="140px" class="policy-form">
      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header"><span>策略基本信息</span></div>
        </template>
        <el-form-item label="策略名称">
          <span>{{ form.name }}</span>
          <span class="muted" style="margin-left: 8px">（策略名称不可修改）</span>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.is_active" active-text="已启用" inactive-text="未启用" />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header"><span>风险阈值</span></div>
        </template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="低风险阈值" prop="risk_threshold_low">
              <el-input-number v-model="form.risk_threshold_low" :min="0" :max="form.risk_threshold_high - 1" style="width: 180px" />
              <span class="muted" style="margin-left: 8px">分值低于此阈值视为低风险</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="高风险阈值" prop="risk_threshold_high">
              <el-input-number v-model="form.risk_threshold_high" :min="form.risk_threshold_low + 1" style="width: 180px" />
              <span class="muted" style="margin-left: 8px">分值高于此阈值视为高风险</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="默认 TTL（秒）" prop="default_ttl_seconds">
          <el-input-number v-model="form.default_ttl_seconds" :min="60" style="width: 180px" />
          <span class="muted" style="margin-left: 8px">动作的默认有效时长</span>
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header"><span>动作规则</span></div>
        </template>
        <el-form-item label="低风险动作" prop="low_risk_actions">
          <div class="tag-input">
            <el-tag
              v-for="(action, idx) in form.low_risk_actions"
              :key="idx"
              closable
              @close="removeAction('low', idx)"
            >
              {{ action }}
            </el-tag>
            <el-select
              v-model="newLowAction"
              placeholder="添加动作"
              style="width: 140px"
              @change="addAction('low')"
            >
              <el-option v-for="opt in actionOptions" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="高风险动作" prop="high_risk_actions">
          <div class="tag-input">
            <el-tag
              v-for="(action, idx) in form.high_risk_actions"
              :key="idx"
              closable
              @close="removeAction('high', idx)"
            >
              {{ action }}
            </el-tag>
            <el-select
              v-model="newHighAction"
              placeholder="添加动作"
              style="width: 140px"
              @change="addAction('high')"
            >
              <el-option v-for="opt in actionOptions" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </div>
        </el-form-item>
      </el-card>

      <div class="form-actions">
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
        <el-button @click="goBack">取消</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { PoliciesApi } from '../../api/policies'

const route = useRoute()
const router = useRouter()
const policyId = String(route.params.id || '')

const formRef = ref()
const isLoading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const newLowAction = ref('')
const newHighAction = ref('')

const actionOptions = ['rate_limit', 'block', 'challenge']

const form = reactive({
  name: '',
  risk_threshold_low: 20,
  risk_threshold_high: 60,
  low_risk_actions: [],
  high_risk_actions: [],
  default_ttl_seconds: 1800,
  is_active: true,
})

const rules = {
  risk_threshold_low: [{ required: true, type: 'number', message: '请输入低风险阈值', trigger: 'blur' }],
  risk_threshold_high: [{ required: true, type: 'number', message: '请输入高风险阈值', trigger: 'blur' }],
  default_ttl_seconds: [{ required: true, type: 'number', message: '请输入 TTL', trigger: 'blur' }],
}

function addAction(level) {
  const val = level === 'low' ? newLowAction.value : newHighAction.value
  if (!val) return
  const arr = level === 'low' ? form.low_risk_actions : form.high_risk_actions
  if (!arr.includes(val)) arr.push(val)
  if (level === 'low') newLowAction.value = ''
  else newHighAction.value = ''
}

function removeAction(level, idx) {
  const arr = level === 'low' ? form.low_risk_actions : form.high_risk_actions
  arr.splice(idx, 1)
}

async function loadPolicy() {
  if (!policyId) {
    loadError.value = '缺少策略 ID'
    isLoading.value = false
    return
  }
  isLoading.value = true
  loadError.value = ''
  try {
    const data = await PoliciesApi.detail(policyId)
    form.name = data.name || ''
    form.risk_threshold_low = data.risk_threshold_low ?? 20
    form.risk_threshold_high = data.risk_threshold_high ?? 60
    form.low_risk_actions = Array.isArray(data.low_risk_actions) ? [...data.low_risk_actions] : []
    form.high_risk_actions = Array.isArray(data.high_risk_actions) ? [...data.high_risk_actions] : []
    form.default_ttl_seconds = data.default_ttl_seconds ?? 1800
    form.is_active = data.is_active ?? true
  } catch (error) {
    loadError.value = error?.message || '请求失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  if (form.risk_threshold_high <= form.risk_threshold_low) {
    ElMessage.warning('高风险阈值必须大于低风险阈值')
    return
  }

  submitting.value = true
  try {
    await PoliciesApi.update(policyId, {
      risk_threshold_low: form.risk_threshold_low,
      risk_threshold_high: form.risk_threshold_high,
      low_risk_actions: form.low_risk_actions,
      high_risk_actions: form.high_risk_actions,
      default_ttl_seconds: form.default_ttl_seconds,
      is_active: form.is_active,
    })
    ElMessage.success('策略配置已保存')
    router.push({ name: 'policies' })
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push({ name: 'policies' })
}

onMounted(loadPolicy)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.policy-form { max-width: 900px; }
.card-block { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.form-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.muted { color: var(--muted-color); font-size: 12px; }
.tag-input { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
</style>

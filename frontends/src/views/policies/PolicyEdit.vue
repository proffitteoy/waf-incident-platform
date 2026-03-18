<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>{{ isNew ? '新建策略' : '编辑策略 ' + route.params.id }}</h2>
      <p>配置策略基本信息、风险阈值和自动动作规则（当前为假数据表单）。</p>
    </header>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      class="policy-form"
    >
      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>策略基本信息</span>
          </div>
        </template>

        <el-form-item label="策略名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：默认 Web 防护策略" />
        </el-form-item>
        <el-form-item label="策略描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="简要说明策略用途、适用范围和注意事项。"
          />
        </el-form-item>
        <el-form-item label="策略类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择类型" style="width: 240px">
            <el-option label="WAF" value="WAF" />
            <el-option label="Auth" value="Auth" />
            <el-option label="Admin API" value="Admin API" />
          </el-select>
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>风险等级阈值</span>
          </div>
        </template>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="低风险阈值" prop="thresholds.low">
              <el-input-number v-model="form.thresholds.low" :min="0" :max="100" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="中风险阈值" prop="thresholds.medium">
              <el-input-number v-model="form.thresholds.medium" :min="0" :max="100" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="高风险阈值" prop="thresholds.high">
              <el-input-number v-model="form.thresholds.high" :min="0" :max="100" />
            </el-form-item>
          </el-col>
        </el-row>
        <p class="muted">
          阈值仅在前端演示使用，后续会通过 `/api/policies` 落库，与 LLM 风险分值等打通。
        </p>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>动作规则配置</span>
          </div>
        </template>

        <el-table :data="form.actionMappings" border size="small">
          <el-table-column prop="riskLevel" label="风险等级" width="100" />
          <el-table-column label="动作类型" min-width="180">
            <template #default="{ row }">
              <el-select v-model="row.action" style="width: 180px">
                <el-option label="仅告警" value="alert" />
                <el-option label="封禁 IP" value="block-ip" />
                <el-option label="限流" value="rate-limit" />
                <el-option label="修改规则" value="update-rule" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="是否需要审批" width="140">
            <template #default="{ row }">
              <el-switch v-model="row.requireApproval" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="200">
            <template #default="{ row }">
              <el-input v-model="row.comment" placeholder="例如：高风险必须走审批" />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <div class="form-actions">
        <el-button type="primary" @click="handleSubmit">
          保存
        </el-button>
        <el-button @click="goBack">
          取消
        </el-button>
        <span class="muted">
          表单数据当前只保存在前端内存中，方便联调 API 时直接接入。
        </span>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'policy-new')

const formRef = ref()

const form = reactive({
  name: isNew.value ? '' : '默认 Web 防护策略',
  description: isNew.value ? '' : '示例：用于保护 Web 入口免受常见攻击。',
  type: isNew.value ? '' : 'WAF',
  thresholds: {
    low: 10,
    medium: 30,
    high: 70,
  },
  actionMappings: [
    {
      riskLevel: '低',
      action: 'alert',
      requireApproval: false,
      comment: '仅记录日志并提示。',
    },
    {
      riskLevel: '中',
      action: 'rate-limit',
      requireApproval: true,
      comment: '限流 + 审批后执行进一步动作。',
    },
    {
      riskLevel: '高',
      action: 'block-ip',
      requireApproval: true,
      comment: '封禁 IP 或更新规则前须审批。',
    },
  ],
})

const rules = {
  name: [{ required: true, message: '请输入策略名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择策略类型', trigger: 'change' }],
}

function handleSubmit() {
  if (!formRef.value) return
  formRef.value.validate((valid) => {
    if (!valid) return
    ElMessage.success('策略配置已保存（假数据，未调用后端）')
    router.push({ name: 'policies' })
  })
}

function goBack() {
  router.push({ name: 'policies' })
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

.policy-form {
  max-width: 980px;
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

.form-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}
</style>


<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>新建取证任务</h2>
      <p>创建新的网络取证抓包任务，填写时间范围、接口和过滤条件。</p>
    </header>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      class="forensics-form"
    >
      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>基础信息</span>
          </div>
        </template>

        <el-form-item label="关联事件 ID">
          <el-input
            v-model="form.incidentId"
            placeholder="可选，例如：INC-20240001"
          />
        </el-form-item>
        <el-form-item label="抓包时间范围" prop="timeRange">
          <el-date-picker
            v-model="form.timeRange"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="网卡接口" prop="interface">
          <el-input
            v-model="form.interface"
            placeholder="例如：eth0"
            style="width: 220px"
          />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>BPF 过滤和描述</span>
          </div>
        </template>

        <el-form-item label="BPF 过滤表达式" prop="bpf">
          <el-input
            v-model="form.bpf"
            type="textarea"
            :rows="2"
            placeholder='例如：tcp port 443 and host api.example.com'
          />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="说明本次取证的目的和背景，方便后续审计。"
          />
        </el-form-item>
      </el-card>

      <div class="form-actions">
        <el-button type="primary" @click="handleSubmit">
          提交任务
        </el-button>
        <el-button @click="handleReset">
          重置
        </el-button>
        <span class="muted">
          当前提交后仅在前端提示「已创建任务」，后续接入 `/api/forensics` 后将真正落库并排队执行。
        </span>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'

const formRef = ref()

const form = reactive({
  incidentId: '',
  timeRange: [],
  interface: '',
  bpf: '',
  description: '',
})

const rules = {
  timeRange: [{ required: true, message: '请选择时间范围', trigger: 'change' }],
  interface: [{ required: true, message: '请输入网卡接口', trigger: 'blur' }],
  bpf: [{ required: true, message: '请输入 BPF 过滤表达式', trigger: 'blur' }],
}

function handleSubmit() {
  if (!formRef.value) return
  formRef.value.validate((valid) => {
    if (!valid) return
    ElMessage.success('已创建取证任务（假数据，未调用后端）')
  })
}

function handleReset() {
  form.incidentId = ''
  form.timeRange = []
  form.interface = ''
  form.bpf = ''
  form.description = ''
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

.forensics-form {
  max-width: 960px;
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


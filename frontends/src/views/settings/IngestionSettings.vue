<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>日志采集配置</h2>
      <p>配置 WAF 日志采集参数、采集频率和解析器。</p>
    </header>

    <el-card shadow="never" class="card-block">
      <template #header>
        <div class="card-header">
          <span>采集器状态</span>
        </div>
      </template>
      <p>
        当前采集器状态：
        <el-tag type="success" size="small">运行中（示例）</el-tag>
      </p>
      <p class="muted">
        实际状态将由 `/api/ingestion/status` 返回，这里为前端假数据展示。
      </p>
    </el-card>

    <el-form
      ref="formRef"
      :model="form"
      label-width="120px"
      class="ingestion-form"
    >
      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>日志源配置</span>
          </div>
        </template>

        <el-form-item label="WAF 类型">
          <el-select v-model="form.wafType" style="width: 220px">
            <el-option label="Nginx + ModSecurity" value="nginx-modsec" />
            <el-option label="Cloudflare WAF" value="cloudflare" />
            <el-option label="AWS WAF" value="aws-waf" />
          </el-select>
        </el-form-item>
        <el-form-item label="日志文件路径">
          <el-input
            v-model="form.logPath"
            placeholder="/var/log/nginx/waf.log"
          />
        </el-form-item>
        <el-form-item label="采集频率（秒）">
          <el-input-number v-model="form.intervalSeconds" :min="5" :max="300" />
        </el-form-item>
      </el-card>

      <el-card shadow="never" class="card-block">
        <template #header>
          <div class="card-header">
            <span>解析器配置</span>
          </div>
        </template>

        <el-form-item label="解析器类型">
          <el-select v-model="form.parserType" style="width: 220px">
            <el-option label="JSON" value="json" />
            <el-option label="Nginx Combined" value="nginx-combined" />
          </el-select>
        </el-form-item>
        <el-form-item label="额外字段映射">
          <el-input
            v-model="form.fieldMapping"
            type="textarea"
            :rows="3"
            placeholder='例如：{"client_ip": "remote_addr", "status": "status"}'
          />
        </el-form-item>
      </el-card>

      <div class="form-actions">
        <el-button type="primary" @click="handleSave">
          保存配置
        </el-button>
        <span class="muted">
          保存后会调用 `/api/ingestion/config`（暂未接入），当前仅在前端提示成功。
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
  wafType: 'nginx-modsec',
  logPath: '/var/log/nginx/waf.log',
  intervalSeconds: 30,
  parserType: 'json',
  fieldMapping: '{"client_ip": "remote_addr", "status": "status"}',
})

function handleSave() {
  if (!formRef.value) return
  ElMessage.success('日志采集配置已保存（假数据）')
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

.ingestion-form {
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


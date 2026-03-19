<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>系统设置</h2>
      <p>配置 LLM、Redis、PostgreSQL 等全局参数并查看系统健康状态。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- LLM 配置 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>LLM 配置</span>
            </div>
          </template>

          <el-form :model="llm" label-width="120px">
            <el-form-item label="API Key">
              <el-input
                v-model="llm.apiKey"
                type="password"
                placeholder="仅前端示例，不会真实保存"
              />
            </el-form-item>
            <el-form-item label="Base URL">
              <el-input v-model="llm.baseUrl" placeholder="https://llm.example.com/v1" />
            </el-form-item>
            <el-form-item label="模型">
              <el-select v-model="llm.model" style="width: 260px">
                <el-option label="sec-llm-1" value="sec-llm-1" />
                <el-option label="gpt-4.5-secure" value="gpt-4.5-secure" />
              </el-select>
            </el-form-item>
            <el-form-item label="超时（秒）">
              <el-input-number v-model="llm.timeout" :min="1" :max="120" />
            </el-form-item>
            <el-form-item label="重试次数">
              <el-input-number v-model="llm.retries" :min="0" :max="10" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveLlm">
                保存 LLM 配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 系统健康状态 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>系统健康状态</span>
            </div>
          </template>
          <ul class="health-list">
            <li>
              <span>Redis 连接状态</span>
              <el-tag type="success" size="small">已连接（示例）</el-tag>
            </li>
            <li>
              <span>PostgreSQL 连接状态</span>
              <el-tag type="success" size="small">正常（示例）</el-tag>
            </li>
            <li>
              <span>消息队列</span>
              <el-tag type="info" size="small">未启用</el-tag>
            </li>
          </ul>
          <p class="muted">
            实际健康状态将由 `/api/health` 返回，这里为前端占位显示。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'

const llm = reactive({
  apiKey: '',
  baseUrl: 'https://llm.example.com/v1',
  model: 'sec-llm-1',
  timeout: 30,
  retries: 3,
})

function saveLlm() {
  ElMessage.success('LLM 配置已保存（假数据）')
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

.health-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
}

.health-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}
</style>


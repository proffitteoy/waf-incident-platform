<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>LLM 报告详情 {{ report.id }}</h2>
      <p>查看大模型对安全事件的结构化分析结论与原始 Prompt。</p>
    </header>

    <el-row :gutter="16">
      <el-col :span="16">
        <!-- 报告元信息 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>报告元信息</span>
            </div>
          </template>
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="报告 ID">
              {{ report.id }}
            </el-descriptions-item>
            <el-descriptions-item label="关联事件 ID">
              <router-link
                class="link"
                :to="{ name: 'incident-detail', params: { id: report.incidentId } }"
              >
                {{ report.incidentId }}
              </router-link>
            </el-descriptions-item>
            <el-descriptions-item label="生成时间">
              {{ report.createdAt }}
            </el-descriptions-item>
            <el-descriptions-item label="模型版本">
              {{ report.modelVersion }}
            </el-descriptions-item>
            <el-descriptions-item label="分析耗时">
              {{ report.latencyMs }} ms
            </el-descriptions-item>
            <el-descriptions-item label="Token 使用量">
              prompt {{ report.tokens.prompt }} / completion {{ report.tokens.completion }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 结构化分析结果 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>分析结果</span>
            </div>
          </template>

          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="威胁类型">
              {{ report.analysis.threatType }}
            </el-descriptions-item>
            <el-descriptions-item label="攻击模式">
              {{ report.analysis.attackPattern }}
            </el-descriptions-item>
            <el-descriptions-item label="影响评估">
              {{ report.analysis.impact }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="section">
            <h4>建议动作</h4>
            <ul>
              <li v-for="(item, idx) in report.analysis.recommendedActions" :key="idx">
                {{ item }}
              </li>
            </ul>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <!-- 原始 Prompt 展示 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>原始 Prompt（调试用）</span>
              <el-button size="small" text @click="togglePrompt">
                {{ showPrompt ? '收起' : '展开' }}
              </el-button>
            </div>
          </template>

          <p class="muted">
            当前为前端假数据示例，后续会从 `/api/llm-reports/:id` 返回模型调用上下文。
          </p>

          <el-collapse-transition>
            <pre v-if="showPrompt" class="prompt-block">
{{ report.prompt }}
            </pre>
          </el-collapse-transition>
        </el-card>

        <!-- 关联链接 -->
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>关联信息</span>
            </div>
          </template>
          <p>
            关联事件：
            <router-link
              class="link"
              :to="{ name: 'incident-detail', params: { id: report.incidentId } }"
            >
              {{ report.incidentId }}
            </router-link>
          </p>
          <p class="muted">
            后续可以在这里补充更多上下游链路，例如审批单、动作记录等。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const reportId = String(route.params.id || 'LLM-20240001')

const report = ref(buildMockReport(reportId))
const showPrompt = ref(false)

function togglePrompt() {
  showPrompt.value = !showPrompt.value
}

function buildMockReport(id) {
  const baseNum = Number(id.replace(/\D/g, '')) || 20240001
  const models = ['llm-sec-1.0', 'llm-sec-1.1', 'llm-sec-2.0']
  const modelVersion = models[baseNum % models.length]

  return {
    id,
    incidentId: `INC-${baseNum}`,
    createdAt: '2026-03-01 09:01:23',
    modelVersion,
    latencyMs: 1234,
    tokens: {
      prompt: 1024,
      completion: 512,
    },
    analysis: {
      threatType: 'SQL 注入（示例）',
      attackPattern:
        '多次针对订单接口的可疑请求，参数中包含堆叠查询、注释符号等典型 SQLi 特征。',
      impact:
        '如果攻击成功，可能导致订单和用户基础信息泄露。当前尚未发现成功注入的证据，但风险等级建议评定为高。',
      recommendedActions: [
        '对相关 WAF 规则进行加强，增加对堆叠查询和 UNION 关键字的拦截阈值。',
        '对异常 IP 段进行短期封禁，并观察后续流量模式。',
        '排查数据库访问日志，确认是否存在异常查询或数据导出行为。',
      ],
    },
    prompt: createMockPrompt(id),
  }
}

function createMockPrompt(id) {
  return [
    'SYSTEM: 你是一个资深安全分析专家，请根据提供的 Web 流量日志和应用上下文，判断是否存在攻击行为，并给出结构化结论。',
    '',
    `CONTEXT: incident_id=${id}`,
    '- 应用：example-order-service',
    '- 入口：/api/v1/orders',
    '',
    'LOG SNIPPET:',
    '2026-03-01T08:23:45Z client_ip=203.0.113.42 method=POST path="/api/v1/orders"',
    'body="id=1; DROP TABLE users; --"',
    '',
    'TASK:',
    '1. 判断是否存在攻击及攻击类型；',
    '2. 说明攻击大致思路与模式；',
    '3. 评估潜在影响；',
    '4. 给出 2-4 条可操作性的防护建议。',
  ].join('\n')
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

.section {
  margin-top: 12px;
}

.section h4 {
  margin: 0 0 6px;
  font-size: 13px;
}

.section ul {
  margin: 0 0 4px 18px;
  padding: 0;
  font-size: 13px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}

.prompt-block {
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: #020617;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
}

.link {
  color: #2563eb;
}
</style>

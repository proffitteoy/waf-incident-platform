<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <div>
        <h1 class="title">安全事件概览</h1>
        <p class="subtitle">
          快速了解今日安全态势、风险分布和关键系统健康状态。
        </p>
      </div>
      <div class="header-right">
        <el-tag type="success" effect="dark" size="large">
          实时监控 · WAF 事件处理平台
        </el-tag>
      </div>
    </header>

    <section class="stats-section">
      <el-row :gutter="20">
        <el-col :xs="12" :sm="12" :md="6" v-for="card in statCards" :key="card.key">
          <div class="stat-card" :class="card.type">
            <div class="stat-label">{{ card.label }}</div>
            <div class="stat-value">
              {{ card.value }}
            </div>
            <div class="stat-footer">
              <span :class="['trend', card.trendType]">
                {{ card.trendPrefix }} {{ card.trendValue }}
              </span>
              <span class="trend-sub">vs 昨日</span>
            </div>
          </div>
        </el-col>
      </el-row>
    </section>

    <section class="charts-section">
      <el-row :gutter="20">
        <el-col :xs="24" :md="16">
          <div class="panel">
            <div class="panel-header">
              <span>事件趋势</span>
              <el-radio-group v-model="trendRange" size="small">
                <el-radio-button label="7d">近 7 天</el-radio-button>
                <el-radio-button label="30d">近 30 天</el-radio-button>
              </el-radio-group>
            </div>
            <div class="panel-body chart-placeholder">
              <span class="chart-placeholder-text">事件趋势图（待接入 ECharts）</span>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :md="8">
          <div class="panel">
            <div class="panel-header">
              <span>风险等级分布</span>
            </div>
            <div class="panel-body chart-placeholder">
              <span class="chart-placeholder-text">风险分布饼图（待接入 ECharts）</span>
              <ul class="risk-legend">
                <li v-for="item in riskDistribution" :key="item.level">
                  <span class="dot" :class="item.level" />
                  <span class="text">{{ item.label }}</span>
                  <span class="value">{{ item.value }}</span>
                </li>
              </ul>
            </div>
          </div>
        </el-col>
      </el-row>
    </section>

    <section class="bottom-section">
      <el-row :gutter="20">
        <el-col :xs="24" :md="16">
          <div class="panel">
            <div class="panel-header">
              <span>最近事件（Top 10）</span>
              <el-link type="primary" @click="goIncidents">查看全部事件</el-link>
            </div>
            <div class="panel-body">
              <el-table :data="recentIncidents" size="small" @row-click="handleRowClick">
                <el-table-column prop="id" label="事件ID" width="140" />
                <el-table-column prop="timestamp" label="发生时间" width="180" />
                <el-table-column prop="source_ip" label="来源IP" width="140" />
                <el-table-column prop="risk_level" label="风险等级" width="100">
                  <template #default="scope">
                    <el-tag :type="riskTagType(scope.row.risk_level)" size="small" effect="dark">
                      {{ riskLabel(scope.row.risk_level) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="120">
                  <template #default="scope">
                    <el-tag size="small">
                      {{ statusLabel(scope.row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :md="8">
          <div class="panel">
            <div class="panel-header">
              <span>系统健康状态</span>
            </div>
            <div class="panel-body health-list">
              <div v-for="item in healthItems" :key="item.key" class="health-item">
                <div class="left">
                  <span class="dot" :class="item.status" />
                  <span class="name">{{ item.label }}</span>
                </div>
                <div class="right">
                  <el-tag
                    :type="item.status === 'ok' ? 'success' : item.status === 'warn' ? 'warning' : 'danger'"
                    size="small"
                  >
                    {{ item.statusLabel }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const statCards = ref([
  { key: 'today', label: '今日事件总数', value: 128, trendType: 'up', trendPrefix: '+', trendValue: '12.5%', type: 'primary' },
  { key: 'pending', label: '待处理事件', value: 34, trendType: 'up', trendPrefix: '+', trendValue: '5', type: 'warning' },
  { key: 'high', label: '高风险事件', value: 9, trendType: 'flat', trendPrefix: '≈', trendValue: '昨日', type: 'danger' },
  { key: 'approvals', label: '待审批动作', value: 6, trendType: 'down', trendPrefix: '-', trendValue: '2', type: 'info' },
])

const trendRange = ref('7d')

const riskDistribution = ref([
  { level: 'high', label: '高风险', value: 9 },
  { level: 'medium', label: '中风险', value: 32 },
  { level: 'low', label: '低风险', value: 87 },
])

const recentIncidents = ref([
  { id: 'INC-202503-0001', timestamp: '2025-03-09 14:32:10', source_ip: '192.168.0.12', risk_level: 'high', status: 'pending' },
  { id: 'INC-202503-0002', timestamp: '2025-03-09 13:58:42', source_ip: '10.0.5.21', risk_level: 'medium', status: 'analyzed' },
])

const healthItems = ref([
  { key: 'postgres', label: 'PostgreSQL', status: 'ok', statusLabel: '运行正常' },
  { key: 'redis', label: 'Redis', status: 'ok', statusLabel: '运行正常' },
  { key: 'llm', label: 'LLM 服务', status: 'warn', statusLabel: '延迟偏高' },
  { key: 'ingestion', label: '日志采集', status: 'error', statusLabel: '采集异常' },
])

const riskLabel = (level) => (level === 'high' ? '高' : level === 'medium' ? '中' : '低')
const riskTagType = (level) => (level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success')
const statusLabel = (status) => ({ pending: '待分析', analyzed: '已分析', processed: '已处理', closed: '已关闭' }[status] || status)

const handleRowClick = (row) => {
  router.push(`/incidents/${row.id}`)
}
const goIncidents = () => router.push('/incidents')
</script>

<style scoped>
.dashboard-page {
  padding: 24px 24px 32px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: var(--text-color);
}
.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}
.subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--muted-color);
}
.stat-card {
  border-radius: 8px;
  padding: 16px 18px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--muted-color);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
}
.stat-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 4px;
}
.trend.up {
  color: var(--muted-color);
}
.trend.down {
  color: var(--muted-color);
}
.trend.flat {
  color: var(--muted-color);
}
.trend-sub {
  color: #9ca3af;
}

.panel {
  border-radius: 8px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}
.panel-header {
  padding: 14px 18px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  font-size: 14px;
  font-weight: 600;
}
.panel-body {
  padding: 12px 16px 16px;
}
.chart-placeholder {
  position: relative;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-surface);
}
.chart-placeholder-text {
  font-size: 12px;
  color: var(--muted-color);
}
.risk-legend {
  margin-top: 16px;
  list-style: none;
  padding: 0;
  display: grid;
  row-gap: 8px;
}
.risk-legend li {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.risk-legend .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 8px;
}
.risk-legend .dot.high {
  background: var(--border-color);
}
.risk-legend .dot.medium {
  background: var(--border-color);
}
.risk-legend .dot.low {
  background: var(--border-color);
}
.risk-legend .text {
  flex: 1;
  font-size: 13px;
}
.risk-legend .value {
  font-size: 13px;
  color: var(--text-color);
}
.health-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.health-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.health-item .left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.health-item .dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
}
.health-item .dot.ok {
  background: #22c55e;
}
.health-item .dot.warn {
  background: #f97316;
}
.health-item .dot.error {
  background: #ef4444;
}
.health-item .name {
  font-size: 13px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 16px;
  }
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>


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
            <div class="panel-body">
              <div ref="trendChartRef" class="chart-container" />
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :md="8">
          <div class="panel">
            <div class="panel-header">
              <span>风险等级分布</span>
            </div>
            <div class="panel-body">
              <div ref="riskChartRef" class="chart-container small" />
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { DashboardApi } from '../../api/dashboard'

const router = useRouter()

let echarts

const POLL_INTERVAL_MS = 5000
const dashboardLoading = ref(false)
const dashboardError = ref('')
let pollingTimer = null
const resizeHandler = () => {
  if (trendChartInstance) trendChartInstance.resize()
  if (riskChartInstance) riskChartInstance.resize()
}

const statCards = ref([
  { key: 'today', label: '近窗口请求总数', value: 0, trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'primary' },
  { key: 'pending', label: 'WAF 命中事件', value: 0, trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'warning' },
  { key: 'high', label: '拦截数量', value: 0, trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'danger' },
  { key: 'approvals', label: '动作成功率', value: '0%', trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'info' },
])

const trendRange = ref('7d')

const trendChartRef = ref(null)
const riskChartRef = ref(null)

let trendChartInstance = null
let riskChartInstance = null
const trendSeries = ref({ labels: [], values: [] })

const riskDistribution = ref([
  { level: 'high', label: '高风险', value: 0 },
  { level: 'medium', label: '中风险', value: 0 },
  { level: 'low', label: '低风险', value: 0 },
])

const recentIncidents = ref([])

const healthItems = ref([
  { key: 'postgres', label: 'PostgreSQL', status: 'ok', statusLabel: '运行正常' },
  { key: 'redis', label: 'Redis', status: 'ok', statusLabel: '运行正常' },
  { key: 'llm', label: 'LLM 服务', status: 'warn', statusLabel: '状态未知' },
  { key: 'ingestion', label: '日志采集', status: 'warn', statusLabel: '等待采集' },
])

const riskLabel = (level) => (level === 'high' ? '高' : level === 'medium' ? '中' : '低')
const riskTagType = (level) => (level === 'high' ? 'danger' : level === 'medium' ? 'warning' : 'success')
const statusLabel = (status) => ({
  pending: '待分析',
  analyzed: '已分析',
  processed: '已处理',
  closed: '已关闭',
  deny: '已拦截',
  block: '已阻断',
  monitor: '监控',
  allow: '放行'
}[status] || status || '-')

const toRangeParam = () => (trendRange.value === '30d' ? '30d' : '7d')

const formatTimestamp = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-CN', { hour12: false })
}

const classifyRisk = (ruleScore) => {
  const score = Number(ruleScore || 0)
  if (score >= 8) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

const updateRiskDistribution = (events) => {
  const counts = { high: 0, medium: 0, low: 0 }
  events.forEach((event) => {
    counts[classifyRisk(event.rule_score)] += 1
  })

  riskDistribution.value = [
    { level: 'high', label: '高风险', value: counts.high },
    { level: 'medium', label: '中风险', value: counts.medium },
    { level: 'low', label: '低风险', value: counts.low },
  ]
}

const applyOverview = (overview) => {
  const summary = overview?.summary || {}
  const actionStats = overview?.action_stats || {}
  const totalActions = Number(actionStats.action_total || 0)
  const successActions = Number(actionStats.action_success || 0)
  const successRate = totalActions > 0 ? `${Math.round((successActions / totalActions) * 100)}%` : '0%'

  statCards.value = [
    { key: 'today', label: '近窗口请求总数', value: Number(summary.request_count || 0), trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'primary' },
    { key: 'pending', label: 'WAF 命中事件', value: Number(summary.waf_hits || 0), trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'warning' },
    { key: 'high', label: '拦截数量', value: Number(summary.blocked_count || 0), trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'danger' },
    { key: 'approvals', label: '动作成功率', value: successRate, trendType: 'flat', trendPrefix: '≈', trendValue: '实时', type: 'info' },
  ]
}

const applyTimeseries = (timeseries) => {
  const series = Array.isArray(timeseries?.series) ? timeseries.series : []
  trendSeries.value = {
    labels: series.map((item) => formatTimestamp(item.bucket)),
    values: series.map((item) => Number(item.value || 0)),
  }
}

const applyRecentEvents = (eventsResponse) => {
  const items = Array.isArray(eventsResponse?.items) ? eventsResponse.items : []
  recentIncidents.value = items.map((event) => ({
    id: `EVT-${event.id}`,
    timestamp: formatTimestamp(event.ts),
    source_ip: event.src_ip || '-',
    risk_level: classifyRisk(event.rule_score),
    status: event.waf_action || 'observed',
  }))
  updateRiskDistribution(items)
}

const refreshDashboard = async () => {
  dashboardLoading.value = true
  dashboardError.value = ''
  try {
    const range = toRangeParam()
    const [overview, timeseries, events] = await Promise.all([
      DashboardApi.overview({ range }),
      DashboardApi.timeseries({ metric: 'requests', range }),
      DashboardApi.latestEvents({ limit: 10, offset: 0 }),
    ])

    applyOverview(overview)
    applyTimeseries(timeseries)
    applyRecentEvents(events)

    healthItems.value = [
      { key: 'postgres', label: 'PostgreSQL', status: 'ok', statusLabel: '运行正常' },
      { key: 'redis', label: 'Redis', status: 'ok', statusLabel: '运行正常' },
      { key: 'llm', label: 'LLM 服务', status: 'warn', statusLabel: '状态未知' },
      { key: 'ingestion', label: '日志采集', status: 'ok', statusLabel: '采集中' },
    ]
  } catch (error) {
    dashboardError.value = error instanceof Error ? error.message : String(error)
    healthItems.value = [
      { key: 'postgres', label: 'PostgreSQL', status: 'warn', statusLabel: '状态未知' },
      { key: 'redis', label: 'Redis', status: 'warn', statusLabel: '状态未知' },
      { key: 'llm', label: 'LLM 服务', status: 'warn', statusLabel: '状态未知' },
      { key: 'ingestion', label: '日志采集', status: 'error', statusLabel: '拉取失败' },
    ]
  } finally {
    dashboardLoading.value = false
    updateTrendChart()
    updateRiskChart()
  }
}

const initCharts = () => {
  if (!echarts) return

  if (trendChartRef.value) {
    trendChartInstance = echarts.init(trendChartRef.value)
    updateTrendChart()
  }

  if (riskChartRef.value) {
    riskChartInstance = echarts.init(riskChartRef.value)
    updateRiskChart()
  }
}

const disposeCharts = () => {
  if (trendChartInstance) {
    trendChartInstance.dispose()
    trendChartInstance = null
  }
  if (riskChartInstance) {
    riskChartInstance.dispose()
    riskChartInstance = null
  }
}

const updateTrendChart = () => {
  if (!trendChartInstance) return
  const labels = trendSeries.value.labels.length > 0 ? trendSeries.value.labels : ['-']
  const values = trendSeries.value.values.length > 0 ? trendSeries.value.values : [0]
  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#9ca3af' } },
      axisLabel: { color: '#9ca3af' },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
    },
    series: [
      {
        name: '事件总数',
        type: 'line',
        smooth: true,
        data: values,
        areaStyle: {
          color: 'rgba(59,130,246,0.18)',
        },
        lineStyle: {
          color: '#3b82f6',
          width: 2,
        },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  })
}

const updateRiskChart = () => {
  if (!riskChartInstance) return
  riskChartInstance.setOption({
    tooltip: { trigger: 'item' },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        data: riskDistribution.value.map((item) => ({
          name: item.label,
          value: item.value,
        })),
      },
    ],
  })
}

watch(trendRange, () => {
  refreshDashboard()
})

onMounted(async () => {
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  initCharts()
  await refreshDashboard()
  pollingTimer = window.setInterval(refreshDashboard, POLL_INTERVAL_MS)
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
  window.removeEventListener('resize', resizeHandler)
  disposeCharts()
})

const handleRowClick = (row) => {
  if (row?.id) {
    router.push('/incidents')
  }
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
.chart-container {
  width: 100%;
  height: 260px;
}
.chart-container.small {
  height: 220px;
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


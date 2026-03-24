import {createRouter,createWebHistory} from "vue-router";


// 路由表
const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      {
        path: '/dashboard',
        name: 'dashboard',
        component: () => import('../views/dashboard/Dashboard.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: '/incidents',
        name: 'incidents',
        component: () => import('../views/incidents/IncidentsList.vue'),
        meta: { title: '事件列表' },
      },
      {
        path: '/incidents/:id',
        name: 'incident-detail',
        component: () => import('../views/incidents/IncidentDetail.vue'),
        meta: { title: '事件详情' },
      },
      {
        path: '/llm-reports',
        name: 'llm-reports',
        component: () => import('../views/llm/LLMReportsList.vue'),
        meta: { title: 'LLM 报告列表' },
      },
      {
        path: '/llm-reports/:id',
        name: 'llm-report-detail',
        component: () => import('../views/llm/LLMReportDetail.vue'),
        meta: { title: 'LLM 报告详情' },
      },
      {
        path: '/approvals',
        name: 'approvals',
        component: () => import('../views/approvals/ApprovalsList.vue'),
        meta: { title: '审批列表' },
      },
      {
        path: '/approvals/:id',
        name: 'approval-detail',
        component: () => import('../views/approvals/ApprovalDetail.vue'),
        meta: { title: '审批详情' },
      },
      {
        path: '/actions',
        name: 'actions',
        component: () => import('../views/actions/ActionsList.vue'),
        meta: { title: '动作列表' },
      },
      {
        path: '/actions/:id',
        name: 'action-detail',
        component: () => import('../views/actions/ActionDetail.vue'),
        meta: { title: '动作详情' },
      },
      {
        path: '/policies',
        name: 'policies',
        component: () => import('../views/policies/PoliciesList.vue'),
        meta: { title: '策略列表' },
      },
      {
        path: '/policies/:id/edit',
        name: 'policy-edit',
        component: () => import('../views/policies/PolicyEdit.vue'),
        meta: { title: '编辑策略' },
      },
      {
        path: '/policies/new',
        name: 'policy-new',
        component: () => import('../views/policies/PolicyEdit.vue'),
        meta: { title: '新增策略' },
      },
      {
        path: '/policies/ip-whitelist',
        name: 'ip-whitelist',
        component: () => import('../views/policies/IpWhitelist.vue'),
        meta: { title: 'IP 白名单策略' },
      },
      {
        path: '/policies/geo-block',
        name: 'geo-block',
        component: () => import('../views/policies/GeoBlock.vue'),
        meta: { title: '地区封禁策略' },
      },
      {
        path: '/forensics',
        name: 'forensics',
        component: () => import('../views/forensics/ForensicsList.vue'),
        meta: { title: '取证任务' },
      },
      {
        path: '/forensics/:id',
        name: 'forensics-detail',
        component: () => import('../views/forensics/ForensicsDetail.vue'),
        meta: { title: '取证详情' },
      },
      {
        path: '/forensics/new',
        name: 'forensics-new',
        component: () => import('../views/forensics/ForensicsNew.vue'),
        meta: { title: '新建取证任务' },
      },
      {
        path: '/settings',
        name: 'settings',
        component: () => import('../views/settings/SettingsHome.vue'),
        meta: { title: '系统设置' },
      },
      {
        path: '/settings/ingestion',
        name: 'settings-ingestion',
        component: () => import('../views/settings/IngestionSettings.vue'),
        meta: { title: '日志采集配置' },
      },
    ],
  },
]

//创建路由实列
const  router=createRouter({
    history:createWebHistory(),
    routes,
})

//导出路由
export default router;
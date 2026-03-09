import {createRouter,createWebHistory,createWebHashHistory} from "vue-router";
import {ElMessage} from "element-plus";


// 路由表
const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/login.vue'),
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requireAuth: true },
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
        meta: { title: '审批列表', role: ['admin'] },
      },
      {
        path: '/approvals/:id',
        name: 'approval-detail',
        component: () => import('../views/approvals/ApprovalDetail.vue'),
        meta: { title: '审批详情', role: ['admin'] },
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
        meta: { title: '策略列表', role: ['admin'] },
      },
      {
        path: '/policies/:id/edit',
        name: 'policy-edit',
        component: () => import('../views/policies/PolicyEdit.vue'),
        meta: { title: '编辑策略', role: ['admin'] },
      },
      {
        path: '/policies/new',
        name: 'policy-new',
        component: () => import('../views/policies/PolicyEdit.vue'),
        meta: { title: '新增策略', role: ['admin'] },
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
        meta: { title: '系统设置', role: ['admin'] },
      },
      {
        path: '/settings/ingestion',
        name: 'settings-ingestion',
        component: () => import('../views/settings/IngestionSettings.vue'),
        meta: { title: '日志采集配置', role: ['admin'] },
      },
      {
        path: '/admin/permissions',
        name: 'admin-permissions',
        component: () => import('../views/admin/Permissions.vue'),
        meta: { title: '权限管理', role: ['admin'] },
      },
    ],
  },
]

//创建路由实列
const  router=createRouter({
    history:createWebHistory(),
    routes,
})

// 路由守卫（暂时关闭登录拦截，后续需要鉴权时再开启）
// router.beforeEach((to, from, next) => {
//   // 检查路由是否需要认证
//   if (to.meta.requireAuth) {
//     const role = sessionStorage.getItem('role')
//
//     // 用户未登录
//     if (!role) {
//       ElMessage.error('请先登录')
//       next('/login')
//       return
//     }
//
//     // 检查用户角色是否匹配路由要求的角色
//     if (to.meta.role && !to.meta.role.includes(role)) {
//       // 普通用户尝试访问管理员页面
//       if (to.path.startsWith('/admin')) {
//         ElMessage.error('无权限访问管理员页面！')
//         // 重定向到用户首页
//         next('/user/home')
//       } else {
//         ElMessage.error('无权限访问！')
//         // 重定向到上一个页面或用户首页
//         next(from.path || '/user/home')
//       }
//       return
//     }
//   }
//
//   // 允许访问
//   next()
// })
//导出路由
export default router;
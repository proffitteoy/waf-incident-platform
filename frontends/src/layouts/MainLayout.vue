<template>
  <div class="layout-root">
    <!-- 顶部导航 -->
    <header class="layout-header">
      <div class="logo-area" @click="goDashboard">
        <img src="/logo.svg" alt="Logo" class="logo-img" />
        <div class="logo-text">
          <span class="title">智盾·安全联控平台</span>
          <span class="subtitle">WAF 事件 · LLM 分析 · 策略联动</span>
        </div>
      </div>
      <div class="header-right">
        <el-tooltip :content="isDark ? '切换为浅色主题' : '切换为深色主题'" placement="bottom">
          <el-button circle text @click="toggleTheme">
            <Icon
              :icon="isDark ? 'solar:sun-2-bold-duotone' : 'solar:moon-stars-bold-duotone'"
              width="18"
            />
          </el-button>
        </el-tooltip>
      </div>
    </header>

    <div class="layout-main">
      <!-- 侧边栏 -->
      <aside class="layout-sider">
        <el-menu
          :default-active="activeMenu"
          class="menu"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><Icon icon="solar:chart-2-bold-duotone" /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>

          <el-sub-menu index="/incidents">
            <template #title>
              <el-icon><Icon icon="solar:shield-warning-bold-duotone" /></el-icon>
              <span>事件管理</span>
            </template>
            <el-menu-item index="/incidents">事件列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/llm-reports">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>LLM 报告</span>
            </template>
            <el-menu-item index="/llm-reports">报告列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/approvals">
            <template #title>
              <el-icon><Icon icon="solar:checklist-minimalistic-bold-duotone" /></el-icon>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approvals">审批列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/actions">
            <template #title>
              <el-icon><Icon icon="solar:flashlight-bold-duotone" /></el-icon>
              <span>动作执行</span>
            </template>
            <el-menu-item index="/actions">动作列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/policies">
            <template #title>
              <el-icon><Icon icon="solar:settings-bold-duotone" /></el-icon>
              <span>策略配置</span>
            </template>
            <el-menu-item index="/policies">风险阈值策略</el-menu-item>
            <el-menu-item index="/policies/ip-whitelist">IP 白名单</el-menu-item>
            <el-menu-item index="/policies/geo-block">地区封禁</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/forensics">
            <template #title>
              <el-icon><Icon icon="solar:radar-2-bold-duotone" /></el-icon>
              <span>取证管理</span>
            </template>
            <el-menu-item index="/forensics">取证任务</el-menu-item>
            <el-menu-item index="/forensics/new">新建取证任务</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/settings">
            <template #title>
              <el-icon><Icon icon="solar:server-square-cloud-bold-duotone" /></el-icon>
              <span>系统设置</span>
            </template>
            <el-menu-item index="/settings">系统总览</el-menu-item>
            <el-menu-item index="/settings/ingestion">日志采集配置</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </aside>

      <!-- 内容区 -->
      <main class="layout-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { Document } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const theme = ref('dark')

const applyTheme = (value) => {
  document.documentElement.setAttribute('data-theme', value)
  window.localStorage.setItem('waf-theme', value)
}

onMounted(() => {
  const saved = window.localStorage.getItem('waf-theme')
  if (saved === 'light' || saved === 'dark') {
    theme.value = saved
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.value = prefersDark ? 'dark' : 'light'
  }
  applyTheme(theme.value)
})

watch(theme, (val) => {
  applyTheme(val)
})

const isDark = computed(() => theme.value === 'dark')

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

const activeMenu = computed(() => {
  // 子路由时高亮父路径
  const path = route.path
  if (path.startsWith('/incidents')) return '/incidents'
  if (path.startsWith('/llm-reports')) return '/llm-reports'
  if (path.startsWith('/approvals')) return '/approvals'
  if (path.startsWith('/actions')) return '/actions'
  if (path.startsWith('/policies')) return '/policies'
  if (path.startsWith('/forensics')) return '/forensics'
  if (path.startsWith('/settings')) return '/settings'
  return '/dashboard'
})

const goDashboard = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.layout-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-root);
  color: var(--text-color);
}

.layout-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-header);
}

.logo-area {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.logo-img {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  margin-right: 10px;
}
.logo-text .title {
  font-size: 15px;
  font-weight: 600;
}
.logo-text .subtitle {
  font-size: 11px;
  color: #9ca3af;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.layout-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.layout-sider {
  width: 220px;
  padding: 12px 10px 16px;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-sider);
}

.menu {
  border-right: none;
}

.layout-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

@media (max-width: 900px) {
  .layout-sider {
    width: 200px;
  }
}
</style>


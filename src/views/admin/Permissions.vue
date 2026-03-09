<template>
  <div class="page-wrapper">
    <header class="page-header">
      <div>
        <h2>权限管理</h2>
        <p>为不同用户分配角色和权限，支持一键查看和调整。</p>
      </div>
      <div class="page-header-extra">
        <el-input
          v-model="keyword"
          placeholder="搜索用户名 / 姓名"
          clearable
          class="search-input"
          prefix-icon="Search"
        />
      </div>
    </header>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>用户列表</span>
              <span class="muted">共 {{ filteredUsers.length }} 个用户</span>
            </div>
          </template>

          <el-table
            :data="filteredUsers"
            border
            stripe
            highlight-current-row
            style="width: 100%"
            @row-click="selectUser"
            :current-row-key="currentUserId"
            row-key="id"
          >
            <el-table-column prop="username" label="用户名" width="140" />
            <el-table-column prop="displayName" label="姓名" width="140" />
            <el-table-column prop="roles" label="角色" min-width="180">
              <template #default="{ row }">
                <el-tag
                  v-for="role in row.roles"
                  :key="role"
                  size="small"
                  class="role-tag"
                >
                  {{ roleLabel(role) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>角色分配</span>
              <span v-if="currentUser" class="muted">
                当前：{{ currentUser.displayName }}（{{ currentUser.username }}）
              </span>
            </div>
          </template>
          <div v-if="currentUser">
            <el-checkbox-group v-model="currentUser.roles" class="role-group">
              <el-checkbox label="admin">管理员（可访问所有模块）</el-checkbox>
              <el-checkbox label="analyst">安全分析员（事件、报告、取证）</el-checkbox>
              <el-checkbox label="viewer">只读查看（无写入权限）</el-checkbox>
            </el-checkbox-group>
          </div>
          <p v-else class="muted">在左侧选择一个用户后，再为其分配角色。</p>
        </el-card>

        <el-card shadow="never" class="card-block">
          <template #header>
            <div class="card-header">
              <span>权限配置（只读示意）</span>
            </div>
          </template>

          <p class="muted">
            权限树目前仅为前端占位，后续会与 `/api/admin/permissions` 同步读写。
          </p>

          <el-tree
            :data="permissionTree"
            show-checkbox
            node-key="id"
            default-expand-all
            :default-checked-keys="defaultChecked"
            class="permission-tree"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const userList = ref([
  {
    id: 1,
    username: 'admin',
    displayName: '系统管理员',
    roles: ['admin'],
  },
  {
    id: 2,
    username: 'alice',
    displayName: 'Alice',
    roles: ['analyst'],
  },
  {
    id: 3,
    username: 'bob',
    displayName: 'Bob',
    roles: ['viewer'],
  },
])

const keyword = ref('')

const users = computed(() => userList.value)

const filteredUsers = computed(() => {
  if (!keyword.value.trim()) return users.value
  const k = keyword.value.trim().toLowerCase()
  return users.value.filter(
    (u) =>
      u.username.toLowerCase().includes(k) ||
      u.displayName.toLowerCase().includes(k),
  )
})

const currentUserId = ref(null)

const currentUser = computed(() =>
  users.value.find((u) => u.id === currentUserId.value) || null,
)

function selectUser(row) {
  currentUserId.value = row.id
}

function roleLabel(role) {
  switch (role) {
    case 'admin':
      return '管理员'
    case 'analyst':
      return '安全分析员'
    case 'viewer':
      return '只读查看'
    default:
      return role
  }
}

const permissionTree = [
  {
    id: 'incidents',
    label: '事件管理',
    children: [
      { id: 'incidents.view', label: '查看事件' },
      { id: 'incidents.analyze', label: '发起分析' },
    ],
  },
  {
    id: 'actions',
    label: '动作执行',
    children: [
      { id: 'actions.view', label: '查看动作' },
      { id: 'actions.execute', label: '执行动作' },
      { id: 'actions.rollback', label: '回滚动作' },
    ],
  },
  {
    id: 'approvals',
    label: '审批管理',
    children: [
      { id: 'approvals.view', label: '查看审批' },
      { id: 'approvals.decide', label: '执行审批决策' },
    ],
  },
  {
    id: 'admin',
    label: '系统配置',
    children: [
      { id: 'policies.manage', label: '策略管理' },
      { id: 'settings.manage', label: '系统设置' },
    ],
  },
]

const defaultChecked = ['incidents.view', 'actions.view']
</script>

<style scoped>
.page-wrapper {
  padding: 24px;
  color: var(--text-color);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px;
}

.page-header p {
  margin: 0;
  color: var(--muted-color);
  font-size: 13px;
}

.page-header-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 220px;
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

.role-tag {
  margin-right: 4px;
}

.role-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.permission-tree {
  margin-top: 8px;
}

.muted {
  color: var(--muted-color);
  font-size: 12px;
}
</style>


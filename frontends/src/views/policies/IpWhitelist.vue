<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>IP 白名单策略</h2>
      <p>在此列表中的 IP 或 CIDR 段，在事件采集时将被直接跳过，不存入系统也不触发分析。适用于受信任的内部服务、监控探针等来源。</p>
    </header>

    <!-- 查询与新增栏 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <div class="left">
          <el-input
            v-model="checkIp"
            placeholder="输入 IP 验证是否在白名单中..."
            clearable
            style="width: 260px"
            @keyup.enter="doCheck"
          />
          <el-button @click="doCheck" :loading="checking">验证 IP</el-button>
          <el-tag v-if="checkResult !== null" :type="checkResult.whitelisted ? 'success' : 'info'" style="margin-left: 8px">
            {{ checkResult.whitelisted ? `已命中：${checkResult.matched_entry?.cidr}（${checkResult.matched_entry?.name}）` : '未在白名单中' }}
          </el-tag>
        </div>
        <el-button type="primary" @click="openAddDialog">+ 添加条目</el-button>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="entries" border stripe style="width: 100%">
        <el-table-column label="名称" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column label="IP / CIDR" prop="cidr" width="200" />
        <el-table-column label="描述" prop="description" show-overflow-tooltip min-width="200">
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="160">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" text type="danger" @click="removeEntry(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingEntry ? '编辑白名单条目' : '添加白名单条目'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：内部监控探针" />
        </el-form-item>
        <el-form-item label="IP / CIDR" prop="cidr">
          <el-input v-model="form.cidr" placeholder="例如：1.2.3.4 或 203.0.113.0/24" />
          <div class="form-hint">支持单 IP（/32）和 CIDR 网段，格式：x.x.x.x 或 x.x.x.x/xx</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选，说明该来源的用途" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { IpWhitelistApi } from '../../api/ipWhitelist'

const loading = ref(false)
const submitting = ref(false)
const checking = ref(false)
const entries = ref([])
const dialogVisible = ref(false)
const editingEntry = ref(null)
const checkIp = ref('')
const checkResult = ref(null)
const formRef = ref()

const form = reactive({ name: '', cidr: '', description: '', is_active: true })

const CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/

const rules = {
  name: [{ required: true, message: '请填写名称', trigger: 'blur' }],
  cidr: [
    { required: true, message: '请填写 IP 或 CIDR', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!CIDR_REGEX.test(value)) callback(new Error('格式错误，例如：1.2.3.4 或 203.0.113.0/24'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function openAddDialog() {
  editingEntry.value = null
  Object.assign(form, { name: '', cidr: '', description: '', is_active: true })
  dialogVisible.value = true
}

function openEditDialog(row) {
  editingEntry.value = row
  Object.assign(form, { name: row.name, cidr: row.cidr, description: row.description || '', is_active: row.is_active })
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = { name: form.name, cidr: form.cidr, description: form.description || undefined, is_active: form.is_active }
    if (editingEntry.value) {
      await IpWhitelistApi.update(editingEntry.value.id, payload)
      ElMessage.success('条目已更新')
    } else {
      await IpWhitelistApi.create(payload)
      ElMessage.success('条目已添加')
    }
    dialogVisible.value = false
    await loadEntries()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function removeEntry(row) {
  await ElMessageBox.confirm(`确定删除白名单条目「${row.name}（${row.cidr}）」吗？`, '删除确认', { type: 'warning' }).catch(() => null)
  if (!arguments[0]) return // user cancelled
  try {
    await IpWhitelistApi.remove(row.id)
    ElMessage.success('已删除')
    await loadEntries()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

async function doCheck() {
  if (!checkIp.value.trim()) return
  checking.value = true
  checkResult.value = null
  try {
    const result = await IpWhitelistApi.check(checkIp.value.trim())
    checkResult.value = result
  } catch (error) {
    ElMessage.error(error?.message || '验证失败')
  } finally {
    checking.value = false
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

async function loadEntries() {
  loading.value = true
  try {
    const result = await IpWhitelistApi.list()
    entries.value = Array.isArray(result?.items) ? result.items : []
  } catch (error) {
    ElMessage.error(`加载失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadEntries)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.toolbar-card { margin-bottom: 12px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.toolbar .left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.table-card { margin-top: 8px; }
.form-hint { font-size: 11px; color: var(--muted-color); margin-top: 4px; }
</style>

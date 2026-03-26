<template>
  <div class="page-wrapper">
    <header class="page-header">
      <h2>地区封禁策略</h2>
      <p>配置需封禁的国家/地区（ISO 3166-1 两位代码）。来自封禁地区的事件将被标记并强制触发 LLM 分析，以便快速发现高风险攻击。</p>
    </header>

    <!-- IP 归属地查询 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <div class="left">
          <el-input
            v-model="lookupIp"
            placeholder="输入 IP 查询归属地和封禁状态..."
            clearable
            style="width: 260px"
            @keyup.enter="doLookup"
          />
          <el-button @click="doLookup" :loading="looking">查询</el-button>
          <template v-if="lookupResult">
            <el-tag type="info">{{ lookupResult.country || '未知地区' }}</el-tag>
            <el-tag :type="lookupResult.geo_blocked ? 'danger' : 'success'">
              {{ lookupResult.geo_blocked ? `已封禁：命中规则「${lookupResult.matched_rule?.name}」` : '未被封禁' }}
            </el-tag>
          </template>
        </div>
        <el-button type="primary" @click="openAddDialog">+ 添加封禁规则</el-button>
      </div>
    </el-card>

    <!-- 规则列表 -->
    <el-card shadow="never" class="table-card">
      <el-table v-loading="loading" :data="rules" border stripe style="width: 100%">
        <el-table-column label="规则名称" prop="name" min-width="160" show-overflow-tooltip />
        <el-table-column label="封禁国家/地区" min-width="260">
          <template #default="{ row }">
            <el-tag
              v-for="code in row.country_codes"
              :key="code"
              size="small"
              type="danger"
              effect="plain"
              style="margin: 2px"
            >
              {{ code }} {{ countryName(code) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" prop="description" show-overflow-tooltip min-width="180">
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
            <el-button size="small" text type="danger" @click="removeRule(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingRule ? '编辑封禁规则' : '添加封禁规则'"
      width="560px"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：封禁高风险地区" />
        </el-form-item>
        <el-form-item label="封禁国家/地区" prop="country_codes">
          <div class="country-input">
            <el-tag
              v-for="code in form.country_codes"
              :key="code"
              closable
              type="danger"
              effect="plain"
              style="margin: 2px"
              @close="removeCountry(code)"
            >
              {{ code }} {{ countryName(code) }}
            </el-tag>
            <el-select
              v-model="selectedCountry"
              filterable
              placeholder="搜索或选择国家..."
              style="width: 200px; margin: 2px"
              @change="addCountry"
            >
              <el-option
                v-for="c in availableCountries"
                :key="c.code"
                :label="`${c.code} ${c.name}`"
                :value="c.code"
              />
            </el-select>
          </div>
          <div class="form-hint">也可直接输入两位国家代码（如 RU、US）后按 Enter 添加</div>
          <el-input
            v-model="manualCode"
            placeholder="输入两位代码后按 Enter"
            style="width: 160px; margin-top: 4px"
            maxlength="2"
            @keyup.enter="addManualCode"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="可选，说明封禁原因" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { GeoBlockApi } from '../../api/geoBlock'

const loading = ref(false)
const submitting = ref(false)
const looking = ref(false)
const rules = ref([])
const dialogVisible = ref(false)
const editingRule = ref(null)
const lookupIp = ref('')
const lookupResult = ref(null)
const selectedCountry = ref('')
const manualCode = ref('')
const formRef = ref()

const form = reactive({ name: '', country_codes: [], description: '', is_active: true })

const COMMON_COUNTRIES = [
  { code: 'CN', name: '中国' }, { code: 'RU', name: '俄罗斯' }, { code: 'US', name: '美国' },
  { code: 'KP', name: '朝鲜' }, { code: 'IR', name: '伊朗' }, { code: 'NG', name: '尼日利亚' },
  { code: 'UA', name: '乌克兰' }, { code: 'BR', name: '巴西' }, { code: 'IN', name: '印度' },
  { code: 'DE', name: '德国' }, { code: 'FR', name: '法国' }, { code: 'GB', name: '英国' },
  { code: 'JP', name: '日本' }, { code: 'KR', name: '韩国' }, { code: 'SG', name: '新加坡' },
  { code: 'HK', name: '香港' }, { code: 'TW', name: '台湾' }, { code: 'VN', name: '越南' },
  { code: 'TR', name: '土耳其' }, { code: 'PK', name: '巴基斯坦' }, { code: 'ID', name: '印度尼西亚' },
]

const countryMap = Object.fromEntries(COMMON_COUNTRIES.map((c) => [c.code, c.name]))

const countryName = (code) => countryMap[code] || ''

const availableCountries = computed(() =>
  COMMON_COUNTRIES.filter((c) => !form.country_codes.includes(c.code))
)

const formRules = {
  name: [{ required: true, message: '请填写规则名称', trigger: 'blur' }],
  country_codes: [
    {
      validator: (_rule, _value, callback) => {
        if (form.country_codes.length === 0) callback(new Error('至少选择一个国家/地区'))
        else callback()
      },
      trigger: 'change',
    },
  ],
}

function addCountry(code) {
  if (code && !form.country_codes.includes(code)) {
    form.country_codes.push(code)
  }
  selectedCountry.value = ''
}

function addManualCode() {
  const code = manualCode.value.trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(code) && !form.country_codes.includes(code)) {
    form.country_codes.push(code)
    manualCode.value = ''
  } else if (code) {
    ElMessage.warning('请输入有效的两位国家代码（如 RU、US）')
  }
}

function removeCountry(code) {
  form.country_codes = form.country_codes.filter((c) => c !== code)
}

function openAddDialog() {
  editingRule.value = null
  Object.assign(form, { name: '', country_codes: [], description: '', is_active: true })
  dialogVisible.value = true
}

function openEditDialog(row) {
  editingRule.value = row
  Object.assign(form, {
    name: row.name,
    country_codes: [...(row.country_codes || [])],
    description: row.description || '',
    is_active: row.is_active,
  })
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      name: form.name,
      country_codes: form.country_codes,
      description: form.description || undefined,
      is_active: form.is_active,
    }
    if (editingRule.value) {
      await GeoBlockApi.update(editingRule.value.id, payload)
      ElMessage.success('规则已更新')
    } else {
      await GeoBlockApi.create(payload)
      ElMessage.success('规则已添加')
    }
    dialogVisible.value = false
    await loadRules()
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function removeRule(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除封禁规则「${row.name}」（涉及 ${row.country_codes?.join('、')} 等地区）吗？`,
      '删除确认',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await GeoBlockApi.remove(row.id)
    ElMessage.success('已删除')
    await loadRules()
  } catch (error) {
    ElMessage.error(error?.message || '删除失败')
  }
}

async function doLookup() {
  if (!lookupIp.value.trim()) return
  looking.value = true
  lookupResult.value = null
  try {
    const result = await GeoBlockApi.lookup(lookupIp.value.trim())
    lookupResult.value = result
  } catch (error) {
    ElMessage.error(error?.message || '查询失败')
  } finally {
    looking.value = false
  }
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

async function loadRules() {
  loading.value = true
  try {
    const result = await GeoBlockApi.list()
    rules.value = Array.isArray(result?.items) ? result.items : []
  } catch (error) {
    ElMessage.error(`加载失败：${error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadRules)
</script>

<style scoped>
.page-wrapper { padding: 24px; color: var(--text-color); }
.page-header h2 { margin: 0 0 4px; }
.page-header p { margin: 0 0 16px; color: var(--muted-color); font-size: 13px; }
.toolbar-card { margin-bottom: 12px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.toolbar .left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.table-card { margin-top: 8px; }
.country-input { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; min-height: 32px; }
.form-hint { font-size: 11px; color: var(--muted-color); margin-top: 4px; }
</style>

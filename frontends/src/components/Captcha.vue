<template>
  <div class="captcha-root">
    <el-input
      v-model="localValue"
      class="captcha-input"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @blur="onInput"
    >
      <template #append>
        <button type="button" class="captcha-chip" @click="refresh" aria-label="Refresh captcha">
          <span class="captcha-text" :style="captchaStyle">{{ captcha }}</span>
        </button>
      </template>
    </el-input>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入验证码' },
  length: { type: Number, default: 4 },
})

const emit = defineEmits(['update:modelValue', 'verify'])

const localValue = ref(props.modelValue ?? '')
watch(
  () => props.modelValue,
  (v) => {
    if (v !== localValue.value) localValue.value = v ?? ''
  }
)

const captcha = ref('')

function randomCaptcha(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function verifyNow(value) {
  const ok = String(value || '').trim().toUpperCase() === String(captcha.value).toUpperCase()
  emit('verify', ok)
  return ok
}

function refresh() {
  captcha.value = randomCaptcha(Math.max(3, Math.min(8, props.length)))
  emit('update:modelValue', '')
  localValue.value = ''
  emit('verify', false)
}

function onInput(val) {
  emit('update:modelValue', val ?? '')
  verifyNow(val)
}

const captchaStyle = computed(() => {
  const rot = (Math.random() * 14 - 7).toFixed(1)
  const hue = Math.floor(Math.random() * 360)
  return {
    transform: `rotate(${rot}deg)`,
    color: `hsl(${hue} 80% 70%)`,
  }
})

defineExpose({ refresh })

refresh()
</script>

<style scoped>
.captcha-root {
  width: 100%;
}

.captcha-chip {
  height: 100%;
  padding: 0 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.captcha-text {
  font-weight: 800;
  letter-spacing: 2px;
  user-select: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.25);
}
</style>

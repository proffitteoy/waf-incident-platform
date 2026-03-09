<template>
  <div class="login-wrapper">
    <!-- Background Overlay -->
    <div class="background-overlay"></div>

    <!-- Navigation -->
    <nav class="nav-header">
      <div class="logo">
        <img src="/logo.svg" alt="Logo" class="logo-image" />
        <span class="logo-text">智盾·安全联控平台</span>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <div class="content-left">
        <h1 class="hero-title">
          WAF 安全事件<br />
          分析与响应<br />
          控制台
        </h1>
        <p class="hero-subtitle">
          集中管理 WAF 日志、LLM 分析报告、审批与动作执行的安全运营平台。
          登录后即可一站式查看事件、触发分析、下发策略和追踪取证任务。
        </p>
      </div>

      <!-- Login Form Side -->
      <div class="content-right" :class="{ 'fade-in': showForm }">
        <div class="login-box">
          <h2 class="form-title">{{ isLoginMode ? '登录控制台' : '注册新帐号' }}</h2>

          <el-form
            ref="loginRef"
            :model="loginForm"
            :rules="loginRules"
            class="custom-form"
          >
            <el-form-item prop="user_account">
              <el-input
                v-model="loginForm.user_account"
                :placeholder="isLoginMode ? '账号（例如 admin）' : '设置登录账号'"
                class="modern-input"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                :placeholder="isLoginMode ? '密码' : '设置登录密码（至少 6 位）'"
                class="modern-input"
                show-password
              />
            </el-form-item>

            <!-- 验证码 - 仅在注册模式下显示 -->
            <el-form-item v-if="!isLoginMode" prop="captcha" class="captcha-form-item">
              <Captcha
                v-model="loginForm.captcha"
                @verify="handleCaptchaVerify"
                ref="captchaRef"
                placeholder="请输入验证码"
              />
            </el-form-item>

            <div class="form-actions">
              <el-button
                type="primary"
                class="btn-submit"
                @click="handleSubmit"
              >
                {{ isLoginMode ? '登录' : '注册' }}
              </el-button>
            </div>
          </el-form>

          <div class="form-footer">
            <el-checkbox v-if="isLoginMode" v-model="rememberMe" class="modern-checkbox">记住我</el-checkbox>
            <button class="switch-mode-btn" @click="toggleMode">
              {{ isLoginMode ? "还没有账号？去注册" : "已经有账号？去登录" }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Decorative Text -->

  </div>
</template>

<script setup>
import { reactive, ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { UserApi } from "../../api/user.js"
import { ElMessage } from 'element-plus'
import Captcha from '../../components/Captcha.vue'

const router = useRouter()
const loginRef = ref()
const captchaRef = ref()
const rememberMe = ref(false)
const isLoginMode = ref(true)
const showForm = ref(true) // Default to show form for login page
const captchaValid = ref(false)

const loginForm = reactive({
  user_account: '',
  password: '',
  captcha: '',
})

const loginRules = reactive({
  user_account: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  captcha: [
    { required: true, message: '请输入验证码', trigger: 'blur' }
  ]
})

const toggleMode = async () => {
  isLoginMode.value = !isLoginMode.value
  loginForm.user_account = ''
  loginForm.password = ''
  loginForm.captcha = ''
  captchaValid.value = false
  if (loginRef.value) {
    loginRef.value.clearValidate()
  }
  // 切换到注册模式时，等待DOM更新后刷新验证码
  if (!isLoginMode.value) {
    await nextTick()
    if (captchaRef.value) {
      captchaRef.value.refresh()
    }
  }
}

// 处理验证码验证
const handleCaptchaVerify = (isValid) => {
  captchaValid.value = isValid
  // 如果验证失败，清除验证码字段的错误提示（因为我们在提交时验证）
  if (isValid && loginRef.value) {
    loginRef.value.clearValidate('captcha')
  }
}

const handleSubmit = async () => {
  if (!loginRef.value) return

  // 先进行表单基础验证
  loginRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error("请正确填写登录信息")
      return
    }

    // 如果是注册模式，验证验证码
    if (!isLoginMode.value) {
      if (!loginForm.captcha) {
        ElMessage.error("请输入验证码")
        return
      }
      if (!captchaValid.value) {
        ElMessage.error("验证码不正确，请重试")
        if (captchaRef.value) {
          captchaRef.value.refresh()
          loginForm.captcha = ''
          captchaValid.value = false
        }
        return
      }
    }

    // 验证通过，执行登录或注册
    if (isLoginMode.value) {
      await handleLogin()
    } else {
      await handleRegister()
    }
  })
}

const handleLogin = async () => {
  try {
    const res = await UserApi.login(loginForm)
    if (res.success) {
      ElMessage.success(res.message || '登录成功')
      // 存储token
      if (res.data.token) {
        sessionStorage.setItem('token', res.data.token)
      }
      // 存储用户信息
      if (res.data.user) {
        sessionStorage.setItem('role', res.data.user.role)
        sessionStorage.setItem('id', res.data.user.id)
        sessionStorage.setItem('nickName', res.data.user.nickName)
        sessionStorage.setItem('avatar', res.data.user.avatar)
        sessionStorage.setItem('userAccount', res.data.user.userAccount)
      }

      if (res.data.user && res.data.user.role === 'admin') {
        await router.push('/admin')
      } else if (res.data.user && res.data.user.role === 'user') {
        await router.push('/user')
      } else {
        ElMessage.error("用户角色无效")
      }
    } else {
      ElMessage.error(res.message || "登录失败")
    }
  } catch (error) {
    console.error("Login error:", error)
    ElMessage.error("登录异常，请稍后重试")
  }
}

const handleRegister = async () => {
  // 验证验证码
  if (!captchaValid.value) {
    ElMessage.error("Please enter the correct verification code")
    if (captchaRef.value) {
      captchaRef.value.refresh()
      loginForm.captcha = ''
    }
    return
  }

  try {
    const res = await UserApi.register(loginForm)
    if (res.success) {
      ElMessage.success("注册成功，请使用新账号登录")
      // 注册成功后切换到登录模式
      toggleMode()
    } else {
      ElMessage.error(res.message || "注册失败")
      // 注册失败后刷新验证码
      if (captchaRef.value) {
        captchaRef.value.refresh()
        loginForm.captcha = ''
        captchaValid.value = false
      }
    }
  } catch (error) {
    console.error("Registration error:", error)
    ElMessage.error("注册异常，请稍后重试")
    // 出错后刷新验证码
    if (captchaRef.value) {
      captchaRef.value.refresh()
      loginForm.captcha = ''
      captchaValid.value = false
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

.login-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-image: url('/login-bg.svg');
  background-size: cover;
  background-position: center;
  color: #fff;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, rgba(70, 0, 50, 0.08) 0%, rgba(30, 0, 20, 0.15) 100%);
  z-index: 0;
}

/* Navigation */
.nav-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 30px 60px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  min-width: 0;
}

.logo-image {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  object-fit: cover;
  animation: pulse 2s ease-in-out infinite;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.95;
    transform: scale(1.05);
  }
}

.logo-text {
  font-weight: 700;
  font-size: 1.3rem;
  letter-spacing: 2px;
  color: #fff;
  text-shadow: 0 2px 10px rgba(244, 63, 94, 0.3);
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

/* Main Content */
.main-content {
  position: relative;
  z-index: 10;
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  padding: 0 8% 5% 8%;
}

.content-left {
  padding-right: 40px;
}

.hero-title {
  font-size: 5.5rem;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 30px;
  letter-spacing: -1px;
  background: linear-gradient(135deg, #fff 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
}

.hero-subtitle {
  font-size: 1.15rem;
  color: #fff;
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 40px;
  font-weight: 300;
}


/* Login Box */
.content-right {
  display: flex;
  justify-content: center;
}

.login-box {
  background: rgba(255, 255, 255, 0.01);
  backdrop-filter: blur(2px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 50px;
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
}

.form-title {
  font-size: 2rem;
  margin-bottom: 30px;
  text-align: center;
  color: #fff;
  font-weight: 600;
}

/* Modern Input Styling */
:deep(.modern-input .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px;
  height: 55px;
  transition: all 0.3s;
}

:deep(.modern-input .el-input__wrapper.is-focus) {
  border-color: rgba(255, 255, 255, 0.4) !important;
  background: rgba(255, 255, 255, 0.12) !important;
}

:deep(.modern-input .el-input__inner) {
  color: #fff !important;
  font-size: 1rem;
}

:deep(.modern-input .el-input__inner::placeholder) {
  color: #fff;
}

.btn-submit {
  width: 100%;
  height: 55px;
  border-radius: 12px;
  background: #f43f5e !important;
  border: none !important;
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 10px;
  transition: transform 0.3s;
}

.btn-submit:hover {
  transform: scale(1.02);
  opacity: 0.9;
}

.form-footer {
  margin-top: 25px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.modern-checkbox {
  color: #fff !important;
}

:deep(.el-checkbox__inner) {
  background-color: transparent !important;
  border-color: #fff !important;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #f43f5e !important;
  border-color: #f43f5e !important;
}

.switch-mode-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.switch-mode-btn:hover {
  color: #fff;
}

/* 验证码表单项样式 */
.captcha-form-item {
  margin-bottom: 20px;
}

:deep(.captcha-form-item .el-form-item__content) {
  width: 100%;
}

/* Bottom Decorative Brand */
.bottom-brand {
  position: absolute;
  bottom: -2vw;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11vw;
  font-weight: 800;
  color: #f43f5e;
  opacity: 0.12;
  pointer-events: none;
  text-transform: uppercase;
  white-space: nowrap;
  letter-spacing: 1.5vw;
  z-index: 1;
  font-family: 'Inter', sans-serif;
}

@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
    padding: 0 40px;
    text-align: center;
  }

  .content-left {
    padding-right: 0;
    margin-bottom: 50px;
  }

  .hero-title {
    font-size: 3rem;
  }

  .hero-subtitle {
    margin: 0 auto 30px;
  }

  .nav-header {
    padding: 20px 30px;
  }

  .logo-text {
    font-size: 1.3rem;
    letter-spacing: 2px;
  }
}
</style>

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
          <h2 class="form-title">登录控制台</h2>

          <el-form
            ref="loginRef"
            :model="loginForm"
            :rules="loginRules"
            class="custom-form"
          >
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="账号（例如 admin）"
                class="modern-input"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="密码"
                class="modern-input"
                show-password
              />
            </el-form-item>

            <div class="form-actions">
              <el-button
                type="primary"
                class="btn-submit"
                @click="handleSubmit"
              >
                登录
              </el-button>
            </div>
          </el-form>

          <div class="form-footer">
            <el-checkbox v-model="rememberMe" class="modern-checkbox">记住我</el-checkbox>
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Decorative Text -->

  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { UserApi } from "../../api/user.js"
import { ElMessage } from 'element-plus'

const router = useRouter()
const loginRef = ref()
const rememberMe = ref(false)
const showForm = ref(true)

const loginForm = reactive({
  username: '',
  password: '',
})

const loginRules = reactive({
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
})

const handleSubmit = async () => {
  if (!loginRef.value) return
  loginRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error("请正确填写登录信息")
      return
    }
    await handleLogin()
  })
}

const handleLogin = async () => {
  try {
    const res = await UserApi.login(loginForm)
    ElMessage.success('登录成功')

    if (res.token) {
      sessionStorage.setItem('token', res.token)
    }
    if (res.user) {
      sessionStorage.setItem('role', res.user.role)
      sessionStorage.setItem('id', res.user.id)
      sessionStorage.setItem('username', res.user.username)
    }

    if (res.user?.role === 'admin') {
      await router.push('/admin')
    } else if (res.user?.role === 'user') {
      await router.push('/user')
    } else {
      ElMessage.error("用户角色无效")
    }
  } catch (error) {
    console.error("Login error:", error)
    ElMessage.error(error?.message || "登录失败，请检查账号密码")
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

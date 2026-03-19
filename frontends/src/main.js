import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
//引入路由(index.js引入时可以省略不写)
import router from './router'
//引入Element-plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'  //样式
//引入Element-plus图标
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
//Element-Plus中文语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { Icon } from "@iconify/vue";


const app = createApp(App)

//挂载路由
app.use(router)
//挂载Element-plus
app.use(ElementPlus,{locale:zhCn})
app.component('Icon', Icon);
////挂载全部Element-plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')


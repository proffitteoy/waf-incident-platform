# services

## 板块内容

- `content.service.js`：内容文章数据
- `auth.service.js`：登录演示与 SQL 字符串构造
- `command-preview.service.js`：命令预览构造（不执行）
- `file.service.js`：演示文件读取与目录边界检查

## 边界

- 只做业务逻辑与数据处理
- 不承担 HTTP 协议细节

## 对外接口

- `listArticles/getArticleBySlug`
- `authenticateUnsafe`
- `buildUnsafePingCommand`
- `readDemoFile/listDemoFiles`

## 关键函数/入口

- `buildUnsafeLoginSql`
- `readDemoFile`

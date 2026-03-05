const express = require('express');

const {
  authenticateUnsafe,
  buildUnsafeLoginSql
} = require('../services/auth.service');
const { buildUnsafePingCommand } = require('../services/command-preview.service');
const { readDemoFile } = require('../services/file.service');

const router = express.Router();

router.get('/attack-scenarios', (_req, res) => {
  res.json({
    scenarios: [
      {
        id: 'sqli-login',
        type: 'sql_injection',
        endpoint: 'POST /api/auth/login',
        sample_payload: { username: "admin' OR '1'='1", password: 'anything' }
      },
      {
        id: 'xss-search',
        type: 'xss',
        endpoint: 'GET /search?q=...'
      },
      {
        id: 'command-injection-preview',
        type: 'command_injection',
        endpoint: 'POST /api/tools/ping-preview',
        sample_payload: { host: '8.8.8.8;cat /etc/passwd' }
      },
      {
        id: 'path-traversal-files',
        type: 'path_traversal',
        endpoint: 'GET /legacy/download?name=../../etc/passwd',
        backup_endpoint: 'GET /api/files/read?name=../../etc/passwd'
      }
    ]
  });
});

router.post('/auth/login', (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  const result = authenticateUnsafe(username, password);

  res.status(result.user ? 200 : 401).json({
    ok: Boolean(result.user),
    message: result.user ? '登录成功' : '账号或密码错误',
    sql_preview: result.sql,
    user: result.user
  });
});

router.get('/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({
    ok: true,
    q: query,
    reflected: query
  });
});

router.post('/tools/ping-preview', (req, res) => {
  const host = String(req.body.host || '');

  if (!host) {
    res.status(400).json({
      ok: false,
      message: 'host 不能为空'
    });
    return;
  }

  const command = buildUnsafePingCommand(host);
  res.json({
    ok: true,
    command_preview: command,
    executed: false
  });
});

router.get('/files/read', (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name : '';

  if (!name) {
    res.status(400).json({
      ok: false,
      message: 'name 不能为空'
    });
    return;
  }

  try {
    const content = readDemoFile(name);
    res.json({
      ok: true,
      name,
      content
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message,
      unsafe_sql_example: buildUnsafeLoginSql("admin' OR '1'='1", 'demo')
    });
  }
});

module.exports = router;

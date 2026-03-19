const express = require('express');

const { listArticles, getArticleBySlug } = require('../services/content.service');
const { listDemoFiles, readDemoFile } = require('../services/file.service');

const router = express.Router();

router.get('/', (_req, res) => {
  const articles = listArticles().slice(0, 3);

  res.render('home', {
    title: '夜航日志',
    articles
  });
});

router.get('/about', (_req, res) => {
  res.render('about', {
    title: '关于本站'
  });
});

router.get('/articles', (_req, res) => {
  res.render('articles', {
    title: '文章列表',
    articles: listArticles()
  });
});

router.get('/articles/:slug', (req, res) => {
  const article = getArticleBySlug(req.params.slug);

  if (!article) {
    res.status(404).render('result', {
      title: '404',
      message: '文章不存在',
      detail: `未找到文章：${req.params.slug}`
    });
    return;
  }

  res.render('article', {
    title: article.title,
    article
  });
});

router.get('/search', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';

  res.render('search', {
    title: '搜索结果',
    query
  });
});

// 遗留下载入口：用于路径穿越探测回放。
router.get('/legacy/download', (req, res) => {
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
    res.type('text/plain; charset=utf-8').send(content);
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message,
      endpoint: '/legacy/download'
    });
  }
});

router.get('/files', (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name : '';
  const files = listDemoFiles();
  let content = '';
  let readError = '';

  if (name) {
    try {
      content = readDemoFile(name);
    } catch (error) {
      readError = error.message;
    }
  }

  res.render('files', {
    title: '文件查看',
    files,
    name,
    content,
    readError
  });
});

router.get('/attack-lab', (_req, res) => {
  res.render('attack-lab', {
    title: 'Attack Lab'
  });
});

module.exports = router;

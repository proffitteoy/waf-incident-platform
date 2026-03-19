const path = require('path');
const express = require('express');
const morgan = require('morgan');

const pagesRouter = require('./routes/pages.routes');
const apiRouter = require('./routes/api.routes');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(morgan('dev'));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use('/static', express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'web-test',
      time: new Date().toISOString()
    });
  });

  app.use('/', pagesRouter);
  app.use('/api', apiRouter);

  app.use((req, res) => {
    res.status(404).render('result', {
      title: '404',
      message: '页面不存在',
      detail: `未找到路径：${req.method} ${req.originalUrl}`
    });
  });

  return app;
}

module.exports = {
  createApp
};

const { createApp } = require('./app');

const app = createApp();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[web-test] listening on http://${host}:${port}`);
});

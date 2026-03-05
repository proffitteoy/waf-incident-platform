const ARTICLES = [
  {
    slug: 'waf-lab-overview',
    title: '搭建一个可复现的 WAF 测试站点',
    summary: '记录如何把普通内容站改造成可联调规则集的实验环境。',
    content: '这个站点保留普通文章浏览能力，同时提供受控的攻击输入入口，用于验证 WAF 规则命中与误报率。'
  },
  {
    slug: 'owasp-crs-notes',
    title: 'OWASP CRS 规则族速记',
    summary: '常见的 SQLi、XSS、命令注入、路径穿越规则族整理。',
    content: 'SQL 注入通常命中 942xxx，XSS 通常命中 941xxx，命令注入通常命中 932xxx，路径穿越常见 930xxx。'
  },
  {
    slug: 'local-replay-guide',
    title: '本地攻击回放清单',
    summary: '如何在不做真实破坏的情况下复现检测请求。',
    content: '推荐使用 curl 或 Postman 发送构造参数，观察 WAF 与应用层返回、日志、告警字段。'
  },
  {
    slug: 'false-positive-checklist',
    title: '误报排查检查表',
    summary: '基于 URI、参数、UA、Referer 做最小化排查路径。',
    content: '误报治理要先定界规则、再归一流量样本、最后做最小规则覆盖，不要直接全局放开。'
  }
];

function listArticles() {
  return ARTICLES;
}

function getArticleBySlug(slug) {
  return ARTICLES.find((item) => item.slug === slug) || null;
}

module.exports = {
  listArticles,
  getArticleBySlug
};

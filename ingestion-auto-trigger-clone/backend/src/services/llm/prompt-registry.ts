interface PromptTemplate {
  task: string;
  version: string;
  template: string;
}

const promptRegistry: Map<string, PromptTemplate> = new Map();

export const registerPrompt = (task: string, version: string, template: string): void => {
  const key = `${task}:${version}`;
  promptRegistry.set(key, { task, version, template });
};

export const getPrompt = (task: string, version: string): PromptTemplate | null => {
  const key = `${task}:${version}`;
  return promptRegistry.get(key) || null;
};

export const computePromptDigest = (template: string): string => {
  // 简化实现
  return Buffer.from(template).toString("base64url").substring(0, 32);
};

// 注册默认 Prompt
registerPrompt(
  "waf_incident_analysis_mvp",
  "v1",
  `请分析以下 WAF 事件并生成事件单报告...`
);
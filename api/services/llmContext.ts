/**
 * 请求级 LLM 配置覆盖
 *
 * 前端在「设置」页配置自己的大模型 Key/BaseURL/模型，通过请求头
 * (x-llm-key / x-llm-base-url / x-llm-model) 传入；中间件将其挂到
 * AsyncLocalStorage，本请求链路内所有 OpenAI 客户端创建点自动生效。
 * 未传则回退到服务器 .env 默认值。Key 不落盘、不持久化。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface LlmOverride {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

const als = new AsyncLocalStorage<LlmOverride>();

/** 中间件调用：包裹后续整个请求处理链 */
export function withLlmOverride<T>(override: LlmOverride, fn: () => T): T {
  return als.run(override, fn);
}

/** 各 OpenAI 客户端创建点调用：取本请求的用户覆盖配置 */
export function getLlmOverride(): LlmOverride {
  return als.getStore() || {};
}

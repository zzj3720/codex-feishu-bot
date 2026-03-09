import * as Lark from "@larksuiteoapi/node-sdk";

import type { Env } from "../../config/env.js";

export function hasFeishuCredentials(env: Env): boolean {
  return Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET);
}

function resolveFeishuDomain(domain: string): string | Lark.Domain {
  if (domain === "feishu") {
    return Lark.Domain.Feishu;
  }

  if (domain === "lark") {
    return Lark.Domain.Lark;
  }

  return domain;
}

export function createFeishuOpenApiClient(env: Env): Lark.Client {
  return new Lark.Client({
    appId: env.FEISHU_APP_ID ?? "",
    appSecret: env.FEISHU_APP_SECRET ?? "",
    domain: resolveFeishuDomain(env.FEISHU_DOMAIN)
  });
}

export function createFeishuWsClient(env: Env): Lark.WSClient {
  return new Lark.WSClient({
    appId: env.FEISHU_APP_ID ?? "",
    appSecret: env.FEISHU_APP_SECRET ?? "",
    domain: resolveFeishuDomain(env.FEISHU_DOMAIN),
    loggerLevel: Lark.LoggerLevel.info
  });
}

#!/usr/bin/env node

import { basename, extname } from "node:path";
import { readFile } from "node:fs/promises";

const domain = process.env.FEISHU_DOMAIN ?? "feishu";
const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
const baseUrl = domain === "larksuite" ? "https://open.larksuite.com" : "https://open.feishu.cn";

if (!appId || !appSecret) {
  console.error("FEISHU_APP_ID / FEISHU_APP_SECRET 未配置，无法使用 feishu bridge");
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args.shift();

function usage() {
  console.error(
    [
      "Usage:",
      "  feishu-bridge.mjs send-text --chat-id <id> --text <text>",
      "  feishu-bridge.mjs send-file --chat-id <id> --path <absolute_path> [--name <filename>]",
      "  feishu-bridge.mjs openapi --method <METHOD> --path </open-apis/...> [--body <json>] [--query key=value]..."
    ].join("\n")
  );
}

function getFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }
  return value;
}

function getAllFlags(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1] && !args[index + 1].startsWith("--")) {
      values.push(args[index + 1]);
    }
  }
  return values;
}

function requireFlag(name) {
  const value = getFlag(name);
  if (!value) {
    throw new Error(`missing required flag: ${name}`);
  }
  return value;
}

function fileTypeFromPath(filePath) {
  const mapping = {
    ".mp4": "mp4",
    ".mov": "mp4",
    ".m4v": "mp4",
    ".pdf": "pdf",
    ".doc": "doc",
    ".docx": "doc",
    ".txt": "doc",
    ".md": "doc",
    ".xls": "xls",
    ".xlsx": "xls",
    ".csv": "xls",
    ".ppt": "ppt",
    ".pptx": "ppt",
    ".opus": "opus"
  };
  return mapping[extname(filePath).toLowerCase()] ?? "stream";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function getTenantAccessToken() {
  const payload = await fetchJson(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret
    })
  });

  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(`tenant access token 获取失败: ${JSON.stringify(payload)}`);
  }

  return payload.tenant_access_token;
}

async function callOpenApi({ token, method, path, body, query = [] }) {
  const url = new URL(path, baseUrl);
  for (const entry of query) {
    const [key, value] = entry.split("=");
    if (!key || value === undefined) {
      throw new Error(`invalid --query entry: ${entry}`);
    }
    url.searchParams.append(key, value);
  }

  const headers = {
    authorization: `Bearer ${token}`
  };

  const request = {
    method,
    headers
  };

  if (body !== undefined) {
    headers["content-type"] = "application/json; charset=utf-8";
    request.body = JSON.stringify(body);
  }

  return fetchJson(url, request);
}

async function uploadFile(token, filePath, explicitName) {
  const fileName = explicitName ?? basename(filePath);
  const fileBuffer = await readFile(filePath);
  const form = new FormData();
  form.append("file_type", fileTypeFromPath(filePath));
  form.append("file_name", fileName);
  form.append("file", new Blob([fileBuffer]), fileName);

  const response = await fetch(`${baseUrl}/open-apis/im/v1/files`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`
    },
    body: form
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`文件上传失败: HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }

  const fileKey = payload?.data?.file_key ?? payload?.file_key;
  if (!fileKey) {
    throw new Error(`文件上传失败: ${JSON.stringify(payload)}`);
  }

  return fileKey;
}

async function sendText(token) {
  return callOpenApi({
    token,
    method: "POST",
    path: "/open-apis/im/v1/messages",
    query: ["receive_id_type=chat_id"],
    body: {
      receive_id: requireFlag("--chat-id"),
      msg_type: "text",
      content: JSON.stringify({
        text: requireFlag("--text")
      })
    }
  });
}

async function sendFile(token) {
  const fileKey = await uploadFile(token, requireFlag("--path"), getFlag("--name"));
  return callOpenApi({
    token,
    method: "POST",
    path: "/open-apis/im/v1/messages",
    query: ["receive_id_type=chat_id"],
    body: {
      receive_id: requireFlag("--chat-id"),
      msg_type: "file",
      content: JSON.stringify({
        file_key: fileKey
      })
    }
  });
}

async function openapi(token) {
  const body = getFlag("--body");
  return callOpenApi({
    token,
    method: requireFlag("--method").toUpperCase(),
    path: requireFlag("--path"),
    query: getAllFlags("--query"),
    body: body ? JSON.parse(body) : undefined
  });
}

async function main() {
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  const token = await getTenantAccessToken();
  let result;

  if (command === "send-text") {
    result = await sendText(token);
  } else if (command === "send-file") {
    result = await sendFile(token);
  } else if (command === "openapi") {
    result = await openapi(token);
  } else {
    usage();
    throw new Error(`unknown command: ${command}`);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

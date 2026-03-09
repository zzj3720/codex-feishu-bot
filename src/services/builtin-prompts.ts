import type { IncomingChatMessage } from "../domain/types.js";

interface BuiltinPromptMatch {
  shortcut: "create_feishu_bot";
  prompt: string;
}

const CREATE_FEISHU_BOT_PROMPT = [
  "帮我一键创建飞书机器人。",
  "",
  "请异步执行 `npx -y lark-op-cli@latest create-bot` 并持续读取输出，不要等命令完全结束后再一次性总结。",
  "",
  "执行要求：",
  "1. 在当前 workspace 下操作，不要修改仓库源码；如果需要单独目录，就在 workspace 里自己创建。",
  "2. 持续同步 stdout 和 stderr 的关键进展。",
  "3. 如果输出里出现 ASCII 二维码、扫码登录提示、验证码或登录确认提示，立刻把 ASCII 二维码原样放进代码块转发给我，并明确告诉我现在需要扫码。",
  "4. 如果命令在等待登录、确认或交互，不要静默卡住，要明确告诉我它在等什么。",
  "5. 命令完成后，总结创建结果、关键标识、生成的配置或文件位置，以及接下来我还需要做什么。",
  "6. 如果失败，贴出关键错误并给出最小修复建议。",
  "",
  "除非我明确要求，否则不要继续做部署或修改这个仓库的业务代码。"
].join("\n");

function normalizeShortcut(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function matchBuiltinPrompt(text: string): BuiltinPromptMatch | undefined {
  const normalized = normalizeShortcut(text);

  if (
    normalized === "/create-feishu-bot" ||
    normalized === "/创建飞书机器人" ||
    normalized === "创建飞书机器人" ||
    normalized === "一键创建飞书机器人"
  ) {
    return {
      shortcut: "create_feishu_bot",
      prompt: CREATE_FEISHU_BOT_PROMPT
    };
  }

  return undefined;
}

export function resolveBuiltinPromptMessage(
  message: IncomingChatMessage
): { message: IncomingChatMessage; shortcut?: BuiltinPromptMatch["shortcut"] } {
  const matched = matchBuiltinPrompt(message.text);
  if (!matched) {
    return {
      message
    };
  }

  return {
    shortcut: matched.shortcut,
    message: {
      ...message,
      text: matched.prompt
    }
  };
}

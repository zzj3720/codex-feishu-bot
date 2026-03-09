import { basename } from "node:path";

import type { ConversationItem } from "../../domain/types.js";

interface InteractiveCard {
  schema: "2.0";
  config: {
    wide_screen_mode: boolean;
    enable_forward: boolean;
    update_multi: boolean;
  };
  header?: {
    template: "blue" | "green" | "orange" | "red" | "wathet" | "grey";
    title: {
      tag: "plain_text";
      content: string;
    };
  };
  body: {
    elements: Array<Record<string, unknown>>;
  };
}

function markdownBlock(content: string): Record<string, unknown> {
  return {
    tag: "markdown",
    content,
    text_align: "left"
  };
}

function collapsiblePanel(title: string, content: string): Record<string, unknown> {
  return {
    tag: "collapsible_panel",
    expanded: false,
    header: {
      title: {
        tag: "plain_text",
        content: title
      },
      width: "auto_when_fold",
      vertical_align: "center",
      padding: "2px 0 2px 6px",
      icon: {
        tag: "standard_icon",
        token: "down-small-ccm_outlined",
        size: "14px 14px"
      },
      icon_position: "follow_text",
      icon_expanded_angle: -180
    },
    padding: "6px 8px 6px 8px",
    vertical_spacing: "6px",
    border: {
      color: "grey",
      corner_radius: "5px"
    },
    elements: [markdownBlock(content)]
  };
}

function markdownTitleCollapsiblePanel(title: string, content: string): Record<string, unknown> {
  return {
    tag: "collapsible_panel",
    expanded: false,
    header: {
      title: {
        tag: "markdown",
        content: title
      },
      width: "auto_when_fold",
      vertical_align: "center",
      padding: "2px 0 2px 6px",
      icon: {
        tag: "standard_icon",
        token: "down-small-ccm_outlined",
        size: "14px 14px"
      },
      icon_position: "follow_text",
      icon_expanded_angle: -180
    },
    padding: "6px 8px 6px 8px",
    vertical_spacing: "6px",
    border: {
      color: "grey",
      corner_radius: "5px"
    },
    elements: [markdownBlock(content)]
  };
}

function divider(): Record<string, unknown> {
  return {
    tag: "hr"
  };
}

function stripLeadingLabel(body: string, labels: string[]): string {
  const pattern = new RegExp(
    `^(?:[-*]\\s*)?(?:${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[：:]\\s*`,
    "u"
  );
  return body.replace(pattern, "").trim();
}

function stripLeadingProcessParagraph(body: string): string {
  return body
    .replace(/^(?:[-*]\s*)?(?:中间过程|过程同步|过程说明)\s*[：:].*?(?:\n\s*\n|$)/su, "")
    .trim();
}

function summarizeTitle(body: string, fallback: string, maxLength = 48): string {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("```"));

  if (!firstLine) {
    return fallback;
  }

  const normalized = firstLine
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*#>\d.)\s]+/u, "")
    .replace(/[|`*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function processPreviewTitle(body: string): string {
  return summarizeTitle(body, "过程");
}

function summarizeCommand(command: string): string {
  const shellWrapped = command.match(/^\/bin\/bash -lc\s+(.+)$/);
  const raw = shellWrapped?.[1] ?? command;
  const unquoted = raw.replace(/^['"]|['"]$/g, "");
  return summarizeTitle(unquoted, "命令", 56);
}

function summarizeFilePaths(paths: string[]): string {
  const firstPath = paths[0];
  if (!firstPath) {
    return "文件";
  }

  if (paths.length === 1) {
    return basename(firstPath);
  }

  return `${basename(firstPath)} 等 ${paths.length} 个文件`;
}

function summarizeToolTitle(item: ConversationItem): string {
  if (item.command) {
    return summarizeCommand(item.command);
  }

  if (item.filePaths.length > 0) {
    return summarizeFilePaths(item.filePaths);
  }

  if (item.title && !["执行命令", "修改文件", "工具调用"].includes(item.title)) {
    return item.title;
  }

  return summarizeTitle(item.details.join("\n"), "处理");
}

function escapeMarkdownText(text: string): string {
  return text
    .replace(/\\/g, "&#92;")
    .replace(/</g, "&#60;")
    .replace(/>/g, "&#62;");
}

function fencedCode(content: string, language?: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trimEnd();
  const maxBackticks = Math.max(...Array.from(normalized.matchAll(/`+/g), (match) => match[0].length), 2);
  const fence = "`".repeat(maxBackticks + 1);
  const lang = language?.trim() ? language.trim() : "";
  return `${fence}${lang}\n${normalized}\n${fence}`;
}

function toolPhaseLabel(phase: ConversationItem["phase"]): string {
  switch (phase) {
    case "queued":
      return "等待执行";
    case "streaming":
      return "执行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
  }
}

export function renderTextMessageContent(content: string): string {
  return JSON.stringify({
    text: content.trim() || "处理中..."
  });
}

export function renderFileMessageContent(fileKey: string): string {
  return JSON.stringify({
    file_key: fileKey
  });
}

export function renderAssistantCardContent(item: ConversationItem): string {
  let body = item.content?.trim() || "处理中...";
  if (item.source === "final_answer") {
    body = stripLeadingProcessParagraph(body);
    body = stripLeadingLabel(body, ["最终结论", "结论", "Final Answer"]);
  } else {
    body = stripLeadingLabel(body, ["中间过程", "过程同步", "过程说明"]);
  }

  body = body || "处理中...";
  const elements =
    item.source === "commentary"
      ? [collapsiblePanel(processPreviewTitle(body), body)]
      : [markdownBlock(body)];

  const card: InteractiveCard = {
    schema: "2.0",
    config: {
      wide_screen_mode: true,
      enable_forward: true,
      update_multi: true
    },
    body: {
      elements
    }
  };

  return JSON.stringify(card);
}

export function renderToolCardContent(item: ConversationItem): string {
  const sections = [`**${toolPhaseLabel(item.phase)}**`];
  if (item.details.length > 0) {
    sections.push(item.details.map((line) => `- ${escapeMarkdownText(line)}`).join("\n"));
  }
  if (item.command) {
    sections.push(`**命令**\n${fencedCode(item.command, "bash")}`);
  }
  if (item.output) {
    sections.push(`**输出**\n${fencedCode(item.output.slice(-1800))}`);
  }
  if (item.filePaths.length > 0) {
    sections.push(`**涉及文件**\n${item.filePaths.map((path) => `- ${escapeMarkdownText(path)}`).join("\n")}`);
  }

  const summary = summarizeToolTitle(item);
  const elements: Array<Record<string, unknown>> = [
    markdownTitleCollapsiblePanel(`**${toolPhaseLabel(item.phase)} · ${summary}**`, sections.join("\n\n"))
  ];

  const card: InteractiveCard = {
    schema: "2.0",
    config: {
      wide_screen_mode: true,
      enable_forward: true,
      update_multi: true
    },
    body: {
      elements
    }
  };

  return JSON.stringify(card);
}

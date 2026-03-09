import { setTimeout as sleep } from "node:timers/promises";

import type { CodexEvent } from "../../domain/types.js";
import type { CodexTurnContext, CodexWorker } from "./codex-worker.js";

export class MockCodexWorker implements CodexWorker {
  async ensureThread(context: CodexTurnContext): Promise<string> {
    return context.session?.threadId ?? `thread_mock_${Date.now()}`;
  }

  async steerTurn(): Promise<void> {
    return undefined;
  }

  async *runTurn(
    context: CodexTurnContext & { threadId: string }
  ): AsyncGenerator<CodexEvent> {
    const prompt = context.message.text.trim();

    yield {
      kind: "thread_bound",
      threadId: context.threadId
    };
    yield {
      kind: "turn_bound",
      turnId: "turn_mock_active"
    };

    yield {
      kind: "assistant_message_started",
      itemId: "commentary_1",
      source: "commentary"
    };
    await sleep(300);

    yield {
      kind: "assistant_message_delta",
      itemId: "commentary_1",
      text: "先看一下当前群会话、Codex turn 和飞书消息槽位的映射。"
    };
    await sleep(300);

    yield {
      kind: "assistant_message_completed",
      itemId: "commentary_1",
      text: "先看一下当前群会话、Codex turn 和飞书消息槽位的映射。"
    };
    await sleep(200);

    yield {
      kind: "tool_call_started",
      itemId: "tool_1",
      title: "执行命令",
      command: "analyze-session-topology"
    };
    await sleep(300);

    yield {
      kind: "tool_call_delta",
      itemId: "tool_1",
      detail: "识别为一个群一个默认 thread，但同一时刻只允许一个 active turn",
      output: "logical chat -> thread -> item projection"
    };
    await sleep(300);

    yield {
      kind: "tool_call_completed",
      itemId: "tool_1",
      title: "执行命令",
      status: "completed",
      output: "logical chat -> thread -> item projection"
    };
    await sleep(200);

    yield {
      kind: "assistant_message_started",
      itemId: "final_1",
      source: "final_answer"
    };
    await sleep(200);

    yield {
      kind: "assistant_message_delta",
      itemId: "final_1",
      text: [
        `已模拟处理请求：${prompt}`,
        "每条 Codex assistant 消息都会投影成飞书里的独立文本消息。",
        "每次工具调用都会投影成一条可更新卡片。",
        "用户可见文件必须通过 Feishu bridge 显式发送。"
      ].join("\n")
    };
    await sleep(200);

    yield {
      kind: "assistant_message_completed",
      itemId: "final_1",
      text: [
        `已模拟处理请求：${prompt}`,
        "每条 Codex assistant 消息都会投影成飞书里的独立文本消息。",
        "每次工具调用都会投影成一条可更新卡片。",
        "用户可见文件必须通过 Feishu bridge 显式发送。"
      ].join("\n")
    };
  }
}

import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { WebSocket, WebSocketServer } from "ws";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3400);

const app = Fastify({
  logger: true
});

const sockets = new Set();
const state = {
  inboundEvents: [],
  outboundMessages: [],
  replies: [],
  uploads: []
};

function now() {
  return new Date().toISOString();
}

function safeParseContent(content) {
  if (typeof content !== "string") {
    return content;
  }

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function createInboundEvent(payload = {}) {
  const messageId = payload.messageId ?? `om_in_${randomUUID()}`;

  const event = {
    tenant_key: payload.tenantKey ?? "tenant_fake",
    sender: {
      sender_id: {
        open_id: payload.senderId ?? "ou_fake_user"
      },
      sender_type: payload.senderType ?? "user"
    },
    message: {
      chat_id: payload.chatId ?? "oc_fake_chat",
      chat_type: payload.chatType ?? "group",
      message_id: messageId,
      content:
        payload.content ??
        JSON.stringify({
          text: payload.text ?? "@bot 用 mock worker 回一段话"
        }),
      mentions:
        payload.mentions ??
        (payload.mentionsBot ?? true
          ? [
              {
                name: payload.botName ?? "bot"
              }
            ]
          : [])
    }
  };

  return {
    event,
    messageId
  };
}

function broadcastMessageEvent(event) {
  const payload = JSON.stringify({
    type: "im.message.receive_v1",
    event
  });

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

const wss = new WebSocketServer({
  noServer: true
});

wss.on("connection", (socket) => {
  sockets.add(socket);
  app.log.info("fake Feishu WS client connected, total=%d", sockets.size);

  socket.on("close", () => {
    sockets.delete(socket);
    app.log.info("fake Feishu WS client disconnected, total=%d", sockets.size);
  });
});

app.server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (client) => {
    wss.emit("connection", client, request);
  });
});

app.get("/health", async () => ({
  ok: true,
  wsClients: sockets.size
}));

app.get("/fake/state", async () => ({
  wsClients: sockets.size,
  inboundEvents: state.inboundEvents,
  outboundMessages: state.outboundMessages,
  replies: state.replies,
  uploads: state.uploads
}));

app.post("/fake/reset", async () => {
  state.inboundEvents.length = 0;
  state.outboundMessages.length = 0;
  state.replies.length = 0;
  state.uploads.length = 0;

  return {
    ok: true
  };
});

app.post("/fake/events/message", async (request) => {
  const { event, messageId } = createInboundEvent(request.body);

  state.inboundEvents.push({
    messageId,
    event,
    createdAt: now()
  });

  broadcastMessageEvent(event);

  return {
    code: 0,
    data: {
      message_id: messageId,
      ws_clients: sockets.size
    }
  };
});

app.post("/open-apis/im/v1/messages", async (request) => {
  const payload = request.body ?? {};
  const query = request.query ?? {};
  const messageId = `om_live_${randomUUID()}`;

  state.outboundMessages.push({
    messageId,
    action: "create",
    receiveIdType: query.receive_id_type ?? "chat_id",
    receiveId: payload.receive_id,
    msgType: payload.msg_type,
    content: safeParseContent(payload.content),
    createdAt: now()
  });

  return {
    code: 0,
    data: {
      message_id: messageId
    }
  };
});

app.patch("/open-apis/im/v1/messages/:message_id", async (request) => {
  const payload = request.body ?? {};
  const params = request.params ?? {};

  state.outboundMessages.push({
    messageId: params.message_id,
    action: "update",
    msgType: payload.msg_type,
    content: safeParseContent(payload.content),
    createdAt: now()
  });

  return {
    code: 0,
    data: {
      message_id: params.message_id
    }
  };
});

app.put("/open-apis/im/v1/messages/:message_id", async (request) => {
  const payload = request.body ?? {};
  const params = request.params ?? {};

  state.outboundMessages.push({
    messageId: params.message_id,
    action: "replace",
    msgType: payload.msg_type,
    content: safeParseContent(payload.content),
    createdAt: now()
  });

  return {
    code: 0,
    data: {
      message_id: params.message_id
    }
  };
});

app.post("/open-apis/im/v1/messages/:message_id/reply", async (request) => {
  const payload = request.body ?? {};
  const params = request.params ?? {};
  const replyMessageId = `om_reply_${randomUUID()}`;

  state.replies.push({
    replyMessageId,
    parentMessageId: params.message_id,
    msgType: payload.msg_type,
    content: safeParseContent(payload.content),
    createdAt: now()
  });

  return {
    code: 0,
    data: {
      message_id: replyMessageId
    }
  };
});

app.post("/open-apis/im/v1/files", async (request) => {
  const payload = request.body ?? {};
  const fileKey = `file_${randomUUID()}`;

  state.uploads.push({
    fileKey,
    payload,
    createdAt: now()
  });

  return {
    code: 0,
    data: {
      file_key: fileKey
    }
  };
});

const start = async () => {
  await app.listen({
    host,
    port
  });
};

start().catch((error) => {
  app.log.error(error);
  process.exitCode = 1;
});

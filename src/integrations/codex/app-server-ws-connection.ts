type JsonRpcId = number;

interface LoggerLike {
  info(message: unknown, ...args: unknown[]): void;
  warn(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface ConnectionHandlers {
  onNotification?: (message: JsonRpcNotification) => void;
  onRequest?: (message: JsonRpcRequest) => void;
  onUnexpectedClose?: (error: Error) => void;
}

interface ConnectionOptions extends ConnectionHandlers {
  logger?: LoggerLike;
  label?: string;
}

function isResponse(message: unknown): message is JsonRpcResponse {
  return Boolean(
    message &&
      typeof message === "object" &&
      "id" in message &&
      ("result" in message || "error" in message)
  );
}

function isRequest(message: unknown): message is JsonRpcRequest {
  return Boolean(
    message &&
      typeof message === "object" &&
      "id" in message &&
      "method" in message
  );
}

function isNotification(message: unknown): message is JsonRpcNotification {
  return Boolean(
    message &&
      typeof message === "object" &&
      !("id" in message) &&
      "method" in message
  );
}

async function decodeMessageData(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }

  if (data instanceof Blob) {
    return data.text();
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  return String(data);
}

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[array:${value.length}]`;
    }

    return value.slice(0, 5).map((item) => summarizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      return `[object:${Object.keys(value as Record<string, unknown>).length}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
    return Object.fromEntries(entries.map(([key, item]) => [key, summarizeValue(item, depth + 1)]));
  }

  return String(value);
}

export class AppServerWsConnection {
  private socket?: WebSocket;
  private nextId = 1;
  private readonly logger?: LoggerLike;
  private readonly label: string;
  private intentionalClose = false;
  private readonly pending = new Map<
    JsonRpcId,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(
    private readonly url: string,
    private readonly options: ConnectionOptions = {}
  ) {
    this.logger = options.logger;
    this.label = options.label ?? "codex-app-server";
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.logger?.info(
      {
        label: this.label,
        url: this.url
      },
      "正在连接 Codex App Server WebSocket"
    );
    const socket = new WebSocket(this.url);
    this.socket = socket;
    this.intentionalClose = false;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
      };

      const handleOpen = () => {
        cleanup();
        this.logger?.info(
          {
            label: this.label,
            url: this.url
          },
          "Codex App Server WebSocket 已连接"
        );
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error(`无法连接 Codex App Server: ${this.url}`));
      };

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("error", handleError);
    });

    socket.addEventListener("message", (event) => {
      void this.handleMessage(event.data);
    });

    socket.addEventListener("close", () => {
      const unexpected = !this.intentionalClose;
      this.logger?.warn(
        {
          label: this.label,
          url: this.url,
          pendingRequests: this.pending.size,
          unexpected
        },
        "Codex App Server WebSocket 已关闭"
      );
      const error = new Error("Codex App Server WebSocket 已关闭");
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      if (unexpected) {
        this.options.onUnexpectedClose?.(error);
      }
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex-feishu-bot",
        title: "Codex Feishu Bot",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true
      }
    });

    this.notify("initialized");
    this.logger?.info(
      {
        label: this.label
      },
      "Codex App Server initialize 完成"
    );
  }

  async close(): Promise<void> {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = undefined;

    if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
      return;
    }

    this.intentionalClose = true;
    await new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
    });
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const responsePromise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      });
    });
    responsePromise.catch(() => undefined);

    this.logger?.info(
      {
        label: this.label,
        direction: "outbound",
        kind: "request",
        id,
        method,
        params: summarizeValue(params)
      },
      "发送 Codex JSON-RPC 请求"
    );
    this.send(request);
    return responsePromise;
  }

  respond(id: JsonRpcId, result: unknown): void {
    this.send({
      jsonrpc: "2.0",
      id,
      result
    });
  }

  respondError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    this.send({
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data
      }
    });
  }

  private notify(method: string, params?: unknown): void {
    this.logger?.info(
      {
        label: this.label,
        direction: "outbound",
        kind: "notification",
        method,
        params: summarizeValue(params)
      },
      "发送 Codex JSON-RPC 通知"
    );
    this.send({
      jsonrpc: "2.0",
      method,
      params
    });
  }

  private send(message: unknown): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Codex App Server WebSocket 未连接");
    }

    socket.send(JSON.stringify(message));
  }

  private async handleMessage(data: unknown): Promise<void> {
    const text = await decodeMessageData(data);
    let message: unknown;
    try {
      message = JSON.parse(text) as unknown;
    } catch (error) {
      this.logger?.error(
        {
          label: this.label,
          raw: text.slice(0, 500),
          error: error instanceof Error ? error.message : String(error)
        },
        "解析 Codex JSON-RPC 消息失败"
      );
      return;
    }

    if (isResponse(message)) {
      this.logger?.info(
        {
          label: this.label,
          direction: "inbound",
          kind: "response",
          id: message.id,
          hasError: Boolean(message.error),
          error: message.error
            ? {
                code: message.error.code,
                message: message.error.message
              }
            : undefined,
          result: message.error ? undefined : summarizeValue(message.result)
        },
        "收到 Codex JSON-RPC 响应"
      );
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }

      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    if (isRequest(message)) {
      this.logger?.info(
        {
          label: this.label,
          direction: "inbound",
          kind: "request",
          id: message.id,
          method: message.method,
          params: summarizeValue(message.params)
        },
        "收到 Codex JSON-RPC 服务端请求"
      );
      this.options.onRequest?.(message);
      return;
    }

    if (isNotification(message)) {
      this.logger?.info(
        {
          label: this.label,
          direction: "inbound",
          kind: "notification",
          method: message.method,
          params: summarizeValue(message.params)
        },
        "收到 Codex JSON-RPC 通知"
      );
      this.options.onNotification?.(message);
    }
  }
}

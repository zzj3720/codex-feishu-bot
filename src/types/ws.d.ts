declare module "ws" {
  export interface RawData {
    toString(encoding?: string): string;
  }

  class WebSocket {
    static readonly OPEN: number;

    constructor(url: string);

    readyState: number;
    once(event: "open", listener: () => void): this;
    once(event: "error", listener: (error: Error) => void): this;
    on(event: "message", listener: (payload: RawData) => void): this;
    on(event: "close", listener: () => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    removeAllListeners(): this;
    close(): void;
    send(payload: string): void;
  }

  export class WebSocketServer {
    constructor(options: {
      noServer: boolean;
    });

    on(event: "connection", listener: (socket: WebSocket) => void): this;
    handleUpgrade(
      request: unknown,
      socket: unknown,
      head: unknown,
      callback: (client: WebSocket) => void
    ): void;
    emit(event: "connection", client: WebSocket, request: unknown): boolean;
  }

  export default WebSocket;
}

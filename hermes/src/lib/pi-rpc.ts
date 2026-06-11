import type {
  RpcCommand,
  RpcResponse,
  AgentEvent,
  RpcConfig
} from './types';

export class PiRpcClient {
  private eventHandlers: Map<string, Set<(event: AgentEvent) => void>> = new Map();
  private pendingRequests: Map<string, (response: RpcResponse) => void> = new Map();
  // @ts-expect-error - Will be used in process communication implementation
  private messageBuffer = '';
  private requestIdCounter = 0;

  async start(cwd: string, config: RpcConfig): Promise<void> {
    console.log('Starting Pi Agent RPC client', { cwd, config });
    // 实际进程启动将在后续实现
  }

  on(eventType: string, handler: (event: AgentEvent) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  async send<T = unknown>(command: RpcCommand): Promise<RpcResponse<T>> {
    const id = `req_${++this.requestIdCounter}`;
    const cmdWithId = { ...command, id };

    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve as any);
      console.log('Sending RPC command:', cmdWithId);
      // 实际发送逻辑将在后续实现
      setTimeout(() => {
        resolve({ id, type: 'response', command: command.type, success: true } as any);
        this.pendingRequests.delete(id);
      }, 100);
    });
  }

  async prompt(message: string): Promise<void> {
    await this.send({ type: 'prompt', message });
  }

  async abort(): Promise<void> {
    await this.send({ type: 'abort' });
  }

  async destroy(): Promise<void> {
    this.eventHandlers.clear();
    this.pendingRequests.clear();
  }
}

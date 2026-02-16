declare module 'discord-rpc' {
  export class Client {
    constructor(options: { transport: 'ipc' | 'websocket' });
    
    on(event: 'ready', listener: () => void): this;
    on(event: 'disconnected', listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    
    login(options: { clientId: string }): Promise<this>;
    setActivity(activity: {
      details?: string;
      state?: string;
      largeImageKey?: string;
      largeImageText?: string;
      smallImageKey?: string;
      smallImageText?: string;
      startTimestamp?: number;
      endTimestamp?: number;
      buttons?: Array<{ label: string; url: string }>;
    }): Promise<void>;
    clearActivity(): Promise<void>;
    destroy(): Promise<void>;
  }
  
  export function register(clientId: string): void;
}

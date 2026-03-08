// eslint-disable-next-line @typescript-eslint/no-var-requires
const RPC = require('discord-rpc');
import log from 'electron-log';

// Discord Application ID - musisz utworzyć aplikację na https://discord.com/developers/applications
const CLIENT_ID = '1339399551766908979'; // Placeholder - zmień na swoje

interface DiscordActivity {
  details?: string;
  state?: string;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  buttons?: Array<{ label: string; url: string }>;
}

class DiscordRPCService {
  private client: any = null;
  private connected: boolean = false;
  private startTime: number = Date.now();
  private currentActivity: DiscordActivity | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;

  async connect(): Promise<boolean> {
    if (this.connected) return true;

    try {
      this.client = new RPC.Client({ transport: 'ipc' });

      this.client.on('ready', () => {
        log.info('[Discord RPC] Connected to Discord');
        this.connected = true;
        this.setActivity({
          details: 'W menu głównym',
          state: 'EnderGate',
          largeImageKey: 'logo',
          largeImageText: 'EnderGate',
          startTimestamp: this.startTime
        });
      });

      this.client.on('disconnected', () => {
        log.warn('[Discord RPC] Disconnected from Discord');
        this.connected = false;
        this.scheduleReconnect();
      });

      await this.client.login({ clientId: CLIENT_ID });
      return true;
    } catch (error) {
      log.warn('[Discord RPC] Failed to connect:', error);
      this.connected = false;
      this.scheduleReconnect();
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    this.reconnectInterval = setInterval(async () => {
      if (!this.connected) {
        log.info('[Discord RPC] Attempting to reconnect...');
        const success = await this.connect();
        if (success && this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      }
    }, 15000); // Co 15 sekund
  }

  async setActivity(activity: DiscordActivity): Promise<void> {
    if (!this.client || !this.connected) {
      this.currentActivity = activity;
      return;
    }

    try {
      await this.client.setActivity({
        details: activity.details,
        state: activity.state,
        largeImageKey: activity.largeImageKey || 'logo',
        largeImageText: activity.largeImageText || 'EnderGate',
        smallImageKey: activity.smallImageKey,
        smallImageText: activity.smallImageText,
        startTimestamp: activity.startTimestamp,
        endTimestamp: activity.endTimestamp,
        buttons: activity.buttons
      });
      this.currentActivity = activity;
      log.info('[Discord RPC] Activity updated:', activity.details);
    } catch (error) {
      log.error('[Discord RPC] Failed to set activity:', error);
    }
  }

  // Aktualizacje statusu dla różnych stanów launchera
  async setInLauncher(): Promise<void> {
    await this.setActivity({
      details: 'W menu głównym',
      state: 'Wybiera wersję do gry',
      largeImageKey: 'logo',
      largeImageText: 'EnderGate',
      startTimestamp: this.startTime
    });
  }

  async setDownloading(version: string, progress?: number): Promise<void> {
    const state = progress !== undefined 
      ? `Pobieranie: ${progress.toFixed(0)}%` 
      : 'Pobieranie...';
    
    await this.setActivity({
      details: `Pobiera Minecraft ${version}`,
      state: state,
      largeImageKey: 'logo',
      largeImageText: 'EnderGate',
      smallImageKey: 'download',
      smallImageText: 'Pobieranie',
      startTimestamp: this.startTime
    });
  }

  async setPlaying(version: string, serverName?: string): Promise<void> {
    const activity: DiscordActivity = {
      details: `Gra w Minecraft ${version}`,
      state: serverName ? `Na serwerze: ${serverName}` : 'Singleplayer',
      largeImageKey: 'logo',
      largeImageText: 'EnderGate',
      smallImageKey: 'minecraft',
      smallImageText: `Minecraft ${version}`,
      startTimestamp: Date.now()
    };

    if (serverName) {
      activity.buttons = [
        { label: 'Dołącz do serwera', url: 'https://discord.gg/endergate' }
      ];
    }

    await this.setActivity(activity);
  }

  async setBrowsingMods(): Promise<void> {
    await this.setActivity({
      details: 'Przegląda mody',
      state: 'W menedżerze modów',
      largeImageKey: 'logo',
      largeImageText: 'EnderGate',
      startTimestamp: this.startTime
    });
  }

  async setInSettings(): Promise<void> {
    await this.setActivity({
      details: 'W ustawieniach',
      state: 'Konfiguruje launcher',
      largeImageKey: 'logo',
      largeImageText: 'EnderGate',
      startTimestamp: this.startTime
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.client) {
      try {
        await this.client.destroy();
        log.info('[Discord RPC] Disconnected');
      } catch (error) {
        log.error('[Discord RPC] Error disconnecting:', error);
      }
      this.client = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const discordRPC = new DiscordRPCService();
export default discordRPC;

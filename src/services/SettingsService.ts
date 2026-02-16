import Store from 'electron-store';
import log from 'electron-log';

import { getLauncherDirectory, DEFAULT_SETTINGS } from '../shared/constants';
import type { LauncherSettings } from '../shared/types';

export class SettingsService {
  private store: Store<LauncherSettings>;

  constructor() {
    this.store = new Store<LauncherSettings>({
      name: 'settings',
      cwd: getLauncherDirectory(),
      defaults: DEFAULT_SETTINGS,
    });
  }

  async getSettings(): Promise<LauncherSettings> {
    return {
      minMemory: this.store.get('minMemory'),
      maxMemory: this.store.get('maxMemory'),
      resolution: this.store.get('resolution'),
      fullscreen: this.store.get('fullscreen'),
      jvmArguments: this.store.get('jvmArguments'),
      gameDirectory: this.store.get('gameDirectory'),
      javaPath: this.store.get('javaPath'),
      closeOnLaunch: this.store.get('closeOnLaunch'),
      showSnapshots: this.store.get('showSnapshots'),
      language: this.store.get('language'),
      theme: this.store.get('theme'),
      accentColor: this.store.get('accentColor'),
      autoUpdate: this.store.get('autoUpdate'),
      checkLoaderUpdates: this.store.get('checkLoaderUpdates'),
      loaderCheckInterval: this.store.get('loaderCheckInterval'),
    };
  }

  async setSettings(settings: Partial<LauncherSettings>): Promise<void> {
    log.info('Updating settings:', settings);

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        this.store.set(key as keyof LauncherSettings, value);
      }
    }
  }

  get<K extends keyof LauncherSettings>(key: K): LauncherSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof LauncherSettings>(key: K, value: LauncherSettings[K]): void {
    this.store.set(key, value);
  }

  reset(): void {
    this.store.clear();
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.store.set(key as keyof LauncherSettings, value);
    }
    log.info('Settings reset to defaults');
  }

  getGameDirectory(): string {
    return this.store.get('gameDirectory');
  }

  getJavaPath(): string | undefined {
    return this.store.get('javaPath');
  }

  getRamSettings(): { min: number; max: number } {
    return {
      min: this.store.get('minMemory'),
      max: this.store.get('maxMemory'),
    };
  }

  getJvmArgs(): string {
    return this.store.get('jvmArguments');
  }
}

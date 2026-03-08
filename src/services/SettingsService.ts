import Store from 'electron-store';
import log from 'electron-log';

import { getLauncherDirectory, DEFAULT_SETTINGS } from '../shared/constants';
import type { LauncherSettings } from '../shared/types';

// VULN-007: Dangerous JVM argument patterns that could load arbitrary code
const DANGEROUS_JVM_PATTERNS = [
  /-javaagent:/i,
  /-agentlib:/i,
  /-agentpath:/i,
  /-Xbootclasspath/i,
  /-Xpatch:/i,
  /--patch-module/i,
];

export function validateJvmArgs(args: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  for (const pattern of DANGEROUS_JVM_PATTERNS) {
    if (pattern.test(args)) {
      warnings.push(`Potentially dangerous JVM argument detected: ${pattern.source}`);
    }
  }
  return { valid: warnings.length === 0, warnings };
}

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

    // VULN-007: Warn about dangerous JVM arguments
    if (settings.jvmArguments !== undefined) {
      const { warnings } = validateJvmArgs(settings.jvmArguments);
      if (warnings.length > 0) {
        log.warn('[Settings] Dangerous JVM arguments detected:', warnings);
      }
    }

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

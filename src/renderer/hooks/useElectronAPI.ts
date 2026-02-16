import type { ElectronAPI } from './electronAPI.d';

export function useElectronAPI(): ElectronAPI {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }
  return window.electronAPI;
}

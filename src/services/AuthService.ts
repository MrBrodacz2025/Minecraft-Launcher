import { Auth } from 'msmc';
import log from 'electron-log';
import Store from 'electron-store';

import { getLauncherDirectory } from '../shared/constants';
import { secureStorage } from './SecureStorageService';
import type { MinecraftProfile } from '../shared/types';

// Profile data stored normally (non-sensitive)
interface AuthStore {
  profile: Omit<MinecraftProfile, 'accessToken' | 'refreshToken'> | null;
}

// Secure token keys
const SECURE_ACCESS_TOKEN_KEY = 'mc_access_token';
const SECURE_REFRESH_TOKEN_KEY = 'mc_refresh_token';

export class AuthService {
  private store: Store<AuthStore>;
  private authManager: Auth;

  constructor() {
    this.store = new Store<AuthStore>({
      name: 'auth',
      cwd: getLauncherDirectory(),
      defaults: {
        profile: null,
      },
    });

    this.authManager = new Auth('select_account');
  }

  async login(): Promise<MinecraftProfile> {
    try {
      log.info('Starting Microsoft login...');

      // Launch Microsoft OAuth login
      const xboxManager = await this.authManager.launch('electron');
      const token = await xboxManager.getMinecraft();

      if (!token.mclc || !token.profile) {
        throw new Error('Failed to get Minecraft token');
      }

      const mclcData = token.mclc();
      
      // Store tokens securely
      await secureStorage.setSecure(SECURE_ACCESS_TOKEN_KEY, mclcData.access_token);
      if (xboxManager.msToken.refresh_token) {
        await secureStorage.setSecure(SECURE_REFRESH_TOKEN_KEY, xboxManager.msToken.refresh_token);
      }

      const profile: MinecraftProfile = {
        id: token.profile.id,
        name: token.profile.name,
        accessToken: mclcData.access_token,
        refreshToken: xboxManager.msToken.refresh_token,
        expiresAt: Date.now() + 86400 * 1000,
        skins: token.profile.skins?.map((skin) => ({
          id: skin.id,
          state: skin.state,
          url: skin.url,
          variant: skin.variant as 'CLASSIC' | 'SLIM',
        })),
        capes: token.profile.capes?.map((cape) => ({
          id: cape.id,
          state: cape.state,
          url: cape.url,
          alias: cape.alias,
        })),
      };

      // Store profile data (without tokens - they're stored securely)
      const { accessToken, refreshToken, ...profileWithoutTokens } = profile;
      this.store.set('profile', profileWithoutTokens);

      log.info(`Successfully logged in as ${profile.name}`);
      return profile;
    } catch (error) {
      log.error('Login failed:', error);
      throw new Error('Failed to login with Microsoft account');
    }
  }

  async logout(): Promise<void> {
    log.info('Logging out...');
    this.store.set('profile', null);
    
    // Clear secure tokens
    await secureStorage.removeSecure(SECURE_ACCESS_TOKEN_KEY);
    await secureStorage.removeSecure(SECURE_REFRESH_TOKEN_KEY);
  }

  async refresh(): Promise<MinecraftProfile> {
    const refreshToken = await secureStorage.getSecure(SECURE_REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      log.info('Refreshing token...');

      const xboxManager = await this.authManager.refresh(refreshToken);
      const token = await xboxManager.getMinecraft();

      if (!token.mclc || !token.profile) {
        throw new Error('Failed to refresh Minecraft token');
      }

      const mclcData = token.mclc();
      
      // Update secure tokens
      await secureStorage.setSecure(SECURE_ACCESS_TOKEN_KEY, mclcData.access_token);
      if (xboxManager.msToken.refresh_token) {
        await secureStorage.setSecure(SECURE_REFRESH_TOKEN_KEY, xboxManager.msToken.refresh_token);
      }

      const profile: MinecraftProfile = {
        id: token.profile.id,
        name: token.profile.name,
        accessToken: mclcData.access_token,
        refreshToken: xboxManager.msToken.refresh_token,
        expiresAt: Date.now() + 86400 * 1000,
        skins: token.profile.skins?.map((skin) => ({
          id: skin.id,
          state: skin.state,
          url: skin.url,
          variant: skin.variant as 'CLASSIC' | 'SLIM',
        })),
        capes: token.profile.capes?.map((cape) => ({
          id: cape.id,
          state: cape.state,
          url: cape.url,
          alias: cape.alias,
        })),
      };

      // Update stored profile (without tokens)
      const { accessToken, refreshToken: newRefreshToken, ...profileWithoutTokens } = profile;
      this.store.set('profile', profileWithoutTokens);

      log.info('Token refreshed successfully');
      return profile;
    } catch (error) {
      log.error('Token refresh failed:', error);
      throw new Error('Failed to refresh authentication');
    }
  }

  async getProfile(): Promise<MinecraftProfile | null> {
    const storedProfile = this.store.get('profile');

    if (!storedProfile) {
      return null;
    }

    // Check if token is expired
    if (storedProfile.expiresAt && Date.now() >= storedProfile.expiresAt) {
      log.info('Token expired, attempting refresh...');
      try {
        return await this.refresh();
      } catch {
        log.warn('Failed to refresh expired token');
        return null;
      }
    }

    // Reconstruct profile with tokens from secure storage
    const accessToken = await secureStorage.getSecure(SECURE_ACCESS_TOKEN_KEY);
    const refreshToken = await secureStorage.getSecure(SECURE_REFRESH_TOKEN_KEY);

    if (!accessToken) {
      log.warn('No access token found in secure storage');
      return null;
    }

    return {
      ...storedProfile,
      accessToken,
      refreshToken: refreshToken || undefined,
    };
  }

  async isLoggedIn(): Promise<boolean> {
    const profile = this.store.get('profile');
    const accessToken = await secureStorage.getSecure(SECURE_ACCESS_TOKEN_KEY);
    return profile !== null && accessToken !== null && profile.expiresAt > Date.now();
  }

  async getAccessToken(): Promise<string | null> {
    return await secureStorage.getSecure(SECURE_ACCESS_TOKEN_KEY);
  }
}

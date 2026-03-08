import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';
import * as semver from 'semver';

import {
  MINECRAFT_VERSION_MANIFEST_URL,
  MIN_MINECRAFT_VERSION,
  VERSION_CACHE_TTL,
} from '../shared/constants';
import type {
  MinecraftVersion,
  MinecraftVersionManifest,
  MinecraftVersionDetails,
} from '../shared/types';

interface VersionCache {
  manifest: MinecraftVersionManifest | null;
  details: Map<string, MinecraftVersionDetails>;
  lastFetch: number;
}

export class MinecraftAPI {
  private client: AxiosInstance;
  private cache: VersionCache = {
    manifest: null,
    details: new Map(),
    lastFetch: 0,
  };

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'EnderGate/1.0.0',
      },
    });
  }

  async getVersionManifest(): Promise<MinecraftVersionManifest> {
    // Check cache
    if (
      this.cache.manifest &&
      Date.now() - this.cache.lastFetch < VERSION_CACHE_TTL
    ) {
      return this.cache.manifest;
    }

    try {
      const response = await this.client.get<MinecraftVersionManifest>(
        MINECRAFT_VERSION_MANIFEST_URL
      );
      this.cache.manifest = response.data;
      this.cache.lastFetch = Date.now();
      return response.data;
    } catch (error) {
      log.error('Failed to fetch version manifest:', error);
      throw new Error('Failed to fetch Minecraft version manifest');
    }
  }

  async getAvailableVersions(includeSnapshots = false): Promise<MinecraftVersion[]> {
    const manifest = await this.getVersionManifest();
    
    return manifest.versions.filter((version) => {
      // Filter by type
      if (!includeSnapshots && version.type !== 'release') {
        return false;
      }

      // Filter by minimum version (1.17.2+)
      if (version.type === 'release') {
        const cleanVersion = version.id.split('-')[0];
        if (semver.valid(semver.coerce(cleanVersion))) {
          const minVersion = semver.coerce(MIN_MINECRAFT_VERSION);
          const currentVersion = semver.coerce(cleanVersion);
          if (minVersion && currentVersion && semver.lt(currentVersion, minVersion)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  async getVersionDetails(versionId: string): Promise<MinecraftVersionDetails> {
    // Check cache
    const cached = this.cache.details.get(versionId);
    if (cached) {
      return cached;
    }

    const manifest = await this.getVersionManifest();
    const version = manifest.versions.find((v) => v.id === versionId);

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    try {
      const response = await this.client.get<MinecraftVersionDetails>(version.url);
      this.cache.details.set(versionId, response.data);
      return response.data;
    } catch (error) {
      log.error(`Failed to fetch version details for ${versionId}:`, error);
      throw new Error(`Failed to fetch version details for ${versionId}`);
    }
  }

  async getLatestRelease(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.release;
  }

  async getLatestSnapshot(): Promise<string> {
    const manifest = await this.getVersionManifest();
    return manifest.latest.snapshot;
  }

  isVersionSupported(versionId: string): boolean {
    const cleanVersion = versionId.split('-')[0];
    const coerced = semver.coerce(cleanVersion);
    const minCoerced = semver.coerce(MIN_MINECRAFT_VERSION);
    
    if (!coerced || !minCoerced) {
      return false;
    }
    
    return semver.gte(coerced, minCoerced);
  }

  clearCache(): void {
    this.cache.manifest = null;
    this.cache.details.clear();
    this.cache.lastFetch = 0;
  }
}

export const minecraftAPI = new MinecraftAPI();

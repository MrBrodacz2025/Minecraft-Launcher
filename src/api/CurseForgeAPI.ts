import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

import { CURSEFORGE_API_URL, CURSEFORGE_API_KEY, CURSEFORGE_MINECRAFT_ID } from '../shared/constants';
import type { Mod, ModVersion, ModDependency, LoaderType, ModSearchFilters, Modpack, ModpackFile, ModpackSearchFilters } from '../shared/types';

interface CurseForgeSearchResult {
  data: CurseForgeMod[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

interface CurseForgeMod {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  links: {
    websiteUrl: string;
    wikiUrl?: string;
    issuesUrl?: string;
    sourceUrl?: string;
  };
  summary: string;
  status: number;
  downloadCount: number;
  isFeatured: boolean;
  primaryCategoryId: number;
  categories: CurseForgeCategory[];
  classId?: number;
  authors: CurseForgeAuthor[];
  logo?: {
    id: number;
    modId: number;
    title: string;
    description: string;
    thumbnailUrl: string;
    url: string;
  };
  screenshots: CurseForgeScreenshot[];
  mainFileId: number;
  latestFiles: CurseForgeFile[];
  latestFilesIndexes: CurseForgeFileIndex[];
  dateCreated: string;
  dateModified: string;
  dateReleased: string;
  allowModDistribution?: boolean;
  gamePopularityRank: number;
  isAvailable: boolean;
  thumbsUpCount: number;
}

interface CurseForgeCategory {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  url: string;
  iconUrl: string;
  dateModified: string;
  isClass?: boolean;
  classId?: number;
  parentCategoryId?: number;
  displayIndex?: number;
}

interface CurseForgeAuthor {
  id: number;
  name: string;
  url: string;
}

interface CurseForgeScreenshot {
  id: number;
  modId: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
}

interface CurseForgeFile {
  id: number;
  gameId: number;
  modId: number;
  isAvailable: boolean;
  displayName: string;
  fileName: string;
  releaseType: number; // 1=release, 2=beta, 3=alpha
  fileStatus: number;
  hashes: {
    value: string;
    algo: number;
  }[];
  fileDate: string;
  fileLength: number;
  downloadCount: number;
  downloadUrl: string | null;
  gameVersions: string[];
  sortableGameVersions: {
    gameVersionName: string;
    gameVersionPadded: string;
    gameVersion: string;
    gameVersionReleaseDate: string;
    gameVersionTypeId?: number;
  }[];
  dependencies: CurseForgeDependency[];
  alternateFileId?: number;
  isServerPack?: boolean;
  fileFingerprint: number;
  modules: {
    name: string;
    fingerprint: number;
  }[];
}

interface CurseForgeFileIndex {
  gameVersion: string;
  fileId: number;
  filename: string;
  releaseType: number;
  gameVersionTypeId?: number;
  modLoader?: number;
}

interface CurseForgeDependency {
  modId: number;
  relationType: number; // 1=embedded, 2=optional, 3=required, 4=tool, 5=incompatible, 6=include
}

// Mod loader type IDs in CurseForge
const CURSEFORGE_MOD_LOADER_IDS: Record<number, LoaderType> = {
  1: 'forge',
  4: 'fabric',
  6: 'neoforge',
};

export class CurseForgeAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: CURSEFORGE_API_URL,
      timeout: 30000,
      headers: {
        'x-api-key': CURSEFORGE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async searchMods(query: string, filters: ModSearchFilters): Promise<Mod[]> {
    try {
      const params: Record<string, unknown> = {
        gameId: CURSEFORGE_MINECRAFT_ID,
        classId: 6, // Mods class
        searchFilter: query,
        pageSize: filters.pageSize || 20,
        index: ((filters.page || 1) - 1) * (filters.pageSize || 20),
      };

      if (filters.gameVersion) {
        params.gameVersion = filters.gameVersion;
      }

      if (filters.loader && filters.loader !== 'vanilla') {
        const loaderId = this.getModLoaderId(filters.loader);
        if (loaderId) {
          params.modLoaderType = loaderId;
        }
      }

      if (filters.sortBy) {
        params.sortField = this.getSortField(filters.sortBy);
        params.sortOrder = 'desc';
      }

      const response = await this.client.get<CurseForgeSearchResult>('/mods/search', { params });
      
      return response.data.data.map((mod) => this.convertMod(mod));
    } catch (error) {
      log.error('CurseForge search failed:', error);
      throw new Error('Failed to search CurseForge mods');
    }
  }

  async getMod(modId: number): Promise<Mod | null> {
    try {
      const response = await this.client.get<{ data: CurseForgeMod }>(`/mods/${modId}`);
      return this.convertMod(response.data.data);
    } catch (error) {
      log.error(`Failed to get mod ${modId}:`, error);
      return null;
    }
  }

  async getModFiles(
    modId: number,
    gameVersion?: string,
    modLoader?: LoaderType
  ): Promise<ModVersion[]> {
    try {
      const params: Record<string, unknown> = {
        pageSize: 50,
      };

      if (gameVersion) {
        params.gameVersion = gameVersion;
      }

      if (modLoader && modLoader !== 'vanilla') {
        const loaderId = this.getModLoaderId(modLoader);
        if (loaderId) {
          params.modLoaderType = loaderId;
        }
      }

      const response = await this.client.get<{ data: CurseForgeFile[] }>(
        `/mods/${modId}/files`,
        { params }
      );

      return response.data.data.map((file) => this.convertFile(file, modId.toString()));
    } catch (error) {
      log.error(`Failed to get files for mod ${modId}:`, error);
      return [];
    }
  }

  async getFileDownloadUrl(modId: number, fileId: number): Promise<string | null> {
    try {
      const response = await this.client.get<{ data: string }>(
        `/mods/${modId}/files/${fileId}/download-url`
      );
      return response.data.data;
    } catch (error) {
      log.error(`Failed to get download URL for ${modId}/${fileId}:`, error);
      return null;
    }
  }

  async getModsByIds(modIds: number[]): Promise<Mod[]> {
    try {
      const response = await this.client.post<{ data: CurseForgeMod[] }>('/mods', {
        modIds,
      });
      return response.data.data.map((mod) => this.convertMod(mod));
    } catch (error) {
      log.error('Failed to get mods by IDs:', error);
      return [];
    }
  }

  private convertMod(curseforgeMod: CurseForgeMod): Mod {
    return {
      id: curseforgeMod.id.toString(),
      name: curseforgeMod.name,
      slug: curseforgeMod.slug,
      description: curseforgeMod.summary,
      author: curseforgeMod.authors[0]?.name || 'Unknown',
      downloads: curseforgeMod.downloadCount,
      iconUrl: curseforgeMod.logo?.thumbnailUrl,
      categories: curseforgeMod.categories.map((c) => c.name),
      source: 'curseforge',
      websiteUrl: curseforgeMod.links.websiteUrl,
      versions: curseforgeMod.latestFiles.map((file) => 
        this.convertFile(file, curseforgeMod.id.toString())
      ),
    };
  }

  private convertFile(file: CurseForgeFile, modId: string): ModVersion {
    const loaders: LoaderType[] = [];
    
    // Extract loaders from game versions
    for (const gv of file.gameVersions) {
      const lowerGv = gv.toLowerCase();
      if (lowerGv === 'fabric') loaders.push('fabric');
      if (lowerGv === 'forge') loaders.push('forge');
      if (lowerGv === 'neoforge') loaders.push('neoforge');
    }

    // If no loaders detected, assume forge for older mods
    if (loaders.length === 0) {
      loaders.push('forge');
    }

    // Extract Minecraft versions
    const gameVersions = file.gameVersions.filter((gv) => {
      return /^\d+\.\d+(\.\d+)?$/.test(gv);
    });

    return {
      id: file.id.toString(),
      modId,
      name: file.displayName,
      versionNumber: file.displayName,
      gameVersions,
      loaders: [...new Set(loaders)],
      downloadUrl: file.downloadUrl || '',
      fileName: file.fileName,
      fileSize: file.fileLength,
      dependencies: file.dependencies.map((dep) => this.convertDependency(dep)),
      releaseType: this.getReleaseType(file.releaseType),
      datePublished: file.fileDate,
      hashes: this.extractHashes(file.hashes),
    };
  }

  private convertDependency(dep: CurseForgeDependency): ModDependency {
    let type: ModDependency['type'];
    switch (dep.relationType) {
      case 1: type = 'embedded'; break;
      case 2: type = 'optional'; break;
      case 3: type = 'required'; break;
      case 5: type = 'incompatible'; break;
      default: type = 'optional';
    }

    return {
      modId: dep.modId.toString(),
      type,
    };
  }

  private getReleaseType(type: number): 'release' | 'beta' | 'alpha' {
    switch (type) {
      case 1: return 'release';
      case 2: return 'beta';
      case 3: return 'alpha';
      default: return 'release';
    }
  }

  private extractHashes(hashes: { value: string; algo: number }[]): { sha1?: string; sha512?: string } | undefined {
    if (!hashes || hashes.length === 0) return undefined;
    const result: { sha1?: string; sha512?: string } = {};
    for (const h of hashes) {
      if (h.algo === 1) result.sha1 = h.value; // SHA1
      // CurseForge uses algo 2 for MD5, no SHA512 available
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  private getModLoaderId(loader: LoaderType): number | null {
    for (const [id, name] of Object.entries(CURSEFORGE_MOD_LOADER_IDS)) {
      if (name === loader) return parseInt(id);
    }
    return null;
  }

  private getSortField(sortBy: string): number {
    switch (sortBy) {
      case 'relevance': return 1;
      case 'downloads': return 2;
      case 'updated': return 3;
      case 'newest': return 4;
      default: return 1;
    }
  }

  // ==================== MODPACKS ====================

  async searchModpacks(query: string, filters: ModpackSearchFilters): Promise<Modpack[]> {
    try {
      const params: Record<string, unknown> = {
        gameId: CURSEFORGE_MINECRAFT_ID,
        classId: 4471, // Modpacks class
        searchFilter: query,
        pageSize: filters.pageSize || 20,
        index: ((filters.page || 1) - 1) * (filters.pageSize || 20),
      };

      if (filters.gameVersion) {
        params.gameVersion = filters.gameVersion;
      }

      if (filters.loader && filters.loader !== 'vanilla') {
        const loaderId = this.getModLoaderId(filters.loader);
        if (loaderId) {
          params.modLoaderType = loaderId;
        }
      }

      if (filters.sortBy) {
        params.sortField = this.getSortField(filters.sortBy);
        params.sortOrder = 'desc';
      }

      const response = await this.client.get<CurseForgeSearchResult>('/mods/search', { params });

      return response.data.data.map((mod) => this.convertModpack(mod));
    } catch (error) {
      log.error('CurseForge modpack search failed:', error);
      throw new Error('Failed to search CurseForge modpacks');
    }
  }

  async getModpack(modpackId: number): Promise<Modpack | null> {
    try {
      const response = await this.client.get<{ data: CurseForgeMod }>(`/mods/${modpackId}`);
      return this.convertModpack(response.data.data);
    } catch (error) {
      log.error(`Failed to get modpack ${modpackId}:`, error);
      return null;
    }
  }

  async getModpackFiles(modpackId: number, gameVersion?: string): Promise<ModpackFile[]> {
    try {
      const params: Record<string, unknown> = {
        pageSize: 50,
      };

      if (gameVersion) {
        params.gameVersion = gameVersion;
      }

      const response = await this.client.get<{ data: CurseForgeFile[] }>(
        `/mods/${modpackId}/files`,
        { params }
      );

      return response.data.data.map((file) => this.convertModpackFile(file, modpackId.toString()));
    } catch (error) {
      log.error(`Failed to get files for modpack ${modpackId}:`, error);
      return [];
    }
  }

  private convertModpack(curseforgeMod: CurseForgeMod): Modpack {
    return {
      id: curseforgeMod.id.toString(),
      name: curseforgeMod.name,
      slug: curseforgeMod.slug,
      description: curseforgeMod.summary,
      author: curseforgeMod.authors[0]?.name || 'Unknown',
      downloads: curseforgeMod.downloadCount,
      iconUrl: curseforgeMod.logo?.thumbnailUrl,
      categories: curseforgeMod.categories.map((c) => c.name),
      source: 'curseforge',
      websiteUrl: curseforgeMod.links.websiteUrl,
      latestFiles: curseforgeMod.latestFiles.map((file) =>
        this.convertModpackFile(file, curseforgeMod.id.toString())
      ),
    };
  }

  private convertModpackFile(file: CurseForgeFile, modpackId: string): ModpackFile {
    const loaders: LoaderType[] = [];
    for (const gv of file.gameVersions) {
      const lowerGv = gv.toLowerCase();
      if (lowerGv === 'fabric') loaders.push('fabric');
      if (lowerGv === 'forge') loaders.push('forge');
      if (lowerGv === 'neoforge') loaders.push('neoforge');
    }
    if (loaders.length === 0) loaders.push('forge');

    const gameVersions = file.gameVersions.filter((gv) => /^\d+\.\d+(\.\d+)?$/.test(gv));

    return {
      id: file.id.toString(),
      modpackId,
      name: file.displayName,
      versionNumber: file.displayName,
      gameVersions,
      loaders: [...new Set(loaders)],
      downloadUrl: file.downloadUrl || '',
      fileName: file.fileName,
      fileSize: file.fileLength,
      releaseType: this.getReleaseType(file.releaseType),
      datePublished: file.fileDate,
    };
  }
}

export const curseForgeAPI = new CurseForgeAPI();

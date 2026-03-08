import axios, { AxiosInstance } from 'axios';
import log from 'electron-log';

import { MODRINTH_API_URL } from '../shared/constants';
import type { Mod, ModVersion, ModDependency, LoaderType, ModSearchFilters } from '../shared/types';

interface ModrinthSearchResult {
  hits: ModrinthProject[];
  offset: number;
  limit: number;
  total_hits: number;
}

interface ModrinthProject {
  project_id: string;
  project_type: string;
  slug: string;
  author: string;
  title: string;
  description: string;
  categories: string[];
  display_categories: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url?: string;
  date_created: string;
  date_modified: string;
  latest_version?: string;
  license: string;
  client_side: string;
  server_side: string;
  gallery: string[];
  featured_gallery?: string;
  color?: number;
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  featured: boolean;
  name: string;
  version_number: string;
  changelog?: string;
  changelog_url?: string;
  date_published: string;
  downloads: number;
  version_type: 'release' | 'beta' | 'alpha';
  status: string;
  requested_status?: string;
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
  game_versions: string[];
  loaders: string[];
}

interface ModrinthFile {
  hashes: {
    sha1: string;
    sha512: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  file_type?: string;
}

interface ModrinthDependency {
  version_id?: string;
  project_id?: string;
  file_name?: string;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export class ModrinthAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: MODRINTH_API_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'EnderGate/1.0.0 (contact@example.com)',
        'Content-Type': 'application/json',
      },
    });
  }

  async searchMods(query: string, filters: ModSearchFilters): Promise<Mod[]> {
    try {
      const facets: string[][] = [['project_type:mod']];

      if (filters.gameVersion) {
        facets.push([`versions:${filters.gameVersion}`]);
      }

      if (filters.loader && filters.loader !== 'vanilla') {
        facets.push([`categories:${filters.loader}`]);
      }

      if (filters.category) {
        facets.push([`categories:${filters.category}`]);
      }

      const params: Record<string, unknown> = {
        query,
        facets: JSON.stringify(facets),
        limit: filters.pageSize || 20,
        offset: ((filters.page || 1) - 1) * (filters.pageSize || 20),
      };

      if (filters.sortBy) {
        params.index = this.getSortIndex(filters.sortBy);
      }

      const response = await this.client.get<ModrinthSearchResult>('/search', { params });

      // Get full project details for each hit
      const mods: Mod[] = [];
      for (const hit of response.data.hits) {
        mods.push(await this.convertProject(hit));
      }

      return mods;
    } catch (error) {
      log.error('Modrinth search failed:', error);
      throw new Error('Failed to search Modrinth mods');
    }
  }

  async getProject(projectIdOrSlug: string): Promise<Mod | null> {
    try {
      const response = await this.client.get<ModrinthProject>(`/project/${projectIdOrSlug}`);
      return this.convertProject(response.data);
    } catch (error) {
      log.error(`Failed to get project ${projectIdOrSlug}:`, error);
      return null;
    }
  }

  async getProjectVersions(
    projectIdOrSlug: string,
    gameVersion?: string,
    loader?: LoaderType
  ): Promise<ModVersion[]> {
    try {
      const params: Record<string, unknown> = {};

      if (gameVersion) {
        params.game_versions = JSON.stringify([gameVersion]);
      }

      if (loader && loader !== 'vanilla') {
        params.loaders = JSON.stringify([loader]);
      }

      const response = await this.client.get<ModrinthVersion[]>(
        `/project/${projectIdOrSlug}/version`,
        { params }
      );

      return response.data.map((version) => this.convertVersion(version));
    } catch (error) {
      log.error(`Failed to get versions for ${projectIdOrSlug}:`, error);
      return [];
    }
  }

  async getVersion(versionId: string): Promise<ModVersion | null> {
    try {
      const response = await this.client.get<ModrinthVersion>(`/version/${versionId}`);
      return this.convertVersion(response.data);
    } catch (error) {
      log.error(`Failed to get version ${versionId}:`, error);
      return null;
    }
  }

  async getVersionsById(versionIds: string[]): Promise<ModVersion[]> {
    try {
      const response = await this.client.get<ModrinthVersion[]>('/versions', {
        params: {
          ids: JSON.stringify(versionIds),
        },
      });
      return response.data.map((version) => this.convertVersion(version));
    } catch (error) {
      log.error('Failed to get versions by ID:', error);
      return [];
    }
  }

  async getProjectsByIds(projectIds: string[]): Promise<Mod[]> {
    try {
      const response = await this.client.get<ModrinthProject[]>('/projects', {
        params: {
          ids: JSON.stringify(projectIds),
        },
      });
      
      const mods: Mod[] = [];
      for (const project of response.data) {
        mods.push(await this.convertProject(project));
      }
      return mods;
    } catch (error) {
      log.error('Failed to get projects by IDs:', error);
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const response = await this.client.get<{ name: string; project_type: string }[]>('/tag/category');
      return response.data
        .filter((cat) => cat.project_type === 'mod')
        .map((cat) => cat.name);
    } catch (error) {
      log.error('Failed to get categories:', error);
      return [];
    }
  }

  async getGameVersions(): Promise<string[]> {
    try {
      const response = await this.client.get<{ version: string; version_type: string }[]>('/tag/game_version');
      return response.data
        .filter((v) => v.version_type === 'release')
        .map((v) => v.version);
    } catch (error) {
      log.error('Failed to get game versions:', error);
      return [];
    }
  }

  private async convertProject(project: ModrinthProject): Promise<Mod> {
    // Get versions for this project
    let versions: ModVersion[] = [];
    try {
      versions = await this.getProjectVersions(project.project_id);
    } catch {
      // Ignore errors - we'll just have empty versions
    }

    return {
      id: project.project_id,
      name: project.title,
      slug: project.slug,
      description: project.description,
      author: project.author,
      downloads: project.downloads,
      iconUrl: project.icon_url,
      categories: project.categories,
      source: 'modrinth',
      websiteUrl: `https://modrinth.com/mod/${project.slug}`,
      versions,
    };
  }

  private convertVersion(version: ModrinthVersion): ModVersion {
    const primaryFile = version.files.find((f) => f.primary) || version.files[0];

    return {
      id: version.id,
      modId: version.project_id,
      name: version.name,
      versionNumber: version.version_number,
      gameVersions: version.game_versions,
      loaders: version.loaders.map((l) => this.normalizeLoader(l)),
      downloadUrl: primaryFile?.url || '',
      fileName: primaryFile?.filename || '',
      fileSize: primaryFile?.size || 0,
      dependencies: version.dependencies.map((dep) => this.convertDependency(dep)),
      releaseType: version.version_type,
      datePublished: version.date_published,
    };
  }

  private convertDependency(dep: ModrinthDependency): ModDependency {
    return {
      modId: dep.project_id || dep.version_id || '',
      type: dep.dependency_type,
      versionId: dep.version_id,
    };
  }

  private normalizeLoader(loader: string): LoaderType {
    const normalized = loader.toLowerCase();
    if (normalized === 'fabric') return 'fabric';
    if (normalized === 'forge') return 'forge';
    if (normalized === 'neoforge') return 'neoforge';
    if (normalized === 'quilt') return 'fabric'; // Quilt is fabric-compatible
    return 'vanilla';
  }

  private getSortIndex(sortBy: string): string {
    switch (sortBy) {
      case 'relevance': return 'relevance';
      case 'downloads': return 'downloads';
      case 'updated': return 'updated';
      case 'newest': return 'newest';
      default: return 'relevance';
    }
  }
}

export const modrinthAPI = new ModrinthAPI();

/**
 * IPC parameter validation schemas using Zod
 * VULN-003: Prevents injection and manipulation through IPC parameters
 */

import { z } from 'zod';

// Reusable patterns
const versionIdPattern = /^[a-zA-Z0-9._\-+]+$/;
const safeStringPattern = /^[a-zA-Z0-9._\-+\s/\\:()]+$/;

// ==================== BASIC SCHEMAS ====================

export const versionIdSchema = z.string()
  .min(1, 'Version ID cannot be empty')
  .max(200, 'Version ID too long')
  .regex(versionIdPattern, 'Invalid version ID format');

export const loaderTypeSchema = z.enum(['vanilla', 'fabric', 'forge', 'neoforge']);

export const sourceSchema = z.enum(['curseforge', 'modrinth']);

export const allSourceSchema = z.enum(['curseforge', 'modrinth', 'all']);

// ==================== SETTINGS ====================

export const settingsSchema = z.object({
  minMemory: z.number().int().min(256).max(32768).optional(),
  maxMemory: z.number().int().min(512).max(65536).optional(),
  resolution: z.object({
    width: z.number().int().min(1).max(15360),
    height: z.number().int().min(1).max(8640),
  }).optional(),
  fullscreen: z.boolean().optional(),
  jvmArguments: z.string().max(2000).optional(),
  gameDirectory: z.string().min(1).max(500).optional(),
  javaPath: z.string().max(500).optional(),
  closeOnLaunch: z.boolean().optional(),
  showSnapshots: z.boolean().optional(),
  language: z.string().min(2).max(10).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  autoUpdate: z.boolean().optional(),
  checkLoaderUpdates: z.boolean().optional(),
  loaderCheckInterval: z.number().int().min(1).max(1440).optional(),
}).partial();

// ==================== MOD SEARCH ====================

export const modSearchFiltersSchema = z.object({
  gameVersion: z.string().max(50).optional(),
  loader: loaderTypeSchema.optional(),
  category: z.string().max(100).optional(),
  source: allSourceSchema.optional(),
  sortBy: z.enum(['relevance', 'downloads', 'updated', 'newest']).optional(),
  page: z.number().int().min(0).max(1000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const modpackSearchFiltersSchema = z.object({
  gameVersion: z.string().max(50).optional(),
  loader: loaderTypeSchema.optional(),
  source: allSourceSchema.optional(),
  sortBy: z.enum(['relevance', 'downloads', 'updated', 'newest']).optional(),
  page: z.number().int().min(0).max(1000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// ==================== MOD/MODPACK OBJECTS ====================

// These validate structure of objects passed from renderer
export const modSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  description: z.string().max(10000),
  author: z.string().max(200),
  downloads: z.number().min(0),
  iconUrl: z.string().max(2000).optional(),
  categories: z.array(z.string().max(100)),
  source: sourceSchema,
  websiteUrl: z.string().max(2000).optional(),
  versions: z.array(z.any()), // versions are complex, validated deeper when used
});

export const modVersionSchema = z.object({
  id: z.string().min(1).max(200),
  modId: z.string().min(1).max(200),
  name: z.string().max(500),
  versionNumber: z.string().max(200),
  gameVersions: z.array(z.string().max(50)),
  loaders: z.array(loaderTypeSchema),
  downloadUrl: z.string().max(2000),
  fileName: z.string().max(500),
  fileSize: z.number().min(0),
  dependencies: z.array(z.object({
    modId: z.string().max(200),
    type: z.enum(['required', 'optional', 'incompatible', 'embedded']),
    versionId: z.string().max(200).optional(),
  })),
  releaseType: z.enum(['release', 'beta', 'alpha']),
  datePublished: z.string().max(100),
  hashes: z.object({
    sha1: z.string().optional(),
    sha512: z.string().optional(),
  }).optional(),
});

export const modpackSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  description: z.string().max(10000),
  author: z.string().max(200),
  downloads: z.number().min(0),
  iconUrl: z.string().max(2000).optional(),
  categories: z.array(z.string().max(100)),
  source: sourceSchema,
  websiteUrl: z.string().max(2000).optional(),
  latestFiles: z.array(z.any()),
});

export const modpackFileSchema = z.object({
  id: z.string().min(1).max(200),
  modpackId: z.string().min(1).max(200),
  name: z.string().max(500),
  versionNumber: z.string().max(200),
  gameVersions: z.array(z.string().max(50)),
  loaders: z.array(loaderTypeSchema),
  downloadUrl: z.string().max(2000),
  fileName: z.string().max(500),
  fileSize: z.number().min(0),
  releaseType: z.enum(['release', 'beta', 'alpha']),
  datePublished: z.string().max(100),
});

// ==================== LAUNCH CONFIG ====================

export const launchConfigSchema = z.object({
  version: z.string().min(1).max(200).regex(versionIdPattern),
  loader: loaderTypeSchema.optional(),
  loaderVersion: z.string().max(200).regex(versionIdPattern).optional(),
  profile: z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    expiresAt: z.number(),
    skins: z.array(z.any()).optional(),
    capes: z.array(z.any()).optional(),
  }),
  settings: z.object({
    minMemory: z.number().int().min(256).max(32768),
    maxMemory: z.number().int().min(512).max(65536),
    resolution: z.object({
      width: z.number().int().min(1).max(15360),
      height: z.number().int().min(1).max(8640),
    }),
    fullscreen: z.boolean(),
    jvmArguments: z.string().max(2000),
    gameDirectory: z.string().min(1).max(500),
    javaPath: z.string().max(500).optional(),
    closeOnLaunch: z.boolean(),
    showSnapshots: z.boolean(),
    language: z.string().min(2).max(10),
    theme: z.enum(['dark', 'light']),
    accentColor: z.string(),
    autoUpdate: z.boolean(),
    checkLoaderUpdates: z.boolean(),
    loaderCheckInterval: z.number().int().min(1).max(1440),
  }),
  modpackPath: z.string().max(500).optional(),
  modpackName: z.string().max(500).optional(),
});

// ==================== HELPER ====================

export function validateIpcParam<T>(schema: z.ZodSchema<T>, value: unknown, paramName: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`IPC validation failed for ${paramName}: ${errors}`);
  }
  return result.data;
}

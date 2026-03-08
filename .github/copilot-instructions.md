# GitHub Copilot Project Context

This file provides context about the EnderGate Minecraft Launcher project for GitHub Copilot.

## Project Overview

**EnderGate** is an unofficial Minecraft Java Edition launcher built with:
- **Electron 40.x** - Desktop application framework
- **TypeScript 5.3** - Type-safe JavaScript
- **React 18.2** - UI library
- **Tailwind CSS 3.4** - Utility-first CSS framework

## Architecture

### Process Model
- **Main Process** (`src/main/`) - Node.js environment, handles IPC, file system, auth
- **Renderer Process** (`src/renderer/`) - React app, UI, sandboxed
- **Preload** (`src/main/preload.ts`) - contextBridge for secure IPC

### Key Directories
- `src/api/` - External API clients (Minecraft, CurseForge, Modrinth, Fabric, Forge, NeoForge)
- `src/services/` - Core business logic services
- `src/renderer/components/` - React UI components
- `src/renderer/pages/` - Page components
- `src/shared/` - Shared types and constants

## Security Guidelines

### DO:
- Use `contextIsolation: true` in BrowserWindow options
- Use `sandbox: true` in BrowserWindow options
- Expose APIs through `contextBridge` only
- Validate all IPC messages in main process
- Verify file hashes for downloads
- Use `shell.openExternal()` for external links

### DON'T:
- Enable `nodeIntegration` in renderer
- Disable `webSecurity`
- Store sensitive credentials in source code (use environment variables)
- Trust user input without validation

### Safe Public Keys
These keys are intentionally public and safe to include in code:
- `CURSEFORGE_API_KEY` - Public CurseForge desktop app key
- `MICROSOFT_CLIENT_ID` - Official Minecraft OAuth client ID
- `Discord CLIENT_ID` - Public Discord RPC app ID

## Code Conventions

### TypeScript
- Use strict TypeScript with proper types
- Define interfaces in `src/shared/types.ts`
- Use absolute imports from `src/`

### React
- Functional components with hooks
- Use `useElectronAPI` hook for IPC communication
- Tailwind for styling (no inline styles)

### IPC Communication
- Define channels in `src/shared/constants.ts` (IPC_CHANNELS)
- Handle in `src/main/ipc.ts`
- Expose in `src/main/preload.ts`
- Access via `window.electronAPI` in renderer

## Important Services

| Service | File | Purpose |
|---------|------|---------|
| AuthService | `src/services/AuthService.ts` | Microsoft/Xbox login via msmc |
| SecureStorageService | `src/services/SecureStorageService.ts` | Encrypted credential storage |
| VersionManager | `src/services/VersionManager.ts` | Minecraft version installation |
| LoaderManager | `src/loader-manager/LoaderManager.ts` | Fabric/Forge/NeoForge |
| ModManager | `src/mod-manager/ModManager.ts` | Mod installation from CurseForge/Modrinth |
| MinecraftLauncherService | `src/services/MinecraftLauncherService.ts` | Game launching |
| DiscordRPCService | `src/services/DiscordRPCService.ts` | Discord Rich Presence |
| JavaService | `src/services/JavaService.ts` | Java version management |

## Internationalization (i18n)

The launcher supports multiple languages:
- **Location**: `src/renderer/i18n/`
- **Built-in**: Polish (pl), English (en)
- **Custom languages**: JSON files in user's languages folder
- **Hook**: `useI18n()` for translations in components
- **Provider**: `I18nProvider` wraps the app in `App.tsx`

### Adding translations:
1. Use `t('key.path')` in components
2. Add key to all locale files in `src/renderer/i18n/locales/`
3. Supports parameters: `t('key', { param: value })`

## Security Features

- **SecureStorageService** - Uses Electron's `safeStorage` API for credential encryption
- **OS-level encryption**: Windows DPAPI, macOS Keychain, Linux libsecret
- **Fallback**: AES-256-GCM encryption when safeStorage unavailable
- **Tokens** stored encrypted, profile data stored normally

## Build Commands

```bash
npm run dev          # Development mode (hot reload)
npm run build        # Build TypeScript
npm run dist:win     # Build Windows installer
npm run dist:linux   # Build Linux packages
npm run lint         # ESLint check
npm run typecheck    # TypeScript check
```

## Common Tasks

### Adding a new IPC handler:
1. Add channel to `IPC_CHANNELS` in `src/shared/constants.ts`
2. Add handler in `src/main/ipc.ts`
3. Expose in `src/main/preload.ts`
4. Use in renderer via `window.electronAPI`

### Adding a new service:
1. Create class in `src/services/`
2. Initialize in `src/main/ipc.ts` setupIpcHandlers()
3. Add IPC handlers for service methods

### Adding a new page:
1. Create component in `src/renderer/pages/`
2. Add route in `src/renderer/App.tsx`
3. Add sidebar link in `src/renderer/components/Sidebar.tsx`

## Notes for AI Assistant

- **Language**: User prefers Polish responses
- **UI Framework**: Always use Tailwind CSS classes
- **State Management**: Use React hooks, no Redux
- **API Calls**: All external API calls should be in `src/api/`
- **Error Handling**: Use try-catch with `electron-log` for logging
- **File Operations**: Always use path.join() for cross-platform paths

## Project Links

- Repository: [GitHub](https://github.com/MrBrodacz2025/Minecraft-Launcher)
- CurseForge API: https://api.curseforge.com
- Modrinth API: https://api.modrinth.com
- Fabric API: https://meta.fabricmc.net
- Forge: https://files.minecraftforge.net
- NeoForge: https://maven.neoforged.net

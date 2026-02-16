# 🎮 Mr_Brodacz - CLIENT

A modern, unofficial Minecraft Java Edition launcher built with Electron, TypeScript, React, and Tailwind CSS.

![Mr_Brodacz - CLIENT](https://via.placeholder.com/800x500/1a1b26/7aa2f7?text=Mr_Brodacz+CLIENT)

## ✨ Features

- 🔐 **Microsoft Authentication** - Full OAuth2 support via Xbox Live with secure token storage
- 📦 **Minecraft 1.17.2+** - Support for all versions from 1.17.2 onwards
- 🧩 **Mod Loaders** - Fabric, Forge, NeoForge with automatic availability detection
- 🎨 **Mods** - Integration with CurseForge and Modrinth
- 🔄 **Auto-updates** - Automatic launcher updates via electron-updater
- 📊 **Server Status** - Real-time Mojang server status checking
- 🎯 **Modern UI** - React + Tailwind CSS with smooth animations
- 🔒 **Security** - contextBridge with context isolation, encrypted credential storage
- 🎮 **Discord Rich Presence** - Show your gaming status on Discord
- ☕ **Java Management** - Automatic Java version detection and download
- 🌍 **Multi-language** - Built-in Polish & English, custom language support
- 🎨 **Customizable** - Custom accent colors and theme options

## 🏗️ Architecture

```
minecraft-launcher/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.ts         # Entry point
│   │   ├── preload.ts      # Context bridge
│   │   └── ipc.ts          # IPC handlers
│   ├── renderer/           # React frontend
│   │   ├── components/     # UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom hooks
│   │   └── styles/         # CSS styles
│   ├── api/                # API clients
│   │   ├── MinecraftAPI.ts
│   │   ├── FabricAPI.ts
│   │   ├── ForgeAPI.ts
│   │   ├── NeoForgeAPI.ts
│   │   ├── CurseForgeAPI.ts
│   │   └── ModrinthAPI.ts
│   ├── services/           # Core services
│   │   ├── AuthService.ts
│   │   ├── VersionManager.ts
│   │   ├── SettingsService.ts
│   │   ├── StatusService.ts
│   │   ├── JavaService.ts
│   │   ├── DiscordRPCService.ts
│   │   └── MinecraftLauncherService.ts
│   ├── loader-manager/     # Mod loader management
│   │   └── LoaderManager.ts
│   ├── mod-manager/        # Mod management
│   │   └── ModManager.ts
│   ├── updater/            # Auto-updates
│   │   └── UpdaterService.ts
│   └── shared/             # Shared types and constants
│       ├── types.ts
│       └── constants.ts
├── build/                  # Build resources
├── scripts/                # Helper scripts
├── electron-builder.json   # Build configuration
├── package.json
├── tsconfig.main.json
├── tsconfig.renderer.json
├── webpack.renderer.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🚀 Getting Started

### Requirements

- Node.js 18+
- npm or yarn
- Microsoft account with Minecraft Java Edition license

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/minecraft-launcher.git
cd minecraft-launcher

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for Windows
npm run dist:win

# Build for Linux
npm run dist:linux

# Build for all platforms
npm run dist
```

## 🛠️ Technologies

| Category | Technology |
|----------|------------|
| Framework | Electron 40.x |
| Language | TypeScript 5.3 |
| Frontend | React 18.2 |
| Styling | Tailwind CSS 3.4 |
| Bundler | Webpack 5.90 |
| Auth | msmc (Microsoft Authentication) |
| Updater | electron-updater |
| Storage | electron-store |
| Animations | Framer Motion |
| Notifications | React Hot Toast |
| Icons | React Icons (Feather) |
| Discord | discord-rpc |

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables (optional):

```env
# Apple Developer (optional, for macOS notarization)
APPLE_ID=your@apple.id
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=TEAM_ID

# GitHub Token (optional, for auto-updater with private repos)
GH_TOKEN=your_github_token
```

### Launcher Settings

Default settings are stored via `electron-store`:

```json
{
  "minMemory": 2048,
  "maxMemory": 4096,
  "resolution": { "width": 854, "height": 480 },
  "fullscreen": false,
  "jvmArguments": "-XX:+UseG1GC -XX:+ParallelRefProcEnabled...",
  "closeOnLaunch": false,
  "showSnapshots": false,
  "autoUpdate": true,
  "checkLoaderUpdates": true,
  "language": "pl",
  "theme": "dark"
}
```

## 📋 API Reference

### IPC Channels

| Channel | Description |
|---------|-------------|
| `auth:login` | Microsoft login |
| `auth:logout` | Logout |
| `versions:getAll` | Get all Minecraft versions |
| `versions:install` | Install version |
| `loaders:getAvailable` | Get available loaders for version |
| `loaders:install` | Install mod loader |
| `mods:search` | Search for mods |
| `mods:install` | Install mod |
| `launcher:launch` | Launch game |
| `settings:get/set` | Get/save settings |
| `status:getMojang` | Check Mojang server status |
| `java:ensure` | Ensure proper Java version |
| `discord:setPlaying` | Set Discord activity |

## 🔐 Security

This application follows Electron security best practices:

- **Context Isolation** - Renderer has no direct access to Node.js APIs
- **Sandbox** - Enabled sandbox for renderer processes
- **contextBridge** - Secure API exposure to renderer
- **No nodeIntegration** - Node.js integration disabled in renderer
- **IPC Validation** - All IPC messages are validated
- **Secure Downloads** - Hash verification for all downloaded files
- **Single Instance** - Prevents multiple app instances
- **External Link Handling** - Opens external links in system browser

### Public API Keys

The application uses the following public API keys that are safe to include in the source code:

- **CurseForge API Key** - Public key for desktop applications (required by CurseForge)
- **Microsoft Client ID** - Official Minecraft public client ID
- **Discord Application ID** - Public Discord RPC application ID

## 🌐 Supported APIs

- **Minecraft API** - Official Mojang API (versions, assets)
- **Fabric API** - Loader versions and mappings
- **Forge API** - Forge versions from Maven
- **NeoForge API** - NeoForge versions
- **CurseForge API** - Mod search and download
- **Modrinth API** - Alternative mod source

## 📦 Mod Structure

```
.minecraft/
├── mods/                   # Auto-managed mods
│   ├── fabric/
│   │   └── 1.20.4/
│   ├── forge/
│   │   └── 1.20.4/
│   └── neoforge/
│       └── 1.20.4/
├── versions/               # Minecraft versions
├── libraries/              # Java libraries
├── assets/                 # Game assets
└── launcher_profiles.json
```

## 🐛 Known Issues

1. **Forge 1.17.x** - May require manual Java 16+ installation
2. **macOS Notarization** - Requires Apple Developer account
3. **Linux AppImage** - May require `--no-sandbox` on some distributions

## 🌍 Translations

The launcher supports multiple languages:

- **Built-in**: Polish (pl), English (en)
- **Custom**: Add your own language files

### Adding a Custom Language

1. Create a JSON file following the structure in `src/renderer/i18n/locales/en.json`
2. Place it in:
   - Windows: `%APPDATA%/MinecraftLauncher/languages/`
   - macOS: `~/Library/Application Support/MinecraftLauncher/languages/`
   - Linux: `~/.config/MinecraftLauncher/languages/`

See [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md) for detailed instructions.

## 🤝 Contributing

1. Fork the repository
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## ⚠️ Disclaimer

- This is an **unofficial** Minecraft launcher
- Minecraft is a trademark of Mojang AB
- A valid Minecraft Java Edition license is required
- This project is not affiliated with Mojang AB or Microsoft

## 📧 Contact

- GitHub Issues: [Report an issue](https://github.com/your-username/minecraft-launcher/issues)

---

<div align="center">
  <sub>Built with ❤️ for the Minecraft community</sub>
</div>

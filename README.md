<div align="center">
  <img src="assets/icon.png" alt="Mr_Brodacz - CLIENT" width="128" height="128" />

  # Mr_Brodacz — CLIENT

  **A modern, unofficial Minecraft Java Edition launcher**

  [![Electron](https://img.shields.io/badge/Electron-40.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=for-the-badge)](LICENSE)

  <br />

  [📥 Download](#-installation) · [✨ Features](#-features) · [📖 Docs](#-architecture) · [🐛 Report Bug](https://github.com/your-github-username/minecraft-launcher/issues)

  ---
</div>

<br />

> [!NOTE]
> Mr_Brodacz — CLIENT requires a valid Minecraft Java Edition license and a Microsoft account to sign in.

<br />

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎮 Gameplay
- **Minecraft 1.17.2+** support — all versions
- **Fabric, Forge, NeoForge** — automatic detection
- **Modpacks** — browse, install & **launch with one click**
- **Auto-update** modpacks from CurseForge
- **Discord Rich Presence** — show your game status

</td>
<td width="50%">

### 🧩 Mods & Modpacks
- **CurseForge** and **Modrinth** integration
- Search, filter and sort
- Download mods with automatic hash verification
- Full modpack lifecycle management
- **Play** directly from an installed modpack

</td>
</tr>
<tr>
<td width="50%">

### 🔒 Security
- **Microsoft OAuth2** login via Xbox Live
- **Encrypted** token storage (DPAPI/Keychain)
- **Context Isolation** + Sandbox
- No `nodeIntegration` in renderer
- Downloaded file hash verification

</td>
<td width="50%">

### 🎨 Interface
- **React** + **Tailwind CSS** — modern design
- Smooth **animations** (Framer Motion)
- **Multi-language** — PL, EN + custom translations
- Customisable **accent colours**
- Console panel & notification system

</td>
</tr>
</table>

<br />

## 📥 Installation

### <img src="https://raw.githubusercontent.com/ArmynC/ArminC-AutoExec/refs/heads/master/data/windows.svg" width="16" /> Windows

| Variant | Description | File |
|---------|-------------|------|
| **Installer** *(recommended)* | NSIS — desktop shortcut, start menu, uninstaller | `Mr_Brodacz-CLIENT-Setup-X.X.X.exe` |
| **Portable** | No installation required — run from any location | `Mr_Brodacz-CLIENT-X.X.X-portable.exe` |

> Requirements: Windows 10+ (64-bit) · 4 GB RAM · Microsoft account with MC Java

---

### <img src="https://raw.githubusercontent.com/ArmynC/ArminC-AutoExec/refs/heads/master/data/linux.svg" width="16" /> Linux

| Variant | Distributions | File |
|---------|--------------|------|
| **AppImage** *(recommended)* | All | `Mr_Brodacz-CLIENT-X.X.X-x86_64.AppImage` |
| **DEB** | Debian, Ubuntu, Mint | `Mr_Brodacz-CLIENT-X.X.X-amd64.deb` |
| **RPM** | Fedora, RHEL, CentOS | `Mr_Brodacz-CLIENT-X.X.X-x86_64.rpm` |
| **tar.gz** | All (manual) | `Mr_Brodacz-CLIENT-X.X.X-x64.tar.gz` |

<details>
<summary><b>Installation instructions</b></summary>

**AppImage:**
```bash
chmod +x Mr_Brodacz-CLIENT-*.AppImage
./Mr_Brodacz-CLIENT-*.AppImage
```

**DEB (Debian/Ubuntu/Mint):**
```bash
sudo dpkg -i Mr_Brodacz-CLIENT-*.deb
sudo apt-get install -f   # fix dependencies
```

**RPM (Fedora/RHEL):**
```bash
sudo dnf install Mr_Brodacz-CLIENT-*.rpm
```

**tar.gz:**
```bash
tar -xzf Mr_Brodacz-CLIENT-*.tar.gz
cd Mr_Brodacz-CLIENT-*/
./mr-brodacz-client
```

</details>

> Requirements: x86_64 · glibc (Ubuntu 20.04+, Fedora 34+) · 4 GB RAM

---

### <img src="https://raw.githubusercontent.com/ArmynC/ArminC-AutoExec/refs/heads/master/data/macos.svg" width="16" /> macOS

| Variant | Description | File |
|---------|-------------|------|
| **DMG** *(recommended)* | Drag to Applications | `Mr_Brodacz-CLIENT-X.X.X-{arch}.dmg` |
| **ZIP** | Extract and run | `Mr_Brodacz-CLIENT-X.X.X-{arch}.zip` |

> Supported architectures: **Apple Silicon** (M1/M2/M3/M4) and **Intel x64**
>
> On first launch: *System Settings → Privacy & Security → Open Anyway*

<br />

Download the latest release from **[Releases](https://github.com/your-github-username/minecraft-launcher/releases)**.

<br />

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Electron App                          │
├────────────────────────┬─────────────────────────────────────┤
│     Main Process       │           Renderer Process          │
│  ┌──────────────────┐  │  ┌───────────────────────────────┐  │
│  │   main.ts        │  │  │   React 18 + Tailwind CSS     │  │
│  │   ipc.ts         │◄─┼──┤   App.tsx                     │  │
│  │   preload.ts     │  │  │   ├── HomePage.tsx             │  │
│  └──────┬───────────┘  │  │   ├── ModsPage.tsx             │  │
│         │              │  │   ├── ModpacksPage.tsx  ← PLAY │  │
│  ┌──────▼───────────┐  │  │   └── SettingsPage.tsx         │  │
│  │   Services       │  │  └───────────────────────────────┘  │
│  │  Auth / Launcher │  │                                     │
│  │  Versions / Java │  ├─────────────────────────────────────┤
│  │  Settings / RPC  │  │           Shared                    │
│  │  ModManager      │  │  ┌───────────────────────────────┐  │
│  │  ModpackManager  │  │  │   types.ts · constants.ts     │  │
│  └──────────────────┘  │  └───────────────────────────────┘  │
├────────────────────────┴─────────────────────────────────────┤
│                        API Layer                             │
│   Minecraft · Fabric · Forge · NeoForge · CurseForge · MR   │
└──────────────────────────────────────────────────────────────┘
```

<details>
<summary><b>Full directory structure</b></summary>

```
src/
├── main/                   # Electron main process
│   ├── main.ts             # Entry point
│   ├── preload.ts          # Context bridge (IPC)
│   └── ipc.ts              # Communication handlers
├── renderer/               # React frontend
│   ├── components/         # Sidebar, TitleBar, Console, ...
│   ├── pages/              # Home, Mods, Modpacks, Settings
│   ├── hooks/              # useElectronAPI, useNotifications
│   ├── i18n/               # Translations (pl, en, ...)
│   └── styles/             # Tailwind globals
├── api/                    # API clients
│   ├── MinecraftAPI.ts     # Mojang (versions, assets)
│   ├── CurseForgeAPI.ts    # Mods + modpacks
│   ├── ModrinthAPI.ts      # Modrinth mods
│   ├── FabricAPI.ts        # Fabric loader
│   ├── ForgeAPI.ts         # Forge loader
│   └── NeoForgeAPI.ts      # NeoForge loader
├── services/               # Business logic
│   ├── AuthService.ts      # Microsoft OAuth2
│   ├── MinecraftLauncherService.ts  # Game launching
│   ├── VersionManager.ts   # Version management
│   ├── JavaService.ts      # Auto-download Java
│   ├── SettingsService.ts  # Settings
│   ├── SecureStorageService.ts  # Token encryption
│   ├── DiscordRPCService.ts     # Discord integration
│   └── StatusService.ts    # Server status
├── mod-manager/
│   ├── ModManager.ts       # Mod management
│   └── ModpackManager.ts   # Modpacks + launching
├── loader-manager/
│   └── LoaderManager.ts    # Fabric / Forge / NeoForge
├── updater/
│   └── UpdaterService.ts   # Auto-updates
└── shared/
    ├── types.ts            # Shared interfaces
    └── constants.ts        # IPC channels, constants
```

</details>

<br />

## 🛠️ Tech Stack

<table>
<tr>
  <td align="center" width="96"><img src="https://cdn.jsdelivr.net/gh/nicehash/ts-icongen@master/data/svg/frameworks/electron.svg" width="48" height="48" alt="Electron" /><br /><sub><b>Electron 40</b></sub></td>
  <td align="center" width="96"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" width="48" height="48" alt="TypeScript" /><br /><sub><b>TypeScript 5.3</b></sub></td>
  <td align="center" width="96"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="48" height="48" alt="React" /><br /><sub><b>React 18</b></sub></td>
  <td align="center" width="96"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg" width="48" height="48" alt="Tailwind" /><br /><sub><b>Tailwind 3.4</b></sub></td>
  <td align="center" width="96"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/webpack/webpack-original.svg" width="48" height="48" alt="Webpack" /><br /><sub><b>Webpack 5</b></sub></td>
</tr>
</table>

| Category | Technology | Description |
|:--------:|:----------:|:------------|
| 🖥️ Desktop | Electron 40 | Desktop application framework |
| 🔤 Language | TypeScript 5.3 | Strict typing across the entire project |
| ⚛️ UI | React 18.2 | Functional components + hooks |
| 🎨 Styling | Tailwind CSS 3.4 | Utility-first, dark theme |
| 📦 Bundler | Webpack 5.90 | Renderer build + HMR |
| 🔐 Auth | msmc | Microsoft OAuth2 / Xbox Live |
| 💾 Storage | electron-store | Encrypted data + settings |
| 🔄 Updater | electron-updater | Auto-updates from GitHub |
| 🎬 Animations | Framer Motion | Smooth page transitions |
| 🔔 Toasts | React Hot Toast | UI notifications |
| 🎮 Discord | discord-rpc | Rich Presence |
| 📦 ZIP | AdmZip | Modpack extraction |

<br />

## 🔨 Building from Source

### Prerequisites

- **Node.js 18+** (22 LTS recommended)
- **npm 10+**
- **Git**

### Quick Start

```bash
# Clone
git clone https://github.com/your-github-username/minecraft-launcher.git
cd minecraft-launcher

# Install dependencies
npm install

# Development mode (hot reload)
npm run dev
```

### Distribution Builds

```bash
npm run dist:win     # Windows — NSIS + portable EXE
npm run dist:linux   # Linux — AppImage + DEB + RPM + tar.gz
npm run dist:mac     # macOS — DMG + ZIP (x64 + arm64)
npm run dist         # All platforms
```

Artifacts are output to `dist-app/`.

### CI/CD

The project includes a **GitHub Actions** workflow (`.github/workflows/build.yml`) that automatically builds for all platforms when a tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
# → GitHub Actions builds Windows + Linux + macOS and creates a draft Release
```

<br />

## 📋 Commands

| Command | Description |
|:--------|:------------|
| `npm run dev` | Development mode with hot reload |
| `npm run build` | TypeScript + Webpack compilation |
| `npm run start` | Run the built application |
| `npm run dist:win` | Build Windows installer |
| `npm run dist:linux` | Build Linux packages |
| `npm run dist:mac` | Build macOS DMG/ZIP |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checks |

<br />

## 🔐 Security

<table>
<tr><td>

**Electron Process Model**

```
┌─────────────┐    contextBridge     ┌──────────────┐
│  Renderer    │◄═══════════════════►│  Main Process │
│  (sandbox)   │    IPC channels     │  (Node.js)    │
│  No Node.js  │    validated msgs   │  Full access  │
└─────────────┘                      └──────────────┘
```

</td></tr>
</table>

- ✅ **Context Isolation** — renderer has no access to Node.js
- ✅ **Sandbox** — enabled for renderer processes
- ✅ **contextBridge** — sole communication interface
- ✅ **No nodeIntegration** — disabled in BrowserWindow
- ✅ **IPC Validation** — all messages validated in main process
- ✅ **Token Encryption** — DPAPI (Win) / Keychain (macOS) / libsecret (Linux)
- ✅ **Hash Verification** — integrity checks for downloaded files
- ✅ **Single Instance** — prevents multiple app instances
- ✅ **shell.openExternal** — safe external link handling

### Public API Keys

The application includes the following public API keys that are safe to include in code:

| Key | Purpose | Status |
|:----|:--------|:------:|
| CurseForge API Key | Public key for desktop applications | ✅ Public |
| Microsoft Client ID | Official Minecraft OAuth Client ID | ✅ Public |
| Discord Application ID | Discord RPC application ID | ✅ Public |

<br />

## 🌐 APIs

| API | Endpoint | Usage |
|:----|:---------|:------|
| Minecraft | `launchermeta.mojang.com` | Versions, assets, libraries |
| Fabric | `meta.fabricmc.net` | Fabric loader |
| Forge | `files.minecraftforge.net` | Forge installer |
| NeoForge | `maven.neoforged.net` | NeoForge loader |
| CurseForge | `api.curseforge.com` | Mods + modpacks |
| Modrinth | `api.modrinth.com` | Mods (alternative) |

<br />

## 🌍 Translations

| Language | Code | Status |
|:---------|:----:|:------:|
| 🇵🇱 Polski | `pl` | ✅ Built-in |
| 🇬🇧 English | `en` | ✅ Built-in |
| 🌐 Custom | `*` | 📝 Create your own! |

### Adding a Custom Language

1. Copy `src/renderer/i18n/locales/en.json` as a template
2. Translate the values (keep the keys unchanged)
3. Place the file in the languages directory:

| System | Path |
|:-------|:-----|
| Windows | `%APPDATA%/MinecraftLauncher/languages/` |
| macOS | `~/Library/Application Support/MinecraftLauncher/languages/` |
| Linux | `~/.config/MinecraftLauncher/languages/` |

Details: [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md)

<br />

## 🐛 Known Issues

| Issue | Workaround |
|:------|:-----------|
| Forge 1.17.x requires Java 16+ | Install the appropriate Java version |
| macOS unidentified developer warning | Settings → Privacy & Security → Open Anyway |
| Linux AppImage sandbox | Run with `--no-sandbox` |

<br />

## 🤝 Contributing

Contributions are welcome!

1. **Fork** the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

<br />

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file.

<br />

## ⚠️ Disclaimer

> [!WARNING]
> - This is an **unofficial** Minecraft launcher
> - Minecraft is a trademark of **Mojang AB**
> - A valid **Minecraft Java Edition** license is required
> - This project is not affiliated with Mojang AB or Microsoft

<br />

---

<div align="center">

  **[⬆ Back to top](#mr_brodacz--client)**

  <sub>Made with ❤️ for the Minecraft community</sub>

  <br />

  [![GitHub Issues](https://img.shields.io/badge/Issues-Report_a_bug-red?style=flat-square&logo=github)](https://github.com/your-github-username/minecraft-launcher/issues)
  [![GitHub Stars](https://img.shields.io/github/stars/your-github-username/minecraft-launcher?style=flat-square&logo=github)](https://github.com/your-github-username/minecraft-launcher)

</div>

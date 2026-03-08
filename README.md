# 🎮 Mr_Brodacz - CLIENT

Nowoczesny, nieoficjalny launcher do Minecraft Java Edition zbudowany z Electron, TypeScript, React i Tailwind CSS.

![Mr_Brodacz - CLIENT](https://via.placeholder.com/800x500/1a1b26/7aa2f7?text=Mr_Brodacz+CLIENT)

## ✨ Funkcje

- 🔐 **Logowanie Microsoft** - Pełna obsługa OAuth2 przez Xbox Live z szyfrowanym przechowywaniem tokenów
- 📦 **Minecraft 1.17.2+** - Obsługa wszystkich wersji od 1.17.2 wzwyż
- 🧩 **Mod Loadery** - Fabric, Forge, NeoForge z automatycznym wykrywaniem
- 🎨 **Mody** - Integracja z CurseForge i Modrinth
- 📦 **Paczki modów** - Przeglądanie i instalacja paczek modów z CurseForge z auto-aktualizacją
- 🔄 **Auto-aktualizacje** - Automatyczne aktualizacje launchera i paczek modów
- 📊 **Status serwerów** - Sprawdzanie statusu serwerów Mojang w czasie rzeczywistym
- 🎯 **Nowoczesny UI** - React + Tailwind CSS z płynnymi animacjami
- 🔒 **Bezpieczeństwo** - contextBridge z izolacją kontekstu, szyfrowane poświadczenia
- 🎮 **Discord Rich Presence** - Pokaż swój status gry na Discordzie
- ☕ **Zarządzanie Java** - Automatyczne wykrywanie i pobieranie wersji Java
- 🌍 **Wielojęzyczność** - Wbudowane: Polski i Angielski, obsługa własnych tłumaczeń
- 🎨 **Personalizacja** - Własne kolory akcentu i motywy

---

## 📥 Instalacja

### Windows

#### Opcja 1: Instalator (zalecane)
1. Pobierz najnowszą wersję z [Releases](https://github.com/your-github-username/minecraft-launcher/releases)
2. Wybierz plik `Mr_Brodacz-CLIENT-Setup-X.X.X.exe`
3. Uruchom instalator i postępuj zgodnie z instrukcjami
4. Launcher zostanie zainstalowany i pojawi się skrót na pulpicie

#### Opcja 2: Portable (bez instalacji)
1. Pobierz `Mr_Brodacz-CLIENT-X.X.X.exe` (wersja portable)
2. Umieść plik w wybranym folderze
3. Uruchom — gotowe do pracy, bez instalacji

#### Wymagania Windows:
- Windows 10 lub nowszy (64-bit)
- 4 GB RAM minimum
- Konto Microsoft z licencją Minecraft Java Edition

---

### Linux

#### Opcja 1: AppImage (uniwersalna, zalecane)
```bash
# Pobierz z Releases
wget https://github.com/your-github-username/minecraft-launcher/releases/latest/download/Mr_Brodacz-CLIENT-X.X.X.AppImage

# Nadaj uprawnienia do wykonywania
chmod +x Mr_Brodacz-CLIENT-*.AppImage

# Uruchom
./Mr_Brodacz-CLIENT-*.AppImage
```

> **Uwaga:** Na niektórych dystrybucjach może być potrzebna flaga `--no-sandbox`

#### Opcja 2: DEB (Debian, Ubuntu, Mint)
```bash
# Pobierz plik .deb z Releases
wget https://github.com/your-github-username/minecraft-launcher/releases/latest/download/Mr_Brodacz-CLIENT-X.X.X-amd64.deb

# Zainstaluj
sudo dpkg -i Mr_Brodacz-CLIENT-*.deb

# Napraw zależności jeśli potrzeba
sudo apt-get install -f

# Uruchom z menu lub terminala
minecraft-launcher
```

#### Opcja 3: RPM (Fedora, CentOS, RHEL)
```bash
# Pobierz plik .rpm z Releases
wget https://github.com/your-github-username/minecraft-launcher/releases/latest/download/Mr_Brodacz-CLIENT-X.X.X-x86_64.rpm

# Zainstaluj
sudo rpm -i Mr_Brodacz-CLIENT-*.rpm
# lub z dnf
sudo dnf install Mr_Brodacz-CLIENT-*.rpm

# Uruchom
minecraft-launcher
```

#### Opcja 4: tar.gz (ręczna instalacja)
```bash
# Pobierz i rozpakuj
wget https://github.com/your-github-username/minecraft-launcher/releases/latest/download/Mr_Brodacz-CLIENT-X.X.X-x64.tar.gz
tar -xzf Mr_Brodacz-CLIENT-*.tar.gz
cd Mr_Brodacz-CLIENT-*/

# Uruchom
./minecraft-launcher
```

#### Wymagania Linux:
- Dystrybucja bazowana na glibc (Ubuntu 20.04+, Fedora 34+, etc.)
- 64-bit (x86_64)
- 4 GB RAM minimum
- Konto Microsoft z licencją Minecraft Java Edition

---

### macOS

#### Opcja 1: DMG (zalecane)
1. Pobierz `Mr_Brodacz-CLIENT-X.X.X-arm64.dmg` (Apple Silicon) lub `Mr_Brodacz-CLIENT-X.X.X-x64.dmg` (Intel)
2. Otwórz plik DMG
3. Przeciągnij aplikację do folderu Applications
4. Uruchom z Launchpada lub Spotlight

#### Opcja 2: ZIP
1. Pobierz plik `.zip` z Releases
2. Rozpakuj i przenieś do Applications

> **Uwaga:** Przy pierwszym uruchomieniu macOS może wyświetlić ostrzeżenie o nieznanym deweloperze.
> Wejdź w **Ustawienia systemowe → Prywatność i bezpieczeństwo** i kliknij "Otwórz mimo to".

#### Wymagania macOS:
- macOS 11 (Big Sur) lub nowszy
- Apple Silicon (M1/M2/M3) lub Intel
- 4 GB RAM minimum
- Konto Microsoft z licencją Minecraft Java Edition

---

## 🔨 Budowanie ze źródeł

### Wymagania do budowania
- **Node.js 18+** (zalecane 20 LTS)
- **npm** lub **yarn**
- **Git**

### Instalacja zależności i uruchomienie

```bash
# Klonowanie repozytorium
git clone https://github.com/your-github-username/minecraft-launcher.git
cd minecraft-launcher

# Instalacja zależności
npm install

# Uruchomienie w trybie deweloperskim (hot reload)
npm run dev
```

### Budowanie dystrybucyjne

```bash
# Budowanie dla Windows (EXE installer + portable)
npm run dist:win

# Budowanie dla Linux (AppImage + DEB + RPM + tar.gz)
npm run dist:linux

# Budowanie dla macOS (DMG + ZIP)
npm run dist:mac

# Budowanie dla wszystkich platform
npm run dist
```

Zbudowane pliki znajdziesz w folderze `dist-app/`.

---

## 🏗️ Architektura

```
minecraft-launcher/
├── src/
│   ├── main/               # Proces główny Electron
│   │   ├── main.ts         # Punkt wejściowy
│   │   ├── preload.ts      # Context bridge
│   │   └── ipc.ts          # Handlery IPC
│   ├── renderer/           # Frontend React
│   │   ├── components/     # Komponenty UI
│   │   ├── pages/          # Strony aplikacji
│   │   │   ├── HomePage.tsx
│   │   │   ├── ModsPage.tsx
│   │   │   ├── ModpacksPage.tsx  # Paczki modów
│   │   │   └── SettingsPage.tsx
│   │   ├── hooks/          # Custom hooks
│   │   └── styles/         # Pliki CSS
│   ├── api/                # Klienci API
│   │   ├── MinecraftAPI.ts
│   │   ├── FabricAPI.ts
│   │   ├── ForgeAPI.ts
│   │   ├── NeoForgeAPI.ts
│   │   ├── CurseForgeAPI.ts  # Mody + Paczki modów
│   │   └── ModrinthAPI.ts
│   ├── services/           # Serwisy
│   ├── mod-manager/        # Zarządzanie modami
│   │   ├── ModManager.ts
│   │   └── ModpackManager.ts  # Zarządzanie paczkami modów
│   ├── loader-manager/     # Zarządzanie loaderami
│   ├── updater/            # Auto-aktualizacje
│   └── shared/             # Współdzielone typy i stałe
├── build/                  # Zasoby do budowania
├── scripts/                # Skrypty pomocnicze
├── electron-builder.json   # Konfiguracja budowania
└── package.json
```

## 🛠️ Technologie

| Kategoria | Technologia |
|-----------|------------|
| Framework | Electron 40.x |
| Język | TypeScript 5.3 |
| Frontend | React 18.2 |
| Stylowanie | Tailwind CSS 3.4 |
| Bundler | Webpack 5.90 |
| Autoryzacja | msmc (Microsoft) |
| Aktualizacje | electron-updater |
| Magazynowanie | electron-store |
| Animacje | Framer Motion |
| Powiadomienia | React Hot Toast |
| Ikony | React Icons (Feather) |
| Discord | discord-rpc |

## 🔧 Konfiguracja

### Zmienne środowiskowe

Utwórz plik `.env` z następującymi zmiennymi (opcjonalnie):

```env
# Apple Developer (opcjonalne, dla macOS notarization)
APPLE_ID=your@apple.id
APPLE_ID_PASSWORD=app-specific-password
APPLE_TEAM_ID=TEAM_ID

# GitHub Token (opcjonalne, dla auto-updater z prywatnymi repozytoriami)
GH_TOKEN=your_github_token
```

## 📋 Komendy

| Komenda | Opis |
|---------|------|
| `npm run dev` | Tryb deweloperski (hot reload) |
| `npm run build` | Kompilacja TypeScript |
| `npm run dist:win` | Buduj instalator Windows |
| `npm run dist:linux` | Buduj paczki Linux |
| `npm run dist:mac` | Buduj DMG dla macOS |
| `npm run dist` | Buduj dla wszystkich platform |
| `npm run lint` | Sprawdź ESLint |
| `npm run typecheck` | Sprawdź typy TypeScript |

## 🔐 Bezpieczeństwo

Ta aplikacja stosuje najlepsze praktyki bezpieczeństwa Electron:

- **Context Isolation** - Renderer nie ma bezpośredniego dostępu do API Node.js
- **Sandbox** - Włączony sandbox dla procesów renderera
- **contextBridge** - Bezpieczna ekspozycja API dla renderera
- **Brak nodeIntegration** - Integracja Node.js wyłączona w rendererze
- **Walidacja IPC** - Wszystkie wiadomości IPC są walidowane
- **Bezpieczne pobieranie** - Weryfikacja hash dla pobranych plików
- **Jedna instancja** - Zapobieganie wielu instancjom aplikacji
- **Linki zewnętrzne** - Otwieranie w domyślnej przeglądarce systemowej

### Publiczne klucze API

Aplikacja używa następujących publicznych kluczy API, które mogą być bezpiecznie zawarte w kodzie:

- **CurseForge API Key** - Publiczny klucz dla aplikacji desktopowych
- **Microsoft Client ID** - Oficjalny publiczny Client ID Minecraft
- **Discord Application ID** - Publiczny ID aplikacji Discord RPC

## 🌐 Obsługiwane API

- **Minecraft API** - Oficjalne API Mojang (wersje, assety)
- **Fabric API** - Wersje loaderów i mappingi
- **Forge API** - Wersje Forge z Maven
- **NeoForge API** - Wersje NeoForge
- **CurseForge API** - Wyszukiwanie i pobieranie modów i paczek modów
- **Modrinth API** - Alternatywne źródło modów

## 🌍 Tłumaczenia

Launcher obsługuje wiele języków:

- **Wbudowane**: Polski (pl), Angielski (en)
- **Własne**: Dodaj własne pliki tłumaczeń

### Dodawanie własnego języka

1. Utwórz plik JSON zgodny ze strukturą w `src/renderer/i18n/locales/en.json`
2. Umieść go w:
   - Windows: `%APPDATA%/MinecraftLauncher/languages/`
   - macOS: `~/Library/Application Support/MinecraftLauncher/languages/`
   - Linux: `~/.config/MinecraftLauncher/languages/`

Szczegóły w [docs/TRANSLATIONS.md](docs/TRANSLATIONS.md).

## 🐛 Znane problemy

1. **Forge 1.17.x** - Może wymagać ręcznej instalacji Java 16+
2. **macOS Notarization** - Wymaga konta Apple Developer
3. **Linux AppImage** - Na niektórych dystrybucjach może wymagać `--no-sandbox`

## 🤝 Współpraca

1. Forkuj repozytorium
2. Utwórz branch (`git checkout -b feature/amazing-feature`)
3. Commituj zmiany (`git commit -m 'Add amazing feature'`)
4. Push do brancha (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

## 📄 Licencja

MIT License - patrz plik [LICENSE](LICENSE)

## ⚠️ Zastrzeżenia

- To jest **nieoficjalny** launcher Minecraft
- Minecraft jest znakiem towarowym Mojang AB
- Wymagana jest ważna licencja Minecraft Java Edition
- Projekt nie jest powiązany z Mojang AB ani Microsoft

## 📧 Kontakt

- GitHub Issues: [Zgłoś problem](https://github.com/your-github-username/minecraft-launcher/issues)

---

<div align="center">
  <sub>Stworzone z ❤️ dla społeczności Minecraft</sub>
</div>

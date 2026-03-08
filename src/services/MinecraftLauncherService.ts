import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import AdmZip from 'adm-zip';

import { IPC_CHANNELS } from '../shared/constants';
import type {
  LaunchConfig,
  LauncherStatus,
  MinecraftVersionDetails,
  Library,
  LogEntry,
} from '../shared/types';

export class MinecraftLauncherService {
  private mainWindow: BrowserWindow;
  private gameProcess: ChildProcess | null = null;
  private startTime: number | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async launch(config: LaunchConfig): Promise<void> {
    if (this.gameProcess) {
      throw new Error('Game is already running');
    }

    const gameDirectory = config.settings.gameDirectory;
    const versionId = this.getVersionId(config);
    const versionDir = path.join(gameDirectory, 'versions', versionId);
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);

    log.info(`Attempting to launch version: ${versionId}`);
    log.info(`Game directory: ${gameDirectory}`);
    log.info(`Version JSON path: ${versionJsonPath}`);

    if (!fs.existsSync(versionJsonPath)) {
      log.error(`Version JSON not found: ${versionJsonPath}`);
      throw new Error(`Wersja ${versionId} nie jest zainstalowana. Ścieżka: ${versionJsonPath}`);
    }

    const rawVersionDetails: MinecraftVersionDetails = JSON.parse(
      fs.readFileSync(versionJsonPath, 'utf8')
    );

    // Resolve inherited version (Fabric/Forge/NeoForge inherit from vanilla)
    const versionDetails = await this.resolveVersionDetails(rawVersionDetails, gameDirectory);

    // Check for version JAR
    const versionJarPath = path.join(versionDir, `${versionId}.jar`);
    if (!fs.existsSync(versionJarPath)) {
      // Check for inherited version
      if ((versionDetails as any).inheritsFrom) {
        const parentJar = path.join(gameDirectory, 'versions', (versionDetails as any).inheritsFrom, `${(versionDetails as any).inheritsFrom}.jar`);
        if (!fs.existsSync(parentJar)) {
          log.error(`Parent version JAR not found: ${parentJar}`);
          throw new Error(`Plik JAR wersji nie został znaleziony. Zainstaluj ponownie wersję.`);
        }
      } else {
        log.error(`Version JAR not found: ${versionJarPath}`);
        throw new Error(`Plik JAR wersji nie został znaleziony: ${versionJarPath}`);
      }
    }

    // Build classpath
    const classpath = this.buildClasspath(gameDirectory, versionDetails, versionId);
    
    if (!classpath || classpath.length === 0) {
      throw new Error('Nie udało się zbudować classpath. Zainstaluj ponownie wersję.');
    }

    // Extract native libraries before launching
    const nativesDir = await this.extractNativesForLaunch(gameDirectory, versionDetails, versionId);
    log.info(`Natives directory: ${nativesDir}`);

    // Build JVM arguments (excluding -cp which we add separately)
    const jvmArgs = this.buildJvmArgs(config, versionDetails, gameDirectory, versionId, nativesDir)
      .filter(arg => arg !== '-cp' && !arg.startsWith('-cp '));

    // Build game arguments
    const gameArgs = this.buildGameArgs(config, versionDetails);

    // Get Java path - try JavaService first for auto-download capability
    let javaPath = config.settings.javaPath;
    
    if (!javaPath) {
      try {
        const { javaService } = await import('./JavaService');
        javaPath = await javaService.ensureJavaForMinecraft(config.version, (progress) => {
          this.mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, {
            type: 'java',
            filename: `Java dla MC ${config.version}`,
            downloaded: progress.downloaded,
            total: progress.total,
            percentage: progress.percentage,
          });
        });
        log.info(`Using JavaService Java: ${javaPath}`);
      } catch (e) {
        log.warn('JavaService failed, falling back to findJava:', e);
        javaPath = this.findJava();
      }
    }
    
    log.info(`Java path: ${javaPath}`);
    
    // Verify Java exists
    if (!fs.existsSync(javaPath) && !javaPath.includes('java')) {
      throw new Error(`Java nie została znaleziona. Zainstaluj Java 21 i ustaw ścieżkę w ustawieniach.`);
    }

    // Activate mods for the selected version (skip for modpack launches)
    if (!config.modpackPath) {
      try {
        const { ModManager } = await import('../mod-manager/ModManager');
        const { SettingsService } = await import('./SettingsService');
        const settingsService = new SettingsService();
        const modManager = new ModManager(settingsService);
        
        const loaderType = config.loader || 'fabric';
        
        // Ensure optimization mods are installed (Sodium, Lithium, FerriteCore, etc.)
        await modManager.ensureOptimizationMods(config.version, loaderType);
        
        // Ensure menu customization mods are installed (FancyMenu, etc.)
        await modManager.ensureMenuMods(config.version, loaderType);
        
        await modManager.activateModsForVersion(config.version);
        log.info(`Mods activated for version ${config.version}`);
      } catch (modsError) {
        log.warn('Failed to activate mods:', modsError);
      }
    } else {
      log.info(`Launching with modpack at: ${config.modpackPath}`);
    }

    // Build full command
    const args = [...jvmArgs, '-cp', classpath, versionDetails.mainClass, ...gameArgs];

    const effectiveCwd = config.modpackPath || gameDirectory;

    log.info('Launching Minecraft...');
    log.info(`Main class: ${versionDetails.mainClass}`);
    log.info(`Args count: ${args.length}`);
    log.info(`Full Java path: "${javaPath}"`);
    log.info(`Java exists: ${fs.existsSync(javaPath)}`);
    log.info(`First 5 args: ${args.slice(0, 5).join(' ')}`);
    if (config.modpackPath) {
      log.info(`Modpack game directory: ${config.modpackPath}`);
    }

    try {
      this.gameProcess = spawn(javaPath, args, {
        cwd: effectiveCwd,
        env: {
          ...process.env,
          JAVA_HOME: path.dirname(path.dirname(javaPath)),
        },
        detached: false,
        shell: false,
      });
    } catch (spawnError: any) {
      log.error('Failed to spawn process:', spawnError);
      throw new Error(`Nie udało się uruchomić procesu: ${spawnError.message}`);
    }

    this.startTime = Date.now();

    // Handle stdout
    this.gameProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.sendLog('info', message);
      }
    });

    // Handle stderr
    this.gameProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        log.error('MC stderr:', message);
        this.sendLog('warn', message);
      }
    });

    // Handle exit
    this.gameProcess.on('exit', (code) => {
      log.info(`Minecraft exited with code ${code}`);
      this.mainWindow.webContents.send(IPC_CHANNELS.GAME_EXIT, code);
      this.gameProcess = null;
      this.startTime = null;
    });

    // Handle error
    this.gameProcess.on('error', (error) => {
      log.error('Failed to launch Minecraft:', error);
      this.sendLog('error', `Failed to launch: ${error.message}`);
      this.gameProcess = null;
      this.startTime = null;
    });

    // Close launcher if configured
    if (config.settings.closeOnLaunch) {
      setTimeout(() => {
        this.mainWindow.hide();
      }, 3000);
    }
  }

  async stop(): Promise<void> {
    if (!this.gameProcess) {
      return;
    }

    log.info('Stopping Minecraft...');
    this.gameProcess.kill();
    this.gameProcess = null;
    this.startTime = null;
  }

  getStatus(): LauncherStatus {
    return {
      isRunning: this.gameProcess !== null,
      pid: this.gameProcess?.pid,
      startTime: this.startTime || undefined,
    };
  }

  private getVersionId(config: LaunchConfig): string {
    // For non-vanilla loaders, check if the loader version exists
    if (config.loader && config.loader !== 'vanilla' && config.loaderVersion) {
      let loaderVersionId: string;
      switch (config.loader) {
        case 'fabric':
          loaderVersionId = `fabric-loader-${config.loaderVersion}-${config.version}`;
          break;
        case 'forge':
          loaderVersionId = `${config.version}-forge-${config.loaderVersion}`;
          break;
        case 'neoforge':
          loaderVersionId = `${config.version}-neoforge-${config.loaderVersion}`;
          break;
        default:
          return config.version;
      }
      
      // Check if loader version exists
      const loaderVersionPath = path.join(
        config.settings.gameDirectory,
        'versions',
        loaderVersionId,
        `${loaderVersionId}.json`
      );
      
      if (fs.existsSync(loaderVersionPath)) {
        return loaderVersionId;
      } else {
        log.warn(`Loader version ${loaderVersionId} not found, falling back to vanilla ${config.version}`);
        // Fall back to vanilla
      }
    }
    return config.version;
  }

  /**
   * Resolve version details, merging with parent version if inheritsFrom is present
   */
  private async resolveVersionDetails(
    versionDetails: MinecraftVersionDetails,
    gameDirectory: string
  ): Promise<MinecraftVersionDetails> {
    const details = versionDetails as any;
    
    if (!details.inheritsFrom) {
      return versionDetails;
    }

    const parentId = details.inheritsFrom;
    const parentJsonPath = path.join(gameDirectory, 'versions', parentId, `${parentId}.json`);
    
    if (!fs.existsSync(parentJsonPath)) {
      log.warn(`Parent version ${parentId} not found, using loader version as-is`);
      return versionDetails;
    }

    const parentDetails: MinecraftVersionDetails = JSON.parse(
      fs.readFileSync(parentJsonPath, 'utf8')
    );

    // Merge: loader overrides take precedence, but get missing fields from parent
    const merged: any = { ...parentDetails };
    
    // Preserve inheritsFrom for classpath/natives resolution
    merged.inheritsFrom = parentId;
    
    // Copy over loader-specific fields
    if (details.mainClass) merged.mainClass = details.mainClass;
    if (details.arguments?.jvm) {
      merged.arguments = merged.arguments || {};
      merged.arguments.jvm = [...(parentDetails.arguments?.jvm || []), ...details.arguments.jvm];
    }
    if (details.arguments?.game) {
      merged.arguments = merged.arguments || {};
      merged.arguments.game = [...(parentDetails.arguments?.game || []), ...(details.arguments?.game || [])];
    }
    
    // Merge libraries (loader libs + parent libs)
    merged.libraries = [...(details.libraries || []), ...(parentDetails.libraries || [])];
    
    // Keep parent assets info for sounds/textures
    merged.assets = parentDetails.assets || parentDetails.id;
    merged.assetIndex = parentDetails.assetIndex;
    
    log.info(`Resolved version: inheritsFrom=${parentId}, assets=${merged.assets}`);
    
    return merged as MinecraftVersionDetails;
  }

  private buildClasspath(
    gameDirectory: string,
    versionDetails: MinecraftVersionDetails,
    versionId: string
  ): string {
    const librariesDir = path.join(gameDirectory, 'libraries');
    const separator = process.platform === 'win32' ? ';' : ':';
    const paths: string[] = [];

    // Add libraries
    for (const library of versionDetails.libraries) {
      if (!this.shouldIncludeLibrary(library)) continue;

      const artifact = library.downloads?.artifact;
      if (artifact) {
        const libPath = path.join(librariesDir, artifact.path);
        if (fs.existsSync(libPath)) {
          paths.push(libPath);
        }
      } else if (library.name) {
        // Handle Maven-style library names (e.g., net.fabricmc:fabric-loader:0.18.4)
        const libPath = this.mavenNameToPath(library.name, librariesDir);
        if (fs.existsSync(libPath)) {
          paths.push(libPath);
        } else {
          log.warn(`Library not found: ${libPath}`);
        }
      }
    }

    // Check for inherited versions (loaders) - load parent libraries too
    if ((versionDetails as any).inheritsFrom) {
      const parentId = (versionDetails as any).inheritsFrom;
      const parentJsonPath = path.join(gameDirectory, 'versions', parentId, `${parentId}.json`);
      if (fs.existsSync(parentJsonPath)) {
        try {
          const parentJson = JSON.parse(fs.readFileSync(parentJsonPath, 'utf-8'));
          // Add parent libraries
          for (const library of parentJson.libraries || []) {
            if (!this.shouldIncludeLibrary(library)) continue;
            const artifact = library.downloads?.artifact;
            if (artifact) {
              const libPath = path.join(librariesDir, artifact.path);
              if (fs.existsSync(libPath) && !paths.includes(libPath)) {
                paths.push(libPath);
              }
            }
          }
        } catch (e) {
          log.error('Failed to parse parent version JSON:', e);
        }
      }
      
      // Add parent JAR
      const parentJar = path.join(gameDirectory, 'versions', parentId, `${parentId}.jar`);
      if (fs.existsSync(parentJar)) {
        paths.push(parentJar);
      }
    }

    // Add version JAR (if not a loader - loaders don't have their own JAR)
    const versionJar = path.join(gameDirectory, 'versions', versionId, `${versionId}.jar`);
    if (fs.existsSync(versionJar)) {
      paths.push(versionJar);
    }

    return paths.join(separator);
  }

  private buildJvmArgs(
    config: LaunchConfig,
    versionDetails: MinecraftVersionDetails,
    gameDirectory: string,
    versionId: string,
    nativesDir: string
  ): string[] {
    const args: string[] = [];

    // Memory settings
    args.push(`-Xms${config.settings.minMemory}M`);
    args.push(`-Xmx${config.settings.maxMemory}M`);

    // User JVM args
    if (config.settings.jvmArguments) {
      args.push(...config.settings.jvmArguments.split(' ').filter(Boolean));
    }

    // Use pre-extracted natives path
    args.push(`-Djava.library.path=${nativesDir}`);
    
    // LWJGL/OpenAL configuration for sound
    args.push('-Dorg.lwjgl.util.Debug=false');
    args.push('-Dorg.lwjgl.util.DebugLoader=false');

    // Version-specific JVM args (skip classpath-related ones)
    if (versionDetails.arguments?.jvm) {
      for (const arg of versionDetails.arguments.jvm) {
        if (typeof arg === 'string') {
          // Skip classpath args - we handle them separately
          if (arg.includes('${classpath}') || arg === '-cp') continue;
          args.push(this.replaceArgVariables(arg, config, gameDirectory, versionId));
        } else if (this.checkRules(arg.rules)) {
          const values = Array.isArray(arg.value) ? arg.value : [arg.value];
          for (const value of values) {
            if (value.includes('${classpath}') || value === '-cp') continue;
            args.push(this.replaceArgVariables(value, config, gameDirectory, versionId));
          }
        }
      }
    }

    // Common JVM args
    args.push('-Dminecraft.launcher.brand=Mr_Brodacz-CLIENT');
    args.push('-Dminecraft.launcher.version=1.0.0');

    return args;
  }

  private buildGameArgs(
    config: LaunchConfig,
    versionDetails: MinecraftVersionDetails
  ): string[] {
    const args: string[] = [];
    const gameDirectory = config.settings.gameDirectory;

    // Modern argument format
    if (versionDetails.arguments?.game) {
      for (const arg of versionDetails.arguments.game) {
        if (typeof arg === 'string') {
          args.push(this.replaceGameArgVariables(arg, config, versionDetails));
        } else if (this.checkRules(arg.rules)) {
          const values = Array.isArray(arg.value) ? arg.value : [arg.value];
          for (const value of values) {
            args.push(this.replaceGameArgVariables(value, config, versionDetails));
          }
        }
      }
    }
    // Legacy argument format
    else if (versionDetails.minecraftArguments) {
      const legacyArgs = versionDetails.minecraftArguments.split(' ');
      for (const arg of legacyArgs) {
        args.push(this.replaceGameArgVariables(arg, config, versionDetails));
      }
    }

    return args;
  }

  private replaceArgVariables(
    arg: string,
    config: LaunchConfig,
    gameDirectory: string,
    versionId: string
  ): string {
    return arg
      .replace(/\${natives_directory}/g, path.join(gameDirectory, 'versions', versionId, 'natives'))
      .replace(/\${launcher_name}/g, 'Mr_Brodacz-CLIENT')
      .replace(/\${launcher_version}/g, '1.0.0')
      .replace(/\${classpath}/g, '') // Handled separately
      .replace(/\${library_directory}/g, path.join(gameDirectory, 'libraries'))
      .replace(/\${classpath_separator}/g, process.platform === 'win32' ? ';' : ':');
  }

  private replaceGameArgVariables(
    arg: string,
    config: LaunchConfig,
    versionDetails: MinecraftVersionDetails
  ): string {
    const gameDirectory = config.settings.gameDirectory;
    const effectiveGameDir = config.modpackPath || gameDirectory;
    const assetsDir = path.join(gameDirectory, 'assets');

    return arg
      .replace(/\${auth_player_name}/g, config.profile.name)
      .replace(/\${version_name}/g, versionDetails.id)
      .replace(/\${game_directory}/g, effectiveGameDir)
      .replace(/\${assets_root}/g, assetsDir)
      .replace(/\${assets_index_name}/g, versionDetails.assets || versionDetails.id)
      .replace(/\${auth_uuid}/g, config.profile.id)
      .replace(/\${auth_access_token}/g, config.profile.accessToken)
      .replace(/\${user_type}/g, 'msa')
      .replace(/\${version_type}/g, 'Mr_Brodacz CLIENT')
      .replace(/\${user_properties}/g, '{}')
      .replace(/\${resolution_width}/g, '854')
      .replace(/\${resolution_height}/g, '480')
      .replace(/\${auth_xuid}/g, '')
      .replace(/\${clientid}/g, '')
      .replace(/\${quickPlayPath}/g, '')
      .replace(/\${quickPlaySingleplayer}/g, '')
      .replace(/\${quickPlayMultiplayer}/g, '')
      .replace(/\${quickPlayRealms}/g, '');
  }

  /**
   * Convert Maven library name to file path
   * e.g., "net.fabricmc:fabric-loader:0.18.4" -> "net/fabricmc/fabric-loader/0.18.4/fabric-loader-0.18.4.jar"
   */
  private mavenNameToPath(name: string, librariesDir: string): string {
    const parts = name.split(':');
    if (parts.length < 3) return '';
    
    const [group, artifact, version, classifier] = parts;
    const groupPath = group.replace(/\./g, '/');
    
    let filename = `${artifact}-${version}`;
    if (classifier) {
      filename += `-${classifier}`;
    }
    filename += '.jar';
    
    return path.join(librariesDir, groupPath, artifact, version, filename);
  }

  private shouldIncludeLibrary(library: Library): boolean {
    if (!library.rules) return true;

    const platform = this.getPlatform();
    let allowed = false;

    for (const rule of library.rules) {
      if (rule.os) {
        if (rule.os.name && rule.os.name !== platform) continue;
      }
      allowed = rule.action === 'allow';
    }

    return allowed;
  }

  private checkRules(rules?: any[]): boolean {
    if (!rules || rules.length === 0) return true;

    const platform = this.getPlatform();
    let allowed = false;

    for (const rule of rules) {
      if (rule.os) {
        if (rule.os.name && rule.os.name !== platform) continue;
      }
      if (rule.features) {
        // Skip feature-specific rules for now
        continue;
      }
      allowed = rule.action === 'allow';
    }

    return allowed;
  }

  private getPlatform(): string {
    const platform = process.platform;
    if (platform === 'win32') return 'windows';
    if (platform === 'darwin') return 'osx';
    return 'linux';
  }

  private findJava(): string {
    const javaExe = process.platform === 'win32' ? 'java.exe' : 'java';
    const foundJavas: { path: string; version: number }[] = [];

    // Helper to extract version number from folder name
    const extractVersion = (name: string): number => {
      const match = name.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // Check JAVA_HOME first
    if (process.env.JAVA_HOME) {
      const javaPath = path.join(process.env.JAVA_HOME, 'bin', javaExe);
      if (fs.existsSync(javaPath)) {
        const version = extractVersion(process.env.JAVA_HOME);
        foundJavas.push({ path: javaPath, version });
      }
    }

    // Check common locations on Windows
    if (process.platform === 'win32') {
      const programFiles = [
        process.env['ProgramFiles'] || 'C:\\Program Files',
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        process.env.LOCALAPPDATA || '',
      ];

      for (const pf of programFiles) {
        if (!pf) continue;

        // Check Java folder
        const javaDir = path.join(pf, 'Java');
        if (fs.existsSync(javaDir)) {
          try {
            const entries = fs.readdirSync(javaDir);
            for (const entry of entries) {
              if (entry.startsWith('jdk') || entry.startsWith('jre')) {
                const javaPath = path.join(javaDir, entry, 'bin', javaExe);
                if (fs.existsSync(javaPath)) {
                  foundJavas.push({ path: javaPath, version: extractVersion(entry) });
                }
              }
            }
          } catch (e) { /* ignore */ }
        }

        // Check Eclipse Adoptium/Temurin
        const adoptiumDir = path.join(pf, 'Eclipse Adoptium');
        if (fs.existsSync(adoptiumDir)) {
          try {
            const entries = fs.readdirSync(adoptiumDir);
            for (const entry of entries) {
              const javaPath = path.join(adoptiumDir, entry, 'bin', javaExe);
              if (fs.existsSync(javaPath)) {
                foundJavas.push({ path: javaPath, version: extractVersion(entry) });
              }
            }
          } catch (e) { /* ignore */ }
        }

        // Check Microsoft JDK
        const msJdkDir = path.join(pf, 'Microsoft');
        if (fs.existsSync(msJdkDir)) {
          try {
            const entries = fs.readdirSync(msJdkDir);
            for (const entry of entries) {
              if (entry.startsWith('jdk')) {
                const javaPath = path.join(msJdkDir, entry, 'bin', javaExe);
                if (fs.existsSync(javaPath)) {
                  foundJavas.push({ path: javaPath, version: extractVersion(entry) });
                }
              }
            }
          } catch (e) { /* ignore */ }
        }

        // Check Zulu JDK
        const zuluDir = path.join(pf, 'Zulu');
        if (fs.existsSync(zuluDir)) {
          try {
            const entries = fs.readdirSync(zuluDir);
            for (const entry of entries) {
              const javaPath = path.join(zuluDir, entry, 'bin', javaExe);
              if (fs.existsSync(javaPath)) {
                foundJavas.push({ path: javaPath, version: extractVersion(entry) });
              }
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    // Sort by version (highest first) and prefer 21+
    foundJavas.sort((a, b) => b.version - a.version);

    // Log found Java versions
    if (foundJavas.length > 0) {
      log.info(`Found Java versions: ${foundJavas.map(j => `${j.version} at ${j.path}`).join(', ')}`);
      
      // Prefer Java 21+ for modern Minecraft
      const java21Plus = foundJavas.find(j => j.version >= 21);
      if (java21Plus) {
        log.info(`Using Java ${java21Plus.version}: ${java21Plus.path}`);
        return java21Plus.path;
      }

      // Fallback to highest available
      log.warn(`Java 21+ not found, using Java ${foundJavas[0].version}: ${foundJavas[0].path}`);
      return foundJavas[0].path;
    }

    // Fallback to PATH
    log.warn('No Java found in common locations, falling back to PATH');
    return javaExe;
  }

  private async extractNativesForLaunch(
    gameDirectory: string,
    versionDetails: MinecraftVersionDetails,
    versionId: string
  ): Promise<string> {
    // Determine the correct natives directory
    // For loaders (Fabric/Forge), extract to parent version's natives folder
    const parentId = (versionDetails as any).inheritsFrom;
    const targetVersionId = parentId || versionId;
    const nativesDir = path.join(gameDirectory, 'versions', targetVersionId, 'natives');
    
    // Create natives directory
    fs.mkdirSync(nativesDir, { recursive: true });

    // Check if natives already exist (more than just empty folder)
    const existingFiles = fs.existsSync(nativesDir) ? fs.readdirSync(nativesDir) : [];
    const hasDlls = existingFiles.some(f => f.endsWith('.dll') || f.endsWith('.so') || f.endsWith('.dylib'));
    
    if (hasDlls) {
      log.info(`Natives already extracted in ${nativesDir}`);
      return nativesDir;
    }

    log.info(`Extracting natives to ${nativesDir}`);
    
    const librariesDir = path.join(gameDirectory, 'libraries');
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';

    // Platform-specific native suffixes
    const nativeSuffixes: Record<string, string[]> = {
      'windows': ['natives-windows', 'natives-windows-x86_64'],
      'osx': ['natives-macos', 'natives-macos-arm64', 'natives-macos-patch'],
      'linux': ['natives-linux', 'natives-linux-arm64'],
    };
    const currentSuffixes = nativeSuffixes[platform] || [];

    let extractedCount = 0;

    for (const library of versionDetails.libraries) {
      let nativePath: string | null = null;

      // NEW FORMAT: Check if library name contains natives suffix (MC 1.19+)
      const libName = library.name.toLowerCase();
      const isNativeLib = currentSuffixes.some(suffix => libName.includes(`:${suffix}`));
      
      if (isNativeLib && library.downloads?.artifact) {
        // Check rules
        if (library.rules && !this.checkRules(library.rules)) {
          continue;
        }
        nativePath = path.join(librariesDir, library.downloads.artifact.path);
      }
      // OLD FORMAT: Check for natives map and classifiers (MC < 1.19)
      else if (library.natives && library.downloads?.classifiers) {
        const nativeKey = library.natives[platform];
        if (!nativeKey) continue;
        
        const classifier = library.downloads.classifiers[nativeKey];
        if (!classifier) continue;
        
        nativePath = path.join(librariesDir, classifier.path);
      }

      if (!nativePath || !fs.existsSync(nativePath)) continue;

      try {
        const zip = new AdmZip(nativePath);
        const entries = zip.getEntries();

        for (const entry of entries) {
          const entryName = entry.entryName;
          
          // Skip META-INF and directories
          if (entryName.startsWith('META-INF/') || entry.isDirectory) continue;
          
          // Skip excluded files
          if (library.extract?.exclude?.some((ex: string) => entryName.startsWith(ex))) {
            continue;
          }

          // Only extract native files (.dll, .so, .dylib, .jnilib)
          const ext = path.extname(entryName).toLowerCase();
          if (!['.dll', '.so', '.dylib', '.jnilib'].includes(ext) && !entryName.includes('lwjgl') && !entryName.includes('openal')) {
            continue;
          }

          const extractPath = path.join(nativesDir, path.basename(entryName));
          
          try {
            fs.writeFileSync(extractPath, entry.getData());
            extractedCount++;
          } catch (writeError) {
            log.warn(`Failed to extract ${entryName}: ${writeError}`);
          }
        }
        
        log.info(`Extracted natives from ${path.basename(nativePath)}`);
      } catch (error) {
        log.warn(`Failed to extract natives from ${nativePath}:`, error);
      }
    }

    log.info(`Extracted ${extractedCount} native files to ${nativesDir}`);
    return nativesDir;
  }

  private sendLog(level: LogEntry['level'], message: string): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      source: 'minecraft',
      message,
    };

    this.mainWindow.webContents.send(IPC_CHANNELS.GAME_LOG, logEntry);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { app } from 'electron';
import log from 'electron-log';
import { Extract } from 'unzipper';
import { pipeline } from 'stream/promises';

interface AdoptiumRelease {
  binary: {
    architecture: string;
    download_count: number;
    heap_size: string;
    image_type: string;
    jvm_impl: string;
    os: string;
    package: {
      checksum: string;
      checksum_link: string;
      download_count: number;
      link: string;
      metadata_link: string;
      name: string;
      size: number;
    };
    project: string;
    scm_ref: string;
    updated_at: string;
  };
  release_name: string;
  vendor: string;
  version: {
    build: number;
    major: number;
    minor: number;
    openjdk_version: string;
    security: number;
    semver: string;
  };
}

interface JavaInstallation {
  version: number;
  path: string;
  vendor: string;
  installed: boolean;
}

export class JavaService {
  private javaDir: string;
  private installationsFile: string;

  constructor() {
    this.javaDir = path.join(app.getPath('userData'), 'java');
    this.installationsFile = path.join(this.javaDir, 'installations.json');
    
    if (!fs.existsSync(this.javaDir)) {
      fs.mkdirSync(this.javaDir, { recursive: true });
    }
  }

  /**
   * Get required Java version for Minecraft version
   */
  getRequiredJavaVersion(mcVersion: string): number {
    const parts = mcVersion.split('.');
    const major = parseInt(parts[1] || '0', 10);
    
    // MC 1.21+ requires Java 21
    if (major >= 21) {
      return 21;
    }
    // MC 1.18-1.20 requires Java 17
    if (major >= 18) {
      return 17;
    }
    // MC 1.17 requires Java 16
    if (major === 17) {
      return 16;
    }
    // Older versions use Java 8
    return 8;
  }

  /**
   * Check if Java version is installed
   */
  isJavaInstalled(version: number): boolean {
    const javaPath = this.getJavaPath(version);
    return fs.existsSync(javaPath);
  }

  /**
   * Get Java executable path for version
   */
  getJavaPath(version: number): string {
    const javaHome = path.join(this.javaDir, `jdk-${version}`);
    const javaExe = process.platform === 'win32' ? 'java.exe' : 'java';
    return path.join(javaHome, 'bin', javaExe);
  }

  /**
   * Get all installed Java versions
   */
  getInstalledVersions(): JavaInstallation[] {
    const installations: JavaInstallation[] = [];
    
    if (!fs.existsSync(this.javaDir)) {
      return installations;
    }

    const entries = fs.readdirSync(this.javaDir);
    for (const entry of entries) {
      if (entry.startsWith('jdk-')) {
        const version = parseInt(entry.replace('jdk-', ''), 10);
        const javaPath = this.getJavaPath(version);
        installations.push({
          version,
          path: javaPath,
          vendor: 'Eclipse Temurin',
          installed: fs.existsSync(javaPath),
        });
      }
    }

    return installations.sort((a, b) => b.version - a.version);
  }

  /**
   * Download and install Java version
   */
  async downloadJava(
    version: number,
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<string> {
    log.info(`Downloading Java ${version}...`);

    const arch = process.arch === 'x64' ? 'x64' : 'x64'; // Default to x64
    const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';

    // Get download URL from Adoptium API
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${version}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`;
    
    const releases = await this.fetchJson<AdoptiumRelease[]>(apiUrl);
    
    if (!releases || releases.length === 0) {
      throw new Error(`No Java ${version} release found for ${os} ${arch}`);
    }

    const release = releases[0];
    const downloadUrl = release.binary.package.link;
    const fileName = release.binary.package.name;
    const totalSize = release.binary.package.size;

    log.info(`Downloading from: ${downloadUrl}`);
    log.info(`File: ${fileName}, Size: ${Math.round(totalSize / 1024 / 1024)}MB`);

    // Create temp directory
    const tempDir = path.join(this.javaDir, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, fileName);
    const targetDir = path.join(this.javaDir, `jdk-${version}`);

    // Download file
    await this.downloadFile(downloadUrl, tempFile, totalSize, onProgress);

    log.info('Download complete, extracting...');

    // Extract based on file type
    if (fileName.endsWith('.zip')) {
      await this.extractZip(tempFile, tempDir);
    } else if (fileName.endsWith('.tar.gz')) {
      await this.extractTarGz(tempFile, tempDir);
    }

    // Find extracted folder and move to target
    const extractedEntries = fs.readdirSync(tempDir).filter(e => e.startsWith('jdk') || e.startsWith('OpenJDK'));
    if (extractedEntries.length === 0) {
      throw new Error('Failed to find extracted JDK folder');
    }

    const extractedDir = path.join(tempDir, extractedEntries[0]);
    
    // Remove existing installation
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Move to final location - use copy+delete as rename can fail across drives
    try {
      fs.renameSync(extractedDir, targetDir);
    } catch (renameError) {
      log.warn('Rename failed, using copy approach:', renameError);
      // Copy recursively then delete
      this.copyDirSync(extractedDir, targetDir);
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }

    // Cleanup temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      log.warn('Failed to cleanup temp files:', e);
    }

    const javaPath = this.getJavaPath(version);
    log.info(`Java ${version} installed successfully at: ${javaPath}`);

    return javaPath;
  }

  private fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'MinecraftLauncher/1.0' } }, (res) => {
        if (res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          this.fetchJson<T>(res.headers.location!).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e}`));
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private downloadFile(
    url: string,
    dest: string,
    totalSize: number,
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      let downloaded = 0;

      const makeRequest = (requestUrl: string) => {
        https.get(requestUrl, { headers: { 'User-Agent': 'MinecraftLauncher/1.0' } }, (res) => {
          if (res.statusCode === 307 || res.statusCode === 302 || res.statusCode === 301) {
            makeRequest(res.headers.location!);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          res.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (onProgress) {
              onProgress({
                downloaded,
                total: totalSize,
                percentage: Math.round((downloaded / totalSize) * 100),
              });
            }
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        }).on('error', reject);
      };

      makeRequest(url);
    });
  }

  private async extractZip(zipPath: string, destDir: string): Promise<void> {
    const unzipper = await import('unzipper');
    await pipeline(
      fs.createReadStream(zipPath),
      unzipper.Extract({ path: destDir })
    );
  }

  private async extractTarGz(tarPath: string, destDir: string): Promise<void> {
    // For tar.gz, we need to use a different approach
    // Using child_process for simplicity
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    if (process.platform === 'win32') {
      // Use tar on Windows 10+
      await execAsync(`tar -xzf "${tarPath}" -C "${destDir}"`);
    } else {
      await execAsync(`tar -xzf "${tarPath}" -C "${destDir}"`);
    }
  }

  /**
   * Get or download Java for Minecraft version
   */
  async ensureJavaForMinecraft(
    mcVersion: string,
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<string> {
    const requiredVersion = this.getRequiredJavaVersion(mcVersion);
    
    // Check if already installed
    if (this.isJavaInstalled(requiredVersion)) {
      log.info(`Java ${requiredVersion} already installed`);
      return this.getJavaPath(requiredVersion);
    }

    // Download required version
    log.info(`Java ${requiredVersion} not found, downloading...`);
    return await this.downloadJava(requiredVersion, onProgress);
  }

  /**
   * Recursively copy a directory
   */
  private copyDirSync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

export const javaService = new JavaService();

/**
 * SecureStorageService - Secure credential storage using Electron's safeStorage API
 * 
 * Uses the operating system's secure storage:
 * - Windows: DPAPI (Data Protection API)
 * - macOS: Keychain
 * - Linux: libsecret / kwallet
 * 
 * Falls back to electron-store with encryption if safeStorage is unavailable.
 */

import { safeStorage } from 'electron';
import Store from 'electron-store';
import * as crypto from 'crypto';
import log from 'electron-log';
import { getLauncherDirectory } from '../shared/constants';

interface SecureData {
  [key: string]: string;
}

export class SecureStorageService {
  private store: Store<{ secureData: Record<string, string> }>;
  private encryptionKey: string | null = null;

  constructor() {
    this.store = new Store<{ secureData: Record<string, string> }>({
      name: 'secure-auth',
      cwd: getLauncherDirectory(),
      defaults: {
        secureData: {},
      },
    });
  }

  /**
   * Check if system secure storage is available
   */
  isSecureStorageAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Encrypt and store a value securely
   */
  async setSecure(key: string, value: string): Promise<void> {
    try {
      if (this.isSecureStorageAvailable()) {
        // Use OS-level encryption (most secure)
        const encrypted = safeStorage.encryptString(value);
        const base64 = encrypted.toString('base64');
        
        const secureData = this.store.get('secureData', {});
        secureData[key] = base64;
        this.store.set('secureData', secureData);
        
        log.info(`[SecureStorage] Stored ${key} using safeStorage`);
      } else {
        // Fallback to AES encryption (still secure, but key is stored locally)
        const encrypted = this.encryptWithAES(value);
        
        const secureData = this.store.get('secureData', {});
        secureData[key] = `aes:${encrypted}`;
        this.store.set('secureData', secureData);
        
        log.warn(`[SecureStorage] safeStorage unavailable, using AES fallback for ${key}`);
      }
    } catch (error) {
      log.error(`[SecureStorage] Failed to store ${key}:`, error);
      throw new Error(`Failed to securely store ${key}`);
    }
  }

  /**
   * Retrieve and decrypt a securely stored value
   */
  async getSecure(key: string): Promise<string | null> {
    try {
      const secureData = this.store.get('secureData', {});
      const stored = secureData[key];
      
      if (!stored) {
        return null;
      }

      if (stored.startsWith('aes:')) {
        // AES encrypted data
        const encrypted = stored.slice(4);
        return this.decryptWithAES(encrypted);
      } else {
        // safeStorage encrypted data
        if (!this.isSecureStorageAvailable()) {
          log.error(`[SecureStorage] Cannot decrypt ${key}: safeStorage is no longer available`);
          return null;
        }
        
        const buffer = Buffer.from(stored, 'base64');
        return safeStorage.decryptString(buffer);
      }
    } catch (error) {
      log.error(`[SecureStorage] Failed to retrieve ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a securely stored value
   */
  async removeSecure(key: string): Promise<void> {
    try {
      const secureData = this.store.get('secureData', {});
      delete secureData[key];
      this.store.set('secureData', secureData);
      log.info(`[SecureStorage] Removed ${key}`);
    } catch (error) {
      log.error(`[SecureStorage] Failed to remove ${key}:`, error);
    }
  }

  /**
   * Clear all securely stored data
   */
  async clearAll(): Promise<void> {
    try {
      this.store.set('secureData', {});
      log.info('[SecureStorage] Cleared all secure data');
    } catch (error) {
      log.error('[SecureStorage] Failed to clear data:', error);
    }
  }

  /**
   * AES-256-GCM encryption fallback
   */
  private encryptWithAES(plaintext: string): string {
    const key = this.getOrCreateEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * AES-256-GCM decryption fallback
   */
  private decryptWithAES(ciphertext: string): string {
    const key = this.getOrCreateEncryptionKey();
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get or create a machine-specific encryption key
   * Uses PBKDF2 key derivation from machine-specific seed instead of storing raw key
   */
  private getOrCreateEncryptionKey(): string {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    const keyStore = new Store<{ encSalt?: string; encKey?: string }>({
      name: 'secure-key',
      cwd: getLauncherDirectory(),
    });

    // Migrate from old raw key storage to salt-based derivation
    const legacyKey = keyStore.get('encKey');
    let salt = keyStore.get('encSalt');

    if (!salt) {
      salt = crypto.randomBytes(32).toString('hex');
      keyStore.set('encSalt', salt);

      if (legacyKey) {
        // Keep legacy key temporarily for re-encryption migration
        // (existing data still needs old key to decrypt first)
        this.encryptionKey = legacyKey;
        return legacyKey;
      }

      log.info('[SecureStorage] Generated new encryption salt');
    } else if (legacyKey) {
      // Migration: remove stored raw key once salt exists
      keyStore.delete('encKey' as any);
      log.info('[SecureStorage] Removed legacy raw encryption key');
    }

    // Derive key from machine-specific seed + stored salt
    const os = require('os');
    const machineSeed = [
      os.hostname(),
      os.homedir(),
      os.userInfo().username,
      os.cpus()[0]?.model || '',
      os.totalmem().toString(),
    ].join('|');

    const key = crypto.pbkdf2Sync(
      machineSeed,
      Buffer.from(salt, 'hex'),
      100000,
      32,
      'sha512'
    );

    this.encryptionKey = key.toString('hex');
    return this.encryptionKey;
  }
}

// Singleton instance
export const secureStorage = new SecureStorageService();

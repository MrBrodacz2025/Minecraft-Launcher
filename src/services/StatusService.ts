import axios from 'axios';
import log from 'electron-log';

import type { MojangServerStatus } from '../shared/types';

interface MojangStatusResponse {
  [key: string]: 'green' | 'yellow' | 'red';
}

export class StatusService {
  private statusCache: MojangServerStatus[] = [];
  private lastCheck: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  async getMojangStatus(): Promise<MojangServerStatus[]> {
    // Check cache
    if (this.statusCache.length > 0 && Date.now() - this.lastCheck < this.cacheTTL) {
      return this.statusCache;
    }

    try {
      // Check actual working API endpoints (Microsoft auth replaced Mojang auth)
      const services = [
        { 
          service: 'session.minecraft.net', 
          url: 'https://sessionserver.mojang.com/blockedservers',
        },
        { 
          service: 'authserver.mojang.com', 
          url: 'https://api.minecraftservices.com/minecraft/profile',
        },
        { 
          service: 'textures.minecraft.net', 
          url: 'https://sessionserver.mojang.com/session/minecraft/profile/069a79f444e94726a5befca90e38aaf5',
        },
        { 
          service: 'api.mojang.com', 
          url: 'https://api.mojang.com/',
        },
      ];

      const statuses: MojangServerStatus[] = [];

      const checkPromises = services.map(async (svc) => {
        try {
          const startTime = Date.now();
          await axios.get(svc.url, { 
            timeout: 10000,
            validateStatus: () => true, // Accept any status code
            headers: {
              'User-Agent': 'MinecraftLauncher/1.0'
            }
          });
          const responseTime = Date.now() - startTime;

          let status: 'green' | 'yellow' | 'red';
          if (responseTime < 1000) {
            status = 'green';
          } else if (responseTime < 3000) {
            status = 'yellow';
          } else {
            status = 'red';
          }

          return { service: svc.service, status };
        } catch (error: any) {
          // If we got a response (even an error response), server is reachable
          if (error.response) {
            return { service: svc.service, status: 'yellow' as const };
          }
          log.warn(`Service ${svc.service} unreachable:`, error.message);
          return { service: svc.service, status: 'red' as const };
        }
      });

      const results = await Promise.all(checkPromises);
      statuses.push(...results);

      this.statusCache = statuses;
      this.lastCheck = Date.now();

      return statuses;
    } catch (error) {
      log.error('Failed to check Mojang status:', error);
      
      // Return cached status or default
      if (this.statusCache.length > 0) {
        return this.statusCache;
      }

      return [
        { service: 'minecraft.net', status: 'red' },
        { service: 'session.minecraft.net', status: 'red' },
        { service: 'authserver.mojang.com', status: 'red' },
        { service: 'api.mojang.com', status: 'red' },
        { service: 'textures.minecraft.net', status: 'red' },
      ];
    }
  }

  async isAuthServerAvailable(): Promise<boolean> {
    try {
      const statuses = await this.getMojangStatus();
      const authStatus = statuses.find((s) => s.service === 'authserver.mojang.com');
      return authStatus?.status !== 'red';
    } catch {
      return false;
    }
  }

  async isSessionServerAvailable(): Promise<boolean> {
    try {
      const statuses = await this.getMojangStatus();
      const sessionStatus = statuses.find((s) => s.service === 'session.minecraft.net');
      return sessionStatus?.status !== 'red';
    } catch {
      return false;
    }
  }

  async canLaunchGame(): Promise<{ canLaunch: boolean; reason?: string }> {
    try {
      const statuses = await this.getMojangStatus();
      
      const criticalServices = ['session.minecraft.net', 'authserver.mojang.com'];
      const unavailableServices = statuses.filter(
        (s) => criticalServices.includes(s.service) && s.status === 'red'
      );

      if (unavailableServices.length > 0) {
        return {
          canLaunch: false,
          reason: `Serwery Mojang niedostępne: ${unavailableServices.map((s) => s.service).join(', ')}`,
        };
      }

      return { canLaunch: true };
    } catch (error) {
      log.error('Failed to check if game can launch:', error);
      return {
        canLaunch: false,
        reason: 'Nie można sprawdzić statusu serwerów Mojang',
      };
    }
  }

  clearCache(): void {
    this.statusCache = [];
    this.lastCheck = 0;
  }
}

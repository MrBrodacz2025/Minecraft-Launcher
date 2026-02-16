import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiServer, FiRefreshCw, FiChevronDown, FiWifi, FiWifiOff } from 'react-icons/fi';

import { useElectronAPI } from '../hooks/useElectronAPI';
import type { ServerStatus as ServerStatusType } from '../types';

interface ServerStatusProps {
  compact?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ServerStatus: React.FC<ServerStatusProps> = ({
  compact = false,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}) => {
  const api = useElectronAPI();

  const [status, setStatus] = useState<ServerStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    checkStatus();

    if (autoRefresh) {
      const interval = setInterval(checkStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const mojangStatus = await api.status.getMojang();
      
      // Transform MojangServerStatus[] to ServerStatusType
      const statusMap: ServerStatusType = {
        sessionServer: 'unknown',
        authServer: 'unknown',
        texturesServer: 'unknown',
        apiServer: 'unknown',
        allGreen: false,
      };
      
      for (const service of mojangStatus) {
        if (service.service.includes('session')) {
          statusMap.sessionServer = service.status;
        } else if (service.service.includes('auth')) {
          statusMap.authServer = service.status;
        } else if (service.service.includes('textures')) {
          statusMap.texturesServer = service.status;
        } else if (service.service.includes('api')) {
          statusMap.apiServer = service.status;
        }
      }
      
      statusMap.allGreen = [statusMap.sessionServer, statusMap.authServer, statusMap.texturesServer, statusMap.apiServer]
        .every(s => s === 'green');
      
      setStatus(statusMap);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to check server status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const getOverallStatus = (): 'operational' | 'partial' | 'down' | 'unknown' => {
    if (!status) return 'unknown';

    const services = [
      status.sessionServer,
      status.authServer,
      status.texturesServer,
      status.apiServer,
    ];

    const operational = services.filter((s) => s === 'green').length;
    const down = services.filter((s) => s === 'red').length;

    if (operational === services.length) return 'operational';
    if (down === services.length) return 'down';
    if (down > 0 || services.some((s) => s === 'yellow')) return 'partial';
    return 'operational';
  };

  const getStatusColor = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'green':
        return 'Działa';
      case 'yellow':
        return 'Problemy';
      case 'red':
        return 'Niedostępny';
      default:
        return 'Nieznany';
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return '';
    return lastUpdate.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const overallStatus = getOverallStatus();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            overallStatus === 'operational'
              ? 'bg-green-500'
              : overallStatus === 'partial'
              ? 'bg-yellow-500'
              : overallStatus === 'down'
              ? 'bg-red-500'
              : 'bg-gray-500'
          }`}
        />
        <span className="text-sm text-launcher-textMuted">
          {overallStatus === 'operational'
            ? 'Serwery online'
            : overallStatus === 'partial'
            ? 'Częściowe problemy'
            : overallStatus === 'down'
            ? 'Serwery offline'
            : 'Sprawdzanie...'}
        </span>
      </div>
    );
  }

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-launcher-cardHover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              overallStatus === 'operational'
                ? 'bg-green-500/20 text-green-500'
                : overallStatus === 'partial'
                ? 'bg-yellow-500/20 text-yellow-500'
                : overallStatus === 'down'
                ? 'bg-red-500/20 text-red-500'
                : 'bg-gray-500/20 text-gray-500'
            }`}
          >
            {loading ? (
              <FiRefreshCw className="w-5 h-5 animate-spin" />
            ) : overallStatus === 'operational' ? (
              <FiWifi className="w-5 h-5" />
            ) : overallStatus === 'down' ? (
              <FiWifiOff className="w-5 h-5" />
            ) : (
              <FiServer className="w-5 h-5" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-medium">Status serwerów Mojang</h3>
            <p className="text-sm text-launcher-textMuted">
              {overallStatus === 'operational'
                ? 'Wszystkie serwery działają prawidłowo'
                : overallStatus === 'partial'
                ? 'Niektóre serwery mają problemy'
                : overallStatus === 'down'
                ? 'Serwery są niedostępne'
                : 'Sprawdzanie statusu...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-launcher-textDim">
              {formatLastUpdate()}
            </span>
          )}
          <FiChevronDown
            className={`w-5 h-5 text-launcher-textDim transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && status && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-launcher-border"
          >
            <div className="p-4 space-y-3">
              <ServiceRow
                name="Session Server"
                description="Autoryzacja sesji gracza"
                status={status.sessionServer}
              />
              <ServiceRow
                name="Auth Server"
                description="Logowanie do konta Microsoft/Mojang"
                status={status.authServer}
              />
              <ServiceRow
                name="Textures Server"
                description="Skórki i peleryny graczy"
                status={status.texturesServer}
              />
              <ServiceRow
                name="API Server"
                description="Publiczne API Mojang"
                status={status.apiServer}
              />

              <div className="pt-3 flex justify-between items-center border-t border-launcher-border">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    checkStatus();
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm text-launcher-textMuted hover:text-launcher-text transition-colors"
                >
                  <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Odśwież
                </button>
                <a
                  href="https://status.mojang.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-launcher-accent hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  status.mojang.com
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ServiceRowProps {
  name: string;
  description: string;
  status: 'green' | 'yellow' | 'red' | 'unknown';
}

const ServiceRow: React.FC<ServiceRowProps> = ({ name, description, status }) => {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (s: string) => {
    switch (s) {
      case 'green':
        return 'Działa';
      case 'yellow':
        return 'Problemy';
      case 'red':
        return 'Offline';
      default:
        return 'Nieznany';
    }
  };

  const getStatusTextColor = (s: string) => {
    switch (s) {
      case 'green':
        return 'text-green-500';
      case 'yellow':
        return 'text-yellow-500';
      case 'red':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-launcher-cardHover rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
        <div>
          <h4 className="font-medium text-sm">{name}</h4>
          <p className="text-xs text-launcher-textDim">{description}</p>
        </div>
      </div>
      <span className={`text-sm font-medium ${getStatusTextColor(status)}`}>
        {getStatusText(status)}
      </span>
    </div>
  );
};

export default ServerStatus;

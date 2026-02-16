import React from 'react';
import { motion } from 'framer-motion';
import { FiDownload, FiFile, FiPackage, FiCheck, FiLoader } from 'react-icons/fi';

import type { DownloadProgress as DownloadProgressType } from '../types';

interface DownloadProgressProps {
  progress: DownloadProgressType | null;
  isInstalling?: boolean;
  compact?: boolean;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({
  progress,
  isInstalling = false,
  compact = false,
}) => {
  if (!progress && !isInstalling) return null;

  const getIcon = () => {
    if (!progress) return <FiLoader className="w-5 h-5 animate-spin" />;
    
    switch (progress.type) {
      case 'client':
        return <FiPackage className="w-5 h-5" />;
      case 'libraries':
        return <FiFile className="w-5 h-5" />;
      case 'assets':
        return <FiDownload className="w-5 h-5" />;
      case 'loader':
        return <FiPackage className="w-5 h-5" />;
      case 'mod':
        return <FiDownload className="w-5 h-5" />;
      default:
        return <FiDownload className="w-5 h-5" />;
    }
  };

  const getTypeLabel = () => {
    if (!progress) return 'Przygotowanie...';
    
    switch (progress.type) {
      case 'client':
        return 'Klient Minecraft';
      case 'libraries':
        return 'Biblioteki';
      case 'assets':
        return 'Zasoby';
      case 'loader':
        return progress.name || 'Loader';
      case 'mod':
        return progress.name || 'Mod';
      default:
        return 'Pobieranie';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-launcher-accent animate-pulse">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="progress-bar h-2">
            <motion.div
              className="progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress?.percentage || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <span className="text-sm text-launcher-textMuted min-w-[3rem] text-right">
          {progress?.percentage || 0}%
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card !p-4"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-launcher-accent/20 rounded-lg flex items-center justify-center text-launcher-accent">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium truncate">{getTypeLabel()}</h4>
            {progress?.totalFiles && progress?.downloadedFiles !== undefined && (
              <span className="text-sm text-launcher-textMuted">
                {progress.downloadedFiles}/{progress.totalFiles} plików
              </span>
            )}
          </div>
          
          {progress?.name && progress.type !== 'loader' && progress.type !== 'mod' && (
            <p className="text-sm text-launcher-textMuted truncate mb-2">
              {progress.name}
            </p>
          )}
          
          <div className="progress-bar mb-2">
            <motion.div
              className="progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress?.percentage || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          <div className="flex items-center justify-between text-sm text-launcher-textMuted">
            <div className="flex items-center gap-4">
              {progress?.downloadedBytes !== undefined && progress?.totalBytes !== undefined && (
                <span>
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </span>
              )}
              {progress?.speed !== undefined && progress.speed > 0 && (
                <span>{formatSpeed(progress.speed)}</span>
              )}
            </div>
            <span className="font-mono text-launcher-accent">
              {progress?.percentage || 0}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Additional stages for client download */}
      {progress?.type === 'client' && (
        <div className="mt-4 pt-4 border-t border-launcher-border">
          <div className="flex items-center gap-4 text-sm">
            <StageIndicator 
              label="Klient" 
              status={progress.percentage >= 100 ? 'done' : 'active'} 
            />
            <StageIndicator 
              label="Biblioteki" 
              status={progress.percentage >= 100 ? 'waiting' : 'waiting'} 
            />
            <StageIndicator 
              label="Zasoby" 
              status="waiting" 
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface StageIndicatorProps {
  label: string;
  status: 'waiting' | 'active' | 'done';
}

const StageIndicator: React.FC<StageIndicatorProps> = ({ label, status }) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          status === 'done'
            ? 'bg-green-500'
            : status === 'active'
            ? 'bg-launcher-accent animate-pulse'
            : 'bg-launcher-cardHover'
        }`}
      >
        {status === 'done' ? (
          <FiCheck className="w-3 h-3 text-white" />
        ) : status === 'active' ? (
          <div className="w-2 h-2 bg-white rounded-full" />
        ) : null}
      </div>
      <span
        className={
          status === 'done'
            ? 'text-green-500'
            : status === 'active'
            ? 'text-launcher-text'
            : 'text-launcher-textDim'
        }
      >
        {label}
      </span>
    </div>
  );
};

export default DownloadProgress;

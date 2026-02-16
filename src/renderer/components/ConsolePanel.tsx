import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiTrash2 } from 'react-icons/fi';

import { useElectronAPI } from '../hooks/useElectronAPI';
import type { LogEntry } from '../types';

interface ConsolePanelProps {
  onClose: () => void;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const api = useElectronAPI();

  useEffect(() => {
    const unsubscribe = api.on.gameLog((log: LogEntry) => {
      setLogs((prev) => [...prev.slice(-500), log]); // Keep last 500 logs
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const clearLogs = () => setLogs([]);

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-launcher-textMuted';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="h-full bg-launcher-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-launcher-border">
        <span className="font-medium text-sm">Konsola</span>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="p-1.5 hover:bg-launcher-card rounded transition-colors"
            title="Wyczyść"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-launcher-card rounded transition-colors"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-launcher-textDim">Brak logów do wyświetlenia...</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex gap-2 py-0.5">
              <span className="text-launcher-textDim flex-shrink-0">
                [{formatTime(log.timestamp)}]
              </span>
              <span className={`flex-shrink-0 ${getLogColor(log.level)}`}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="text-launcher-text break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default ConsolePanel;

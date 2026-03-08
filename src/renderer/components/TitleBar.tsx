import React, { useState, useRef, useEffect } from 'react';
import { FiMinus, FiSquare, FiX, FiBell, FiLogOut, FiRefreshCw, FiUser } from 'react-icons/fi';

import { useElectronAPI } from '../hooks/useElectronAPI';
import launcherIcon from '../../../assets/icon.png';
import { useI18n } from '../i18n';
import type { MinecraftProfile } from '../types';

interface TitleBarProps {
  profile: MinecraftProfile | null;
  onShowNotifications: () => void;
  notificationCount: number;
  onLogin: () => void;
  onLogout: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({
  profile,
  onShowNotifications,
  notificationCount,
  onLogin,
  onLogout,
}) => {
  const api = useElectronAPI();
  const { t } = useI18n();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMinimize = () => api.window.minimize();
  const handleMaximize = () => api.window.maximize();
  const handleClose = () => api.window.close();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleChangeAccount = async () => {
    setShowUserMenu(false);
    await onLogout();
    await onLogin();
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  return (
    <div className="h-10 bg-launcher-bg border-b border-launcher-border flex items-center justify-between px-4 drag-region">
      {/* Logo and Title */}
      <div className="flex items-center gap-3 no-drag">
        <img src={launcherIcon} alt="Logo" className="w-6 h-6 rounded" />
        <span className="font-semibold text-sm">EnderGate</span>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2 no-drag">
        {/* User info with dropdown */}
        {profile && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 mr-2 px-2 py-1 rounded-lg hover:bg-launcher-card transition-colors cursor-pointer"
            >
              <img
                src={`https://mc-heads.net/avatar/${profile.name}/24`}
                alt={profile.name}
                className="w-6 h-6 rounded"
              />
              <span className="text-sm text-launcher-textMuted">{profile.name}</span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-launcher-card border border-launcher-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-launcher-border">
                  <p className="text-sm font-medium truncate">{profile.name}</p>
                  <p className="text-xs text-launcher-textMuted truncate">{profile.id}</p>
                </div>
                
                <button
                  onClick={handleChangeAccount}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-launcher-cardHover transition-colors"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  {t('titleBar.changeAccount')}
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-launcher-cardHover transition-colors text-red-400"
                >
                  <FiLogOut className="w-4 h-4" />
                  {t('titleBar.logout')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Login button when not logged in */}
        {!profile && (
          <button
            onClick={onLogin}
            className="flex items-center gap-2 mr-2 px-3 py-1 rounded-lg bg-launcher-accent hover:bg-launcher-accent/80 transition-colors text-sm"
          >
            <FiUser className="w-4 h-4" />
            {t('home.loginButton')}
          </button>
        )}

        {/* Notifications */}
        <button
          onClick={onShowNotifications}
          className="relative p-2 hover:bg-launcher-card rounded-lg transition-colors"
        >
          <FiBell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-launcher-accent text-xs rounded-full flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Window controls */}
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-launcher-card rounded-lg transition-colors"
        >
          <FiMinus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 hover:bg-launcher-card rounded-lg transition-colors"
        >
          <FiSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

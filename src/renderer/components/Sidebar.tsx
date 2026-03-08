import React from 'react';
import { FiHome, FiPackage, FiBox, FiSettings, FiTerminal } from 'react-icons/fi';
import { useI18n } from '../i18n';

type Page = 'home' | 'mods' | 'modpacks' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onToggleConsole: () => void;
  showConsole: boolean;
}

const navItems: { id: Page; icon: React.ElementType; labelKey: string }[] = [
  { id: 'home', icon: FiHome, labelKey: 'sidebar.home' },
  { id: 'mods', icon: FiPackage, labelKey: 'sidebar.mods' },
  { id: 'modpacks', icon: FiBox, labelKey: 'sidebar.modpacks' },
  { id: 'settings', icon: FiSettings, labelKey: 'sidebar.settings' },
];

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  onToggleConsole,
  showConsole,
}) => {
  const { t } = useI18n();
  
  return (
    <aside className="w-16 bg-launcher-card border-r border-launcher-border flex flex-col items-center py-4">
      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-launcher-accent text-white'
                  : 'text-launcher-textMuted hover:bg-launcher-cardHover hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 bg-launcher-cardHover text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Console Toggle */}
      <button
        onClick={onToggleConsole}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 group ${
          showConsole
            ? 'bg-launcher-secondary text-white'
            : 'text-launcher-textMuted hover:bg-launcher-cardHover hover:text-white'
        }`}
      >
        <FiTerminal className="w-5 h-5" />
        
        {/* Tooltip */}
        <span className="absolute left-full ml-2 px-2 py-1 bg-launcher-cardHover text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {t('sidebar.console')}
        </span>
      </button>
    </aside>
  );
};

export default Sidebar;

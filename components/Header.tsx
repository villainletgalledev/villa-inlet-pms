import React from 'react';
import { navItems } from './Sidebar';
import { Building2, Menu } from 'lucide-react';

interface HeaderProps {
  currentPath: string;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  onToggleMobileMenu,
}) => {
  const currentItem = navItems.find((item) => item.href === currentPath) || {
    name: currentPath === '/' ? 'Dashboard' : 'Overview',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Left: Mobile hamburger toggle & Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          id="btn-open-mobile-menu"
          type="button"
          onClick={onToggleMobileMenu}
          aria-label="Open Navigation Menu"
          className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-500 font-medium min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Villa Inlet</span>
            <span className="text-slate-300">/</span>
          </div>
          <span className="text-slate-900 font-semibold truncate text-sm sm:text-base">
            {currentItem.name}
          </span>
        </div>
      </div>

      {/* Right: Status badge & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="hidden md:inline">System Operational</span>
          <span className="md:hidden">Online</span>
        </div>
      </div>
    </header>
  );
};

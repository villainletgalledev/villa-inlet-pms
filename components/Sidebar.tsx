import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Sparkles,
  Wrench,
  Boxes,
  BarChart3,
  Users,
  LogOut,
  Hotel,
  ShieldCheck,
  Lock,
  X,
  CalendarSync,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { isOwnerOrManager, ROLE_LABELS, UserRole } from '../lib/rbac';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiresAdmin?: boolean;
}

export const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Booking Calendar', href: '/bookings', icon: CalendarDays },
  { name: 'Rooms', href: '/rooms', icon: BedDouble },
  { name: 'Housekeeping', href: '/housekeeping', icon: Sparkles },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Inventory', href: '/inventory', icon: Boxes },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Users', href: '/users', icon: Users, requiresAdmin: true },
  { name: 'iCal & Sync', href: '/settings/ical', icon: CalendarSync, requiresAdmin: true },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  userEmail?: string;
  userRole?: string;
  userName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  onSignOut,
  userEmail = 'admin@villainlet.com',
  userRole = 'MANAGER',
  userName = 'Villa Manager',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const canAccessUsers = isOwnerOrManager(userRole);

  const handleNavClick = (href: string) => {
    onNavigate(href);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Nav list rendering helper
  const renderNavLinks = (isDrawer: boolean = false) => (
    <div className="flex-1 min-h-0 py-4 px-2.5 lg:px-3 space-y-1 overflow-y-auto">
      <div
        className={cn(
          'pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400',
          isDrawer ? 'px-3 block' : 'hidden lg:block px-3'
        )}
      >
        Management Modules
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          currentPath === item.href || (item.href === '/dashboard' && currentPath === '/');
        const isLocked = item.requiresAdmin && !canAccessUsers;

        return (
          <button
            key={item.href}
            id={isDrawer ? `drawer-nav-${item.href.replace('/', '')}` : `nav-link-${item.href.replace('/', '')}`}
            onClick={() => handleNavClick(item.href)}
            title={item.name}
            className={cn(
              'w-full flex items-center rounded-lg text-xs font-medium transition-colors text-left group relative',
              isDrawer
                ? 'gap-3 px-3 py-2.5'
                : 'md:justify-center md:px-2 md:py-2.5 lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5',
              isActive
                ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                : isLocked
                ? 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4 shrink-0',
                isActive ? 'text-white' : isLocked ? 'text-slate-600' : 'text-slate-400 group-hover:text-white'
              )}
            />

            {/* Label text */}
            <span
              className={cn(
                'truncate',
                isDrawer ? 'block flex-1' : 'hidden lg:block lg:flex-1'
              )}
            >
              {item.name}
            </span>

            {/* Lock / Badge */}
            {isLocked ? (
              <Lock className={cn('w-3 h-3 text-slate-500', isDrawer ? 'block' : 'hidden lg:block')} />
            ) : item.badge ? (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300',
                  isDrawer ? 'block' : 'hidden lg:block'
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  // User footer section helper
  const renderUserFooter = (isDrawer: boolean = false) => (
    <div className="p-2.5 lg:p-3 border-t border-slate-800/80 space-y-2 shrink-0 bg-slate-900/90">
      <div
        className={cn(
          'rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center',
          isDrawer ? 'p-2.5 gap-2.5' : 'md:justify-center md:p-2 lg:p-2.5 lg:justify-start lg:gap-2.5'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-indigo-900/70 border border-indigo-700/60 flex items-center justify-center text-xs font-bold text-indigo-200 uppercase shrink-0">
          {userName.charAt(0)}
        </div>
        <div className={cn('min-w-0', isDrawer ? 'block flex-1' : 'hidden lg:block lg:flex-1')}>
          <p className="text-xs font-medium text-white truncate">{userName}</p>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="truncate font-mono">
              {ROLE_LABELS[userRole as UserRole] || userRole}
            </span>
          </div>
        </div>
      </div>

      <button
        id={isDrawer ? 'btn-drawer-logout' : 'btn-sidebar-logout'}
        onClick={onSignOut}
        title="Sign out"
        className={cn(
          'w-full flex items-center rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors',
          isDrawer
            ? 'justify-center gap-2 px-3 py-2'
            : 'md:justify-center md:p-2 lg:justify-center lg:gap-2 lg:px-3 lg:py-2'
        )}
      >
        <LogOut className="w-3.5 h-3.5 shrink-0" />
        <span className={cn(isDrawer ? 'inline' : 'hidden lg:inline')}>Sign out</span>
      </button>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP & TABLET PERSISTENT SIDEBAR */}
      {/* md: icon rail (w-20), lg+: full expanded sidebar (w-64), below md: hidden */}
      <aside
        className="hidden md:flex flex-col shrink-0 md:w-20 lg:w-64 bg-slate-900 text-slate-100 border-r border-slate-800 h-full max-h-full overflow-hidden transition-all duration-200 z-30 select-none"
        aria-label="Desktop Navigation Sidebar"
      >
        {/* Brand Header */}
        <div className="h-16 px-3 lg:px-5 flex items-center md:justify-center lg:justify-start gap-3 border-b border-slate-800/80 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
          <div className="hidden lg:block min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
              Villa Inlet PMS
            </h1>
            <p className="text-[11px] text-slate-400 font-medium truncate">Property Management</p>
          </div>
        </div>

        {/* Navigation links */}
        {renderNavLinks(false)}

        {/* User footer */}
        {renderUserFooter(false)}
      </aside>

      {/* 2. MOBILE SLIDE-OUT DRAWER */}
      {/* Below md: slide-out drawer overlay */}
      <aside
        id="mobile-navigation-drawer"
        aria-label="Mobile Navigation Drawer"
        aria-hidden={!isMobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-100 flex flex-col shadow-2xl md:hidden transform transition-transform duration-300 ease-in-out border-r border-slate-800',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Drawer Header with Close Button */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Hotel className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">Villa Inlet PMS</h1>
              <p className="text-[11px] text-slate-400 font-medium">Property Management</p>
            </div>
          </div>

          <button
            id="btn-close-mobile-drawer"
            type="button"
            onClick={onCloseMobile}
            aria-label="Close Navigation Menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        {renderNavLinks(true)}

        {/* User footer */}
        {renderUserFooter(true)}
      </aside>
    </>
  );
};

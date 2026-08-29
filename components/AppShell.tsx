import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import LoginPage from '../app/(auth)/login/page';
import AuthCallbackPage from '../app/(auth)/callback/page';
import DashboardPage from '../app/(dashboard)/dashboard/page';
import BookingsPage from '../app/(dashboard)/bookings/page';
import RoomsPage from '../app/(dashboard)/rooms/page';
import HousekeepingPage from '../app/(dashboard)/housekeeping/page';
import MaintenancePage from '../app/(dashboard)/maintenance/page';
import InventoryPage from '../app/(dashboard)/inventory/page';
import ReportsPage from '../app/(dashboard)/reports/page';
import UsersPage from '../app/(dashboard)/users/page';
import SettingsIcalPage from '../app/(dashboard)/settings/ical/page';
import { getClientSession, signOut } from '../lib/supabase/auth-helper';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { isOwnerOrManager, UserRole } from '../lib/rbac';
import { AlertCircle, ShieldAlert, CheckCircle2, UserX } from 'lucide-react';
import { cn } from '../lib/utils';

export const AppShell: React.FC = () => {
  const getInitialPath = () => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/' || p === '' ? '/dashboard' : p;
    }
    return '/dashboard';
  };

  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<{
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
    isActive?: boolean;
  }>({
    email: 'manager@villainlet.com',
    fullName: 'Villa Manager',
    role: 'MANAGER',
    isActive: true,
  });

  const [globalToast, setGlobalToast] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null);
  const [isDeactivatedModal, setIsDeactivatedModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lock body scroll when mobile navigation drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setGlobalToast({ message, type });
    setTimeout(() => {
      setGlobalToast(null);
    }, 5000);
  };

  // Check auth state on mount and subscribe to Supabase auth changes
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const session = await getClientSession();
      if (!mounted) return;

      if (session?.user) {
        const metadata = session.user.user_metadata || {};
        const isActive = metadata.isActive !== false; // default true

        if (!isActive) {
          setIsDeactivatedModal(true);
          setIsAuthenticated(false);
          await signOut();
          return;
        }

        setIsAuthenticated(true);
        setUserProfile({
          id: session.user.id,
          email: session.user.email || 'manager@villainlet.com',
          fullName:
            (metadata.full_name as string) ||
            (session.user.email?.split('@')[0]?.replace('.', ' ').toUpperCase()) ||
            'Villa Manager',
          role: (metadata.role as string) || 'MANAGER',
          isActive: true,
        });
      } else {
        setIsAuthenticated(false);
      }
    }

    checkAuth();

    // Listen to Supabase auth state changes if configured
    if (isSupabaseConfigured()) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const metadata = session.user.user_metadata || {};
          const isActive = metadata.isActive !== false;

          if (!isActive) {
            setIsDeactivatedModal(true);
            setIsAuthenticated(false);
            await signOut();
            return;
          }

          setIsAuthenticated(true);
          setUserProfile({
            id: session.user.id,
            email: session.user.email || 'manager@villainlet.com',
            fullName:
              (metadata.full_name as string) ||
              (session.user.email?.split('@')[0]?.replace('.', ' ').toUpperCase()) ||
              'Villa Manager',
            role: (metadata.role as string) || 'MANAGER',
            isActive: true,
          });
        } else {
          setIsAuthenticated(false);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to popstate for browser navigation (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname === '/' ? '/dashboard' : window.location.pathname;
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    const targetPath = path === '/' ? '/dashboard' : path;

    // Route Guard for /users, /reports, /settings: Check if user is OWNER or MANAGER
    if (
      (targetPath === '/users' || targetPath === '/reports' || targetPath.startsWith('/settings')) &&
      !isOwnerOrManager(userProfile.role)
    ) {
      showToast(
        targetPath.startsWith('/settings')
          ? 'Not authorized: Channel management & iCal settings are accessible to Owners and Managers only.'
          : targetPath === '/reports'
          ? 'Not authorized: Reports & Analytics are accessible to Owners and Managers only.'
          : 'Not authorized: Staff & User management is accessible to Owners and Managers only.',
        'error'
      );
      setCurrentPath('/dashboard');
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/dashboard');
      }
      return;
    }

    setCurrentPath(targetPath);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleLoginSuccess = (user: any) => {
    const metadata = user.user_metadata || {};
    if (metadata.isActive === false) {
      setIsDeactivatedModal(true);
      return;
    }

    setIsAuthenticated(true);
    setUserProfile({
      id: user.id,
      email: user.email || 'manager@villainlet.com',
      fullName:
        (metadata.full_name as string) ||
        (user.email?.split('@')[0]?.replace('.', ' ').toUpperCase()) ||
        'Villa Manager',
      role: (metadata.role as string) || 'MANAGER',
      isActive: true,
    });
    navigate('/dashboard');
  };

  const handleSignOut = async () => {
    await signOut();
    setIsAuthenticated(false);
    navigate('/login');
  };

  // Auth Middleware Routing Logic:
  // 0. Auth Callback Handler for invite / confirmation / recovery links
  if (
    currentPath === '/callback' ||
    currentPath.startsWith('/callback') ||
    currentPath === '/auth/callback' ||
    currentPath.startsWith('/auth/callback')
  ) {
    return (
      <AuthCallbackPage
        onSuccess={handleLoginSuccess}
        onNavigateToLogin={() => navigate('/login')}
      />
    );
  }

  // 1. Loading state while checking session
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading Villa Inlet PMS...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Middleware: Redirect unauthenticated users to /login
  if (!isAuthenticated) {
    return (
      <>
        {isDeactivatedModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-rose-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-3">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Account Deactivated</h3>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Your staff account has been set to inactive by property management. Please contact an Owner or General Manager to restore access.
              </p>
              <button
                type="button"
                onClick={() => setIsDeactivatedModal(false)}
                className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        )}
        <LoginPage onSuccess={handleLoginSuccess} />
      </>
    );
  }

  // 3. Authenticated Middleware: If user is at /login, redirect to /dashboard
  let activeRoute = currentPath === '/login' || currentPath === '/' ? '/dashboard' : currentPath;

  // Enforce route guard if direct URL was typed
  if (
    (activeRoute === '/users' || activeRoute === '/reports' || activeRoute.startsWith('/settings')) &&
    !isOwnerOrManager(userProfile.role)
  ) {
    activeRoute = '/dashboard';
  }

  // Render respective route component
  const renderRouteContent = () => {
    switch (activeRoute) {
      case '/dashboard':
        return <DashboardPage currentUser={userProfile} onNavigate={navigate} />;
      case '/bookings':
        return <BookingsPage currentUser={userProfile} />;
      case '/rooms':
        return <RoomsPage currentUser={userProfile} />;
      case '/housekeeping':
        return <HousekeepingPage currentUser={userProfile} />;
      case '/maintenance':
        return <MaintenancePage currentUser={userProfile} />;
      case '/inventory':
        return <InventoryPage currentUser={userProfile} />;
      case '/reports':
        return (
          <ReportsPage
            currentUser={userProfile}
            onUnauthorizedRedirect={(reason) => {
              showToast(reason, 'error');
              navigate('/dashboard');
            }}
          />
        );
      case '/users':
        return (
          <UsersPage
            currentUser={userProfile}
            onUnauthorizedRedirect={(reason) => {
              showToast(reason, 'error');
              navigate('/dashboard');
            }}
          />
        );
      case '/settings/ical':
      case '/settings':
        return (
          <SettingsIcalPage
            currentUser={userProfile}
            onUnauthorizedRedirect={(reason) => {
              showToast(reason, 'error');
              navigate('/dashboard');
            }}
          />
        );
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="h-screen h-dvh max-h-screen max-h-dvh flex flex-col font-sans text-slate-900 bg-slate-100 overflow-hidden relative">
      {/* Global Toast for Route Guards and Notifications */}
      {globalToast && (
        <div
          className={cn(
            'fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2',
            globalToast.type === 'error' && 'bg-rose-950 border-rose-800 text-rose-100',
            globalToast.type === 'success' && 'bg-slate-900 border-slate-800 text-white',
            globalToast.type === 'warning' && 'bg-amber-950 border-amber-800 text-amber-100'
          )}
        >
          {globalToast.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />}
          {globalToast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {globalToast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="text-xs font-medium">{globalToast.message}</span>
        </div>
      )}

      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          id="mobile-drawer-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden animate-in fade-in transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        <Sidebar
          currentPath={activeRoute}
          onNavigate={(path) => {
            setIsMobileMenuOpen(false);
            navigate(path);
          }}
          onSignOut={handleSignOut}
          userEmail={userProfile.email}
          userName={userProfile.fullName}
          userRole={userProfile.role}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto bg-slate-50 relative">
          <Header
            currentPath={activeRoute}
            onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          />
          <div className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 min-h-0">
            {renderRouteContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;

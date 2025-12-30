import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarState } from '@/hooks/useSidebarState';
import { Sidebar } from './Sidebar';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Layout() {
  const { user, loading } = useAuth();
  const { collapsed } = useSidebarState();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={cn(
        "min-h-screen transition-all duration-300",
        collapsed ? "ml-16" : "ml-64"
      )}>
        <Outlet />
      </main>
    </div>
  );
}

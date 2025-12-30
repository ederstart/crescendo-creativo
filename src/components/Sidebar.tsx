import { NavLink } from 'react-router-dom';
import { 
  Play, 
  FileText, 
  Image, 
  Link2, 
  Settings, 
  LogOut,
  Home,
  Plus,
  Sparkles,
  Subtitles,
  Volume2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarState } from '@/hooks/useSidebarState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Roteiros', path: '/scripts' },
  { icon: Sparkles, label: 'AI Studio', path: '/ai-studio' },
  { icon: Volume2, label: 'Voice Generator', path: '/voice-generator' },
  { icon: Subtitles, label: 'Legendas', path: '/subtitles' },
  { icon: Image, label: 'Mood Boards', path: '/mood-boards' },
  { icon: Link2, label: 'Thumbnails', path: '/thumbnails' },
];

export function Sidebar() {
  const { signOut, user } = useAuth();
  const { collapsed, toggle } = useSidebarState();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="absolute -right-3 top-8 z-10 h-6 w-6 rounded-full border border-border bg-card hover:bg-muted"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Logo */}
      <div className={cn("p-6 border-b border-border", collapsed && "p-3")}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "gradient-fire rounded-xl flex items-center justify-center flex-shrink-0",
            collapsed ? "w-9 h-9" : "w-10 h-10"
          )}>
            <Play className={cn("text-primary-foreground fill-current", collapsed ? "w-4 h-4" : "w-5 h-5")} />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display font-bold text-foreground">CRESCER</h1>
              <span className="text-xs text-gradient-fire font-semibold">YOUTUBE</span>
            </div>
          )}
        </div>
      </div>

      {/* New Project Button */}
      <div className={cn("p-4", collapsed && "p-2")}>
        <Button variant="fire" className={cn("w-full", collapsed && "px-0")} asChild>
          <NavLink to="/scripts/new">
            <Plus className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Novo Roteiro</span>}
          </NavLink>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className={cn("p-4 border-t border-border", collapsed && "p-2")}>
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        )}
        <div className={cn("flex gap-2", collapsed && "flex-col")}>
          <Button variant="ghost" size="sm" className={cn("flex-1", collapsed && "w-full")} asChild>
            <NavLink to="/settings" title={collapsed ? "Configurações" : undefined}>
              <Settings className="w-4 h-4" />
            </NavLink>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("flex-1 text-destructive hover:text-destructive", collapsed && "w-full")}
            onClick={() => signOut()}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

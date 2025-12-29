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
  Volume2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-fire rounded-xl flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground fill-current" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground">CRESCER</h1>
            <span className="text-xs text-gradient-fire font-semibold">YOUTUBE</span>
          </div>
        </div>
      </div>

      {/* New Project Button */}
      <div className="p-4">
        <Button variant="fire" className="w-full" asChild>
          <NavLink to="/scripts/new">
            <Plus className="w-4 h-4" />
            Novo Roteiro
          </NavLink>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
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
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
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
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" asChild>
            <NavLink to="/settings">
              <Settings className="w-4 h-4" />
            </NavLink>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

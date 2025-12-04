import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Image, 
  TrendingUp, 
  Clock,
  Plus,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Stats {
  totalScripts: number;
  totalMoodBoards: number;
  completedScripts: number;
  inProgressScripts: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalScripts: 0,
    totalMoodBoards: 0,
    completedScripts: 0,
    inProgressScripts: 0,
  });
  const [recentScripts, setRecentScripts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchStats();
      fetchRecentScripts();
    }
  }, [user]);

  const fetchStats = async () => {
    // Fetch scripts count
    const { count: scriptsCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    const { count: completedCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .eq('status', 'completed');

    const { count: inProgressCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id)
      .eq('status', 'in_progress');

    const { count: moodBoardsCount } = await supabase
      .from('mood_boards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id);

    setStats({
      totalScripts: scriptsCount || 0,
      totalMoodBoards: moodBoardsCount || 0,
      completedScripts: completedCount || 0,
      inProgressScripts: inProgressCount || 0,
    });
  };

  const fetchRecentScripts = async () => {
    const { data } = await supabase
      .from('scripts')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    setRecentScripts(data || []);
  };

  const statCards = [
    { 
      icon: FileText, 
      label: 'Total de Roteiros', 
      value: stats.totalScripts,
      color: 'text-primary'
    },
    { 
      icon: TrendingUp, 
      label: 'Concluídos', 
      value: stats.completedScripts,
      color: 'text-green-500'
    },
    { 
      icon: Clock, 
      label: 'Em Progresso', 
      value: stats.inProgressScripts,
      color: 'text-secondary'
    },
    { 
      icon: Image, 
      label: 'Mood Boards', 
      value: stats.totalMoodBoards,
      color: 'text-purple-500'
    },
  ];

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Olá, <span className="text-gradient-fire">Criador</span>!
        </h1>
        <p className="text-muted-foreground">
          Acompanhe seu progresso e gerencie seus projetos
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-xl p-6 shadow-card hover:shadow-glow transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass rounded-xl p-6 shadow-card">
          <h2 className="text-xl font-display font-semibold text-foreground mb-4">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="fire" asChild>
              <Link to="/scripts/new">
                <Plus className="w-4 h-4" />
                Novo Roteiro
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/mood-boards/new">
                <Plus className="w-4 h-4" />
                Novo Mood Board
              </Link>
            </Button>
          </div>
        </div>

        <div className="glass rounded-xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Roteiros Recentes
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/scripts">
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
          {recentScripts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum roteiro ainda. Crie seu primeiro!
            </p>
          ) : (
            <ul className="space-y-2">
              {recentScripts.map((script) => (
                <li key={script.id}>
                  <Link
                    to={`/scripts/${script.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <FileText className="w-5 h-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {script.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(script.updated_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      script.status === 'completed' 
                        ? 'bg-green-500/20 text-green-500'
                        : script.status === 'in_progress'
                        ? 'bg-secondary/20 text-secondary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {script.status === 'completed' ? 'Concluído' : 
                       script.status === 'in_progress' ? 'Em progresso' : 'Rascunho'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Script {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export default function Scripts() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchScripts();
    }
  }, [user]);

  const fetchScripts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar roteiros');
    } else {
      setScripts(data || []);
    }
    setLoading(false);
  };

  const deleteScript = async (id: string) => {
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir roteiro');
    } else {
      toast.success('Roteiro excluído');
      fetchScripts();
    }
  };

  const filteredScripts = scripts.filter((script) =>
    script.title.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-500/20 text-green-500',
      in_progress: 'bg-secondary/20 text-secondary',
      draft: 'bg-muted text-muted-foreground',
    };
    const labels = {
      completed: 'Concluído',
      in_progress: 'Em progresso',
      draft: 'Rascunho',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Roteiros
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus roteiros de vídeo
          </p>
        </div>
        <Button variant="fire" asChild>
          <Link to="/scripts/new">
            <Plus className="w-4 h-4" />
            Novo Roteiro
          </Link>
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar roteiros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {/* Scripts Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : filteredScripts.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum roteiro encontrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Crie seu primeiro roteiro para começar
          </p>
          <Button variant="fire" asChild>
            <Link to="/scripts/new">
              <Plus className="w-4 h-4" />
              Criar Roteiro
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScripts.map((script) => (
            <div
              key={script.id}
              className="glass rounded-xl p-6 shadow-card hover:shadow-glow transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 gradient-fire rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/scripts/${script.id}`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteScript(script.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Link to={`/scripts/${script.id}`}>
                <h3 className="text-lg font-semibold text-foreground mb-2 hover:text-primary transition-colors">
                  {script.title}
                </h3>
              </Link>
              
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {script.content || 'Sem conteúdo ainda...'}
              </p>

              <div className="flex items-center justify-between">
                {getStatusBadge(script.status)}
                <span className="text-xs text-muted-foreground">
                  {new Date(script.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

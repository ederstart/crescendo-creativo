import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Image, 
  Plus, 
  Search,
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

interface MoodBoard {
  id: string;
  name: string;
  type: 'thumbnail' | 'general';
  created_at: string;
  updated_at: string;
}

export default function MoodBoards() {
  const { user } = useAuth();
  const [moodBoards, setMoodBoards] = useState<MoodBoard[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMoodBoards();
    }
  }, [user]);

  const fetchMoodBoards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mood_boards')
      .select('*')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar mood boards');
    } else {
      setMoodBoards(data || []);
    }
    setLoading(false);
  };

  const createMoodBoard = async (type: 'thumbnail' | 'general') => {
    const { data, error } = await supabase
      .from('mood_boards')
      .insert({
        user_id: user?.id,
        name: type === 'thumbnail' ? 'Novo Board de Thumbnails' : 'Novo Mood Board',
        type,
        project_id: null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar mood board');
    } else {
      toast.success('Mood board criado!');
      setMoodBoards([data, ...moodBoards]);
    }
  };

  const deleteMoodBoard = async (id: string) => {
    const { error } = await supabase
      .from('mood_boards')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir mood board');
    } else {
      toast.success('Mood board excluído');
      fetchMoodBoards();
    }
  };

  const filteredBoards = moodBoards.filter((board) =>
    board.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Mood Boards
          </h1>
          <p className="text-muted-foreground">
            Organize suas referências visuais estilo PureRef
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => createMoodBoard('thumbnail')}>
            <Plus className="w-4 h-4" />
            Board de Thumbnails
          </Button>
          <Button variant="fire" onClick={() => createMoodBoard('general')}>
            <Plus className="w-4 h-4" />
            Novo Mood Board
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Buscar mood boards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted border-border"
        />
      </div>

      {/* Mood Boards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhum mood board encontrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Crie seu primeiro mood board para começar
          </p>
          <Button variant="fire" onClick={() => createMoodBoard('general')}>
            <Plus className="w-4 h-4" />
            Criar Mood Board
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((board) => (
            <div
              key={board.id}
              className="glass rounded-xl overflow-hidden shadow-card hover:shadow-glow transition-all group"
            >
              {/* Preview Area */}
              <div className="h-40 mood-canvas bg-muted flex items-center justify-center">
                <Image className="w-12 h-12 text-muted-foreground/50" />
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Link to={`/mood-boards/${board.id}`}>
                    <h3 className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
                      {board.name}
                    </h3>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/mood-boards/${board.id}`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMoodBoard(board.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    board.type === 'thumbnail'
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {board.type === 'thumbnail' ? 'Thumbnails' : 'Geral'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(board.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

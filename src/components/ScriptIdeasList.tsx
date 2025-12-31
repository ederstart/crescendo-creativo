import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Trash2, 
  Sparkles,
  CheckCircle2,
  Circle,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ScriptIdea {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
}

export function ScriptIdeasList() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<ScriptIdea[]>([]);
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);

  useEffect(() => {
    if (user) {
      fetchIdeas();
    }
  }, [user]);

  const fetchIdeas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('script_ideas')
      .select('*')
      .eq('user_id', user?.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ideas:', error);
    } else {
      setIdeas(data || []);
    }
    setLoading(false);
  };

  const addIdea = async () => {
    if (!newIdea.trim() || !user) return;

    // Check if batch mode - multiple lines
    const lines = newIdea.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length > 1) {
      // Batch insert
      const inserts = lines.map((title, index) => ({
        user_id: user.id,
        title,
        priority: ideas.length + index,
      }));

      const { data, error } = await supabase
        .from('script_ideas')
        .insert(inserts)
        .select();

      if (error) {
        toast.error('Erro ao adicionar ideias');
      } else {
        setIdeas(prev => [...(data || []).reverse(), ...prev]);
        setNewIdea('');
        setBatchMode(false);
        toast.success(`${lines.length} ideias adicionadas!`);
      }
    } else {
      // Single insert
      const { data, error } = await supabase
        .from('script_ideas')
        .insert({
          user_id: user.id,
          title: newIdea.trim(),
          priority: ideas.length,
        })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao adicionar ideia');
      } else {
        setIdeas(prev => [data, ...prev]);
        setNewIdea('');
        toast.success('Ideia adicionada!');
      }
    }
  };

  const deleteIdea = async (id: string) => {
    const { error } = await supabase
      .from('script_ideas')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir ideia');
    } else {
      setIdeas(prev => prev.filter(i => i.id !== id));
      toast.success('Ideia excluída');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' 
      ? 'in_progress' 
      : currentStatus === 'in_progress' 
        ? 'done' 
        : 'pending';

    const { error } = await supabase
      .from('script_ideas')
      .update({ status: nextStatus })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      setIdeas(prev => prev.map(i => 
        i.id === id ? { ...i, status: nextStatus as ScriptIdea['status'] } : i
      ));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-secondary" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Concluído';
      case 'in_progress':
        return 'Em progresso';
      default:
        return 'Pendente';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add new idea */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            variant={batchMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setBatchMode(!batchMode)}
          >
            {batchMode ? "Modo Único" : "Adicionar em Lote"}
          </Button>
        </div>
        {batchMode ? (
          <div className="space-y-2">
            <Textarea
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Cole várias ideias (uma por linha)..."
              rows={5}
              className="w-full"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {newIdea.split('\n').filter(l => l.trim()).length} ideias
              </span>
              <Button onClick={addIdea} variant="fire">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Todas
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Nova ideia de roteiro..."
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
              className="flex-1"
            />
            <Button onClick={addIdea} variant="fire">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Nenhuma ideia ainda
          </h3>
          <p className="text-muted-foreground">
            Adicione títulos para seus próximos vídeos
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className={`glass rounded-lg p-4 flex items-center gap-4 group ${
                idea.status === 'done' ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggleStatus(idea.id, idea.status)}
                className="flex-shrink-0 hover:scale-110 transition-transform"
                title={getStatusLabel(idea.status)}
              >
                {getStatusIcon(idea.status)}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`font-medium text-foreground ${
                  idea.status === 'done' ? 'line-through' : ''
                }`}>
                  {idea.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(idea.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="secondary"
                  asChild
                >
                  <Link to={`/ai-studio?title=${encodeURIComponent(idea.title)}`}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Criar Roteiro
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteIdea(idea.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

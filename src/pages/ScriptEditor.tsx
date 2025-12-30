import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Link2, 
  Plus, 
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSave } from '@/hooks/useAutoSave';
import { toast } from 'sonner';

interface Reference {
  id: string;
  url: string;
  title: string | null;
  notes: string | null;
}

interface Script {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'in_progress' | 'completed';
  project_id: string;
}

export default function ScriptEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'new';

  const [script, setScript] = useState<Script>({
    id: '',
    title: '',
    content: '',
    status: 'draft',
    project_id: '',
  });
  const [references, setReferences] = useState<Reference[]>([]);
  const [newRefUrl, setNewRefUrl] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveScript = useCallback(async (data: Script) => {
    if (!user || !data.title) return;

    try {
      if (isNew || !data.id) {
        // Create new script
        const { data: newScript, error } = await supabase
          .from('scripts')
          .insert({
            user_id: user.id,
            title: data.title,
            content: data.content,
            status: data.status,
            project_id: data.project_id || null,
          })
          .select()
          .single();

        if (error) throw error;
        
        setScript(prev => ({ ...prev, id: newScript.id }));
        navigate(`/scripts/${newScript.id}`, { replace: true });
      } else {
        // Update existing script
        const { error } = await supabase
          .from('scripts')
          .update({
            title: data.title,
            content: data.content,
            status: data.status,
          })
          .eq('id', data.id);

        if (error) throw error;
      }
      
      setLastSaved(new Date());
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  }, [user, isNew, navigate]);

  // Auto-save with 15 second debounce
  useAutoSave(script, saveScript, 15000);

  useEffect(() => {
    if (!isNew && id && user) {
      fetchScript();
      fetchReferences();
    }
  }, [id, user, isNew]);

  const fetchScript = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Roteiro não encontrado');
      navigate('/scripts');
    } else {
      setScript(data);
    }
    setLoading(false);
  };

  const fetchReferences = async () => {
    const { data } = await supabase
      .from('video_references')
      .select('*')
      .eq('script_id', id)
      .order('created_at', { ascending: false });

    setReferences(data || []);
  };

  const addReference = async () => {
    if (!newRefUrl || !script.id || !user) return;

    const { data, error } = await supabase
      .from('video_references')
      .insert({
        script_id: script.id,
        user_id: user.id,
        url: newRefUrl,
        title: 'Referência',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar referência');
    } else {
      setReferences([data, ...references]);
      setNewRefUrl('');
      toast.success('Referência adicionada');
    }
  };

  const deleteReference = async (refId: string) => {
    const { error } = await supabase
      .from('video_references')
      .delete()
      .eq('id', refId);

    if (error) {
      toast.error('Erro ao excluir referência');
    } else {
      setReferences(references.filter(r => r.id !== refId));
      toast.success('Referência excluída');
    }
  };

  const handleManualSave = () => {
    saveScript(script);
    toast.success('Salvo!');
  };

  const handleAutomation = () => {
    if (!script.id || !script.content) {
      toast.error('Salve o roteiro primeiro para automatizar');
      return;
    }
    navigate(`/ai-studio?automate=true&scriptId=${script.id}`);
    toast.info('Iniciando automação...');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-10 glass border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/scripts">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                value={script.title}
                onChange={(e) => setScript({ ...script, title: e.target.value })}
                placeholder="Título do roteiro..."
                className="text-xl font-display font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0 w-full"
              />
              {lastSaved && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Salvo às {lastSaved.toLocaleTimeString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={script.status}
              onValueChange={(value: any) => setScript({ ...script, status: value })}
            >
              <SelectTrigger className="w-40 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Rascunho
                  </span>
                </SelectItem>
                <SelectItem value="in_progress">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    Em progresso
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Concluído
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button variant="fire" onClick={handleManualSave}>
              <Save className="w-4 h-4" />
              Salvar
            </Button>
            <Button variant="secondary" onClick={handleAutomation} disabled={!script.id || !script.content}>
              <Zap className="w-4 h-4" />
              Automatizar
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Editor */}
        <div className="flex-1 p-8">
          <Textarea
            value={script.content}
            onChange={(e) => setScript({ ...script, content: e.target.value })}
            placeholder="Comece a escrever seu roteiro aqui...

Dicas de formatação:
• Use **texto** para destacar palavras importantes
• Use # para títulos e ## para subtítulos
• Organize seu roteiro em seções claras

Exemplo de estrutura:
# Introdução
Gancho inicial para prender a atenção...

## Desenvolvimento
Conteúdo principal do vídeo...

## Conclusão
Call to action e despedida..."
            className="min-h-[calc(100vh-200px)] bg-card border-border text-foreground resize-none text-base leading-relaxed font-sans"
          />
        </div>

        {/* References Sidebar */}
        <aside className="w-80 border-l border-border p-6 bg-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Referências
          </h3>

          {/* Add Reference */}
          <div className="flex gap-2 mb-4">
            <Input
              value={newRefUrl}
              onChange={(e) => setNewRefUrl(e.target.value)}
              placeholder="Cole o link aqui..."
              className="bg-muted border-border text-sm"
            />
            <Button 
              variant="secondary" 
              size="icon"
              onClick={addReference}
              disabled={!newRefUrl || !script.id}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* References List */}
          <div className="space-y-3">
            {references.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Adicione links de vídeos de referência
              </p>
            ) : (
              references.map((ref) => (
                <div
                  key={ref.id}
                  className="p-3 bg-muted rounded-lg group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-foreground truncate flex-1">
                      {ref.title || 'Referência'}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(ref.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => deleteReference(ref.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {ref.url}
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

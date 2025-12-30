import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, MoreVertical, Trash2, Edit, X, Copy, Eye, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ScriptIdeasList } from '@/components/ScriptIdeasList';

interface Script {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

interface ScriptsProps {
  selectionMode?: boolean;
  onSelectionChange?: (scripts: Script[]) => void;
}

export default function Scripts({ selectionMode = false, onSelectionChange }: ScriptsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Hide completed by default
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['draft', 'in_progress']));
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { if (user) fetchScripts(); }, [user]);

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(scripts.filter(s => selectedIds.has(s.id)));
  }, [selectedIds, scripts, onSelectionChange]);

  const fetchScripts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('scripts').select('*').eq('user_id', user?.id).order('updated_at', { ascending: false });
    if (error) toast.error('Erro ao carregar roteiros');
    else setScripts(data || []);
    setLoading(false);
  };

  const deleteScript = async (id: string) => {
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir roteiro');
    else { toast.success('Roteiro excluído'); setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; }); fetchScripts(); }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Excluir ${selectedIds.size} roteiros?`)) return;
    const { error } = await supabase.from('scripts').delete().in('id', Array.from(selectedIds));
    if (error) toast.error('Erro ao excluir roteiros');
    else { toast.success(`${selectedIds.size} roteiros excluídos!`); setSelectedIds(new Set()); fetchScripts(); }
  };

  const copyScriptContent = (script: Script) => {
    if (!script.content) { toast.error('Roteiro sem conteúdo'); return; }
    navigator.clipboard.writeText(script.content);
    toast.success('Roteiro copiado!');
  };

  const handleAutomation = (script: Script) => {
    if (!script.content) {
      toast.error('Roteiro sem conteúdo para automatizar');
      return;
    }
    navigate(`/ai-studio?automate=true&scriptId=${script.id}`);
    toast.info('Iniciando automação... Aguarde.');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleAllSelection = () => {
    setSelectedIds(selectedIds.size === filteredScripts.length ? new Set() : new Set(filteredScripts.map(s => s.id)));
  };

  const showAllStatuses = () => {
    setStatusFilter(new Set(['draft', 'in_progress', 'completed']));
  };

  const filteredScripts = scripts.filter((script) => {
    const matchesSearch = script.title.toLowerCase().includes(search.toLowerCase()) || (script.content && script.content.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && statusFilter.has(script.status);
  });

  const getStatusBadge = (status: string) => {
    const styles = { completed: 'bg-green-500/20 text-green-500', in_progress: 'bg-secondary/20 text-secondary', draft: 'bg-muted text-muted-foreground' };
    const labels = { completed: 'Concluído', in_progress: 'Em progresso', draft: 'Rascunho' };
    return <span className={`text-xs px-2 py-1 rounded-full ${styles[status as keyof typeof styles]}`}>{labels[status as keyof typeof labels]}</span>;
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Roteiros</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie seus roteiros de vídeo</p>
        </div>
        <Button variant="fire" asChild><Link to="/scripts/new"><Plus className="w-4 h-4" />Novo Roteiro</Link></Button>
      </div>

      <Tabs defaultValue="scripts" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="scripts">Roteiros</TabsTrigger>
          <TabsTrigger value="ideas">Ideias</TabsTrigger>
        </TabsList>

        <TabsContent value="ideas"><ScriptIdeasList /></TabsContent>

        <TabsContent value="scripts" className="space-y-4 md:space-y-6">
          {selectedIds.size > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-sm font-medium">{selectedIds.size} roteiro(s) selecionado(s)</span>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}><X className="w-4 h-4 mr-1" />Limpar</Button>
                <Button variant="fire" size="sm" asChild><Link to="/subtitles" state={{ selectedScripts: scripts.filter(s => selectedIds.has(s.id)) }}><FileText className="w-4 h-4 mr-1" />Gerar SRT</Link></Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Buscar roteiros..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-muted border-border" />
            </div>
            <div className="flex gap-2">
              {!statusFilter.has('completed') && (
                <Button variant="outline" size="sm" onClick={showAllStatuses}>
                  <Eye className="w-4 h-4 mr-2" />Exibir Todos
                </Button>
              )}
              <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
                <DropdownMenuTrigger asChild><Button variant="outline"><Filter className="w-4 h-4 mr-2" />Filtros</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {['draft', 'in_progress', 'completed'].map(status => (
                    <DropdownMenuCheckboxItem key={status} checked={statusFilter.has(status)} onCheckedChange={() => setStatusFilter(prev => { const next = new Set(prev); next.has(status) ? next.delete(status) : next.add(status); return next; })}>
                      {status === 'draft' ? 'Rascunho' : status === 'in_progress' ? 'Em progresso' : 'Concluído'}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={showAllStatuses}>Mostrar todos</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Carregando...</p></div>
          ) : filteredScripts.length === 0 ? (
            <div className="text-center py-12 glass rounded-xl">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum roteiro encontrado</h3>
              <p className="text-muted-foreground mb-4">{search || statusFilter.size < 3 ? 'Tente ajustar seus filtros' : 'Crie seu primeiro roteiro'}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Checkbox checked={selectedIds.size === filteredScripts.length && filteredScripts.length > 0} onCheckedChange={toggleAllSelection} />
                <span className="text-sm text-muted-foreground">Selecionar todos ({filteredScripts.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredScripts.map((script) => (
                  <div key={script.id} className={`glass rounded-xl p-4 md:p-6 shadow-card hover:shadow-glow transition-all group ${selectedIds.has(script.id) ? 'ring-2 ring-primary' : ''}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={selectedIds.has(script.id)} onCheckedChange={() => toggleSelection(script.id)} />
                        <div className="w-10 h-10 gradient-fire rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-primary-foreground" /></div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyScriptContent(script)}><Copy className="w-4 h-4 mr-2" />Copiar</DropdownMenuItem>
                          <DropdownMenuItem asChild><Link to={`/scripts/${script.id}`}><Edit className="w-4 h-4 mr-2" />Editar</Link></DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAutomation(script)}><Zap className="w-4 h-4 mr-2" />Automatizar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteScript(script.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Link to={`/scripts/${script.id}`} className="block group/title">
                      <h3 className="text-lg font-semibold mb-2 hover:text-primary transition-colors overflow-hidden">
                        <span className="block whitespace-nowrap group-hover/title:animate-marquee">{script.title}</span>
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{script.content || 'Sem conteúdo ainda...'}</p>
                    <div className="flex items-center justify-between">{getStatusBadge(script.status)}<span className="text-xs text-muted-foreground">{new Date(script.updated_at).toLocaleDateString('pt-BR')}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

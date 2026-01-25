import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  StopCircle, 
  Trash2, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Plus,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { useScriptQueue, QueueItem } from '@/hooks/useScriptQueue';
import type { ScriptIdea } from '@/hooks/useScriptIdeas';
import { cn } from '@/lib/utils';

interface BatchScriptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredModel?: string;
  systemPrompt?: string;
  scriptIdeas?: ScriptIdea[];
  onScriptSaved?: (scriptId: string) => void;
}

export function BatchScriptGenerator({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'deepseek',
  systemPrompt,
  scriptIdeas = [],
  onScriptSaved,
}: BatchScriptGeneratorProps) {
  const {
    queue,
    loading,
    isProcessing,
    progress,
    addToQueue,
    removeFromQueue,
    removeMultiple,
    clearCompleted,
    processQueue,
    stopProcessing,
    retryFailed,
    saveAsScript,
    saveMultipleAsScripts,
    pendingCount,
    completedCount,
    failedCount,
  } = useScriptQueue({
    groqApiKey,
    geminiApiKey,
    openrouterApiKey,
    preferredModel,
    systemPrompt,
  });

  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
  const [manualTitles, setManualTitles] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<QueueItem | null>(null);

  // Filter ideas that aren't already in queue or completed
  const queuedIdeaIds = new Set(queue.filter(q => q.idea_id).map(q => q.idea_id));
  const availableIdeas = scriptIdeas.filter(
    idea => idea.status !== 'done' && !queuedIdeaIds.has(idea.id)
  );

  const toggleIdeaSelection = (id: string) => {
    setSelectedIdeaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleQueueSelection = (id: string) => {
    setSelectedQueueIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllIdeas = () => {
    setSelectedIdeaIds(new Set(availableIdeas.map(i => i.id)));
  };

  const deselectAllIdeas = () => {
    setSelectedIdeaIds(new Set());
  };

  const selectAllQueue = () => {
    setSelectedQueueIds(new Set(queue.map(i => i.id)));
  };

  const deselectAllQueue = () => {
    setSelectedQueueIds(new Set());
  };

  const handleAddSelectedIdeas = async () => {
    if (selectedIdeaIds.size === 0) {
      toast.error('Selecione pelo menos uma ideia');
      return;
    }

    const ideasToAdd = scriptIdeas.filter(i => selectedIdeaIds.has(i.id));
    await addToQueue(ideasToAdd.map(idea => ({
      title: idea.title,
      ideaId: idea.id,
    })));

    setSelectedIdeaIds(new Set());
  };

  const handleAddManualTitles = async () => {
    const titles = manualTitles
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (titles.length === 0) {
      toast.error('Adicione pelo menos um título');
      return;
    }

    await addToQueue(titles.map(title => ({ title })));
    setManualTitles('');
  };

  const handleDeleteSelected = async () => {
    if (selectedQueueIds.size === 0) return;
    if (!confirm(`Excluir ${selectedQueueIds.size} item(ns)?`)) return;

    await removeMultiple(Array.from(selectedQueueIds));
    setSelectedQueueIds(new Set());
  };

  const handleSaveSelected = async () => {
    const selectedItems = queue.filter(
      i => selectedQueueIds.has(i.id) && i.status === 'completed' && i.generated_content
    );
    
    if (selectedItems.length === 0) {
      toast.error('Nenhum roteiro completo selecionado');
      return;
    }

    const count = await saveMultipleAsScripts(selectedItems);
    if (count > 0) {
      // Remove saved items from queue
      await removeMultiple(selectedItems.map(i => i.id));
      setSelectedQueueIds(new Set());
    }
  };

  const handleSaveOne = async (item: QueueItem) => {
    const scriptId = await saveAsScript(item);
    if (scriptId) {
      await removeFromQueue(item.id);
      onScriptSaved?.(scriptId);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      case 'processing':
        return 'Processando...';
      default:
        return 'Pendente';
    }
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Conteúdo copiado!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ideas Selection */}
      {availableIdeas.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <Label className="font-medium">Selecionar Ideias ({availableIdeas.length} disponíveis)</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllIdeas}>
                  Selecionar Todas
                </Button>
                {selectedIdeaIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={deselectAllIdeas}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            
            <ScrollArea className="h-40 border rounded-lg p-2">
              <div className="space-y-1">
                {availableIdeas.map(idea => (
                  <div
                    key={idea.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
                      selectedIdeaIds.has(idea.id) && "bg-primary/10"
                    )}
                    onClick={() => toggleIdeaSelection(idea.id)}
                  >
                    <Checkbox
                      checked={selectedIdeaIds.has(idea.id)}
                      onCheckedChange={() => toggleIdeaSelection(idea.id)}
                    />
                    <span className="flex-1 text-sm">{idea.title}</span>
                    {idea.status === 'in_progress' && (
                      <span className="text-xs text-yellow-500">Em progresso</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedIdeaIds.size > 0 && (
              <Button onClick={handleAddSelectedIdeas} className="w-full" variant="secondary">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar {selectedIdeaIds.size} Ideia(s) à Fila
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Title Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Adicionar Títulos Manualmente (um por linha)</Label>
          <Textarea
            value={manualTitles}
            onChange={(e) => setManualTitles(e.target.value)}
            placeholder="Cole títulos aqui, um por linha..."
            rows={3}
          />
          {manualTitles.trim() && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {manualTitles.split('\n').filter(t => t.trim()).length} título(s)
              </span>
              <Button onClick={handleAddManualTitles} size="sm" variant="secondary">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar à Fila
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Stats & Controls */}
      {queue.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {pendingCount} pendentes
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {completedCount} concluídos
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-4 h-4 text-destructive" />
                {failedCount} falhas
              </span>
            </div>

            {/* Progress */}
            {progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processando...</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <Progress value={(progress.current / progress.total) * 100} />
              </div>
            )}

            {/* Main Actions */}
            <div className="flex flex-wrap gap-2">
              {!isProcessing ? (
                <Button 
                  onClick={processQueue} 
                  disabled={pendingCount === 0}
                  variant="fire"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Processar Fila ({pendingCount})
                </Button>
              ) : (
                <Button onClick={stopProcessing} variant="destructive">
                  <StopCircle className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              )}

              {failedCount > 0 && (
                <Button onClick={retryFailed} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Tentar Novamente ({failedCount})
                </Button>
              )}

              {completedCount > 0 && (
                <Button onClick={clearCompleted} variant="ghost">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar Concluídos
                </Button>
              )}
            </div>

            {/* Selection Actions */}
            {selectedQueueIds.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                <span className="text-sm font-medium">{selectedQueueIds.size} selecionado(s)</span>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={deselectAllQueue}>
                  Limpar
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleSaveSelected}
                  disabled={queue.filter(i => selectedQueueIds.has(i.id) && i.status === 'completed').length === 0}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Queue List */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              checked={selectedQueueIds.size === queue.length && queue.length > 0}
              onCheckedChange={(checked) => checked ? selectAllQueue() : deselectAllQueue()}
            />
            <span className="text-xs text-muted-foreground">
              Selecionar todos ({queue.length})
            </span>
          </div>

          {queue.map((item) => (
            <Card 
              key={item.id}
              className={cn(
                "transition-colors",
                selectedQueueIds.has(item.id) && "ring-2 ring-primary",
                item.status === 'processing' && "border-primary"
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedQueueIds.has(item.id)}
                    onCheckedChange={() => toggleQueueSelection(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  {getStatusIcon(item.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {getStatusLabel(item.status)}
                      {item.error_message && (
                        <span className="text-destructive ml-2">- {item.error_message}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    {item.status === 'completed' && item.generated_content && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewingContent(item)}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyContent(item.generated_content!)}
                          title="Copiar"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSaveOne(item)}
                          title="Salvar como roteiro"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Salvar
                        </Button>
                      </>
                    )}
                    
                    {item.status !== 'processing' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFromQueue(item.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {queue.length === 0 && availableIdeas.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum item na fila</p>
          <p className="text-sm">Adicione títulos manualmente ou crie ideias na aba "Ideias"</p>
        </div>
      )}

      {/* Content Viewer Dialog */}
      <Dialog open={!!viewingContent} onOpenChange={() => setViewingContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewingContent?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="whitespace-pre-wrap text-sm font-mono">
              {viewingContent?.generated_content}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline"
              onClick={() => viewingContent && copyContent(viewingContent.generated_content!)}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar
            </Button>
            <Button 
              variant="fire"
              onClick={() => viewingContent && handleSaveOne(viewingContent)}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar como Roteiro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

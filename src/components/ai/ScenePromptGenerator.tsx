import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wand2, Copy, Check, Star, FileText, Eye, EyeOff, Sparkles, Images, Trash2, StopCircle, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ScenePrompt {
  number: number;
  prompt: string;
  scriptExcerpt?: string;
}

interface Script {
  id: string;
  title: string;
  content: string;
  status?: string;
}

interface SavedScenePrompts {
  id: string;
  script_id: string;
  script_title: string;
  prompts: ScenePrompt[];
  style_prompt: string | null;
  created_at: string;
}

type AIModel = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

interface ScenePromptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  defaultStylePrompt?: string;
  preferredModel?: string;
  onPromptsGenerated: (prompts: ScenePrompt[]) => void;
  onFavoriteModel?: (model: string) => void;
  onApplyPrompt?: (prompt: string) => void;
  onApplyAllPrompts?: (prompts: string[]) => void;
  // Automation props
  autoSelectScriptId?: string | null;
  autoStart?: boolean;
  onAutomationComplete?: () => void;
}

const BATCH_SIZE = 30;

export function ScenePromptGenerator({
  defaultStylePrompt = '',
  preferredModel = 'groq',
  onPromptsGenerated,
  onFavoriteModel,
  onApplyPrompt,
  onApplyAllPrompts,
  autoSelectScriptId,
  autoStart,
  onAutomationComplete,
}: ScenePromptGeneratorProps) {
  const { user } = useAuth();
  const [model, setModel] = useState<AIModel>(preferredModel as AIModel);
  
  // Persist splitMode
  const [splitMode, setSplitMode] = useState<'scenes' | 'characters'>(() => {
    return (localStorage.getItem('scene-split-mode') as 'scenes' | 'characters') || 'characters';
  });
  
  // Persist numberOfScenes
  const [numberOfScenes, setNumberOfScenes] = useState(() => {
    return parseInt(localStorage.getItem('scene-number-of-scenes') || '5');
  });
  
  // Persist charactersPerScene
  const [charactersPerScene, setCharactersPerScene] = useState(() => {
    return parseInt(localStorage.getItem('scene-chars-per-scene') || '130');
  });
  
  const [stylePrompt, setStylePrompt] = useState(defaultStylePrompt);
  const [loading, setLoading] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<ScenePrompt[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Stop button ref
  const stopGenerationRef = React.useRef(false);
  
  // Batch progress tracking
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [batchProgress, setBatchProgress] = useState(0);
  
  // Script selection
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Saved scene prompts
  const [savedScenePrompts, setSavedScenePrompts] = useState<SavedScenePrompts[]>([]);
  const [showSavedPrompts, setShowSavedPrompts] = useState(false);

  // Persist values to localStorage
  useEffect(() => {
    localStorage.setItem('scene-split-mode', splitMode);
  }, [splitMode]);

  useEffect(() => {
    localStorage.setItem('scene-number-of-scenes', numberOfScenes.toString());
  }, [numberOfScenes]);

  useEffect(() => {
    localStorage.setItem('scene-chars-per-scene', charactersPerScene.toString());
  }, [charactersPerScene]);

  // Update model when preferredModel changes
  useEffect(() => {
    if (preferredModel && ['groq', 'gemini', 'qwen', 'deepseek', 'llama'].includes(preferredModel)) {
      setModel(preferredModel as AIModel);
    }
  }, [preferredModel]);

  // Fetch user scripts
  useEffect(() => {
    if (user) {
      fetchScripts();
      fetchSavedScenePrompts();
    }
  }, [user, showCompleted]);

  // Handle automation: auto-select script when provided
  useEffect(() => {
    if (autoSelectScriptId && scripts.length > 0 && !selectedScriptId) {
      const scriptExists = scripts.find(s => s.id === autoSelectScriptId);
      if (scriptExists) {
        setSelectedScriptId(autoSelectScriptId);
      }
    }
  }, [autoSelectScriptId, scripts, selectedScriptId]);

  // Handle automation: auto-start generation when script is selected
  const autoStartTriggeredRef = React.useRef(false);

  const fetchScripts = async () => {
    setLoadingScripts(true);
    
    let query = supabase
      .from('scripts')
      .select('id, title, content, status')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });
    
    if (!showCompleted) {
      query = query.neq('status', 'completed');
    }
    
    const { data, error } = await query;

    if (!error && data) {
      setScripts(data.filter(s => s.content && s.content.trim()));
    }
    setLoadingScripts(false);
  };

  const fetchSavedScenePrompts = async () => {
    const { data, error } = await supabase
      .from('generated_scene_prompts')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedScenePrompts(data);
    }
  };

  const saveScenePrompts = async (prompts: ScenePrompt[]) => {
    if (!user || !selectedScriptId) return;

    const script = scripts.find(s => s.id === selectedScriptId);
    if (!script) return;

    const { error } = await supabase
      .from('generated_scene_prompts')
      .insert({
        user_id: user.id,
        script_id: selectedScriptId,
        script_title: script.title,
        prompts: prompts,
        style_prompt: stylePrompt || null,
      });

    if (error) {
      console.error('Error saving scene prompts:', error);
    } else {
      fetchSavedScenePrompts();
    }
  };

  const deleteSavedPrompts = async (id: string) => {
    const { error } = await supabase
      .from('generated_scene_prompts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir');
    } else {
      setSavedScenePrompts(prev => prev.filter(p => p.id !== id));
      toast.success('Cenas excluídas');
    }
  };

  const loadSavedPrompts = (saved: SavedScenePrompts) => {
    setGeneratedPrompts(saved.prompts);
    if (saved.style_prompt) {
      setStylePrompt(saved.style_prompt);
    }
    onPromptsGenerated(saved.prompts);
    toast.success(`${saved.prompts.length} cenas carregadas`);
  };

  const selectedScript = scripts.find(s => s.id === selectedScriptId);
  const scriptContent = selectedScript?.content || '';

  // Calculate estimated scenes based on character mode
  const estimatedScenes = splitMode === 'characters' && scriptContent
    ? Math.ceil(scriptContent.length / charactersPerScene)
    : numberOfScenes;

  // Divide script into proportional parts for batch processing
  const divideScriptIntoParts = (content: string, numParts: number): string[] => {
    if (numParts <= 1) return [content];
    
    const paragraphs = content.split(/\n\n+/);
    const totalLength = content.length;
    const targetPartLength = Math.ceil(totalLength / numParts);
    
    const parts: string[] = [];
    let currentPart = '';
    let currentLength = 0;
    
    for (const paragraph of paragraphs) {
      if (currentLength + paragraph.length > targetPartLength && currentPart.length > 0 && parts.length < numParts - 1) {
        parts.push(currentPart.trim());
        currentPart = paragraph;
        currentLength = paragraph.length;
      } else {
        currentPart += (currentPart ? '\n\n' : '') + paragraph;
        currentLength += paragraph.length;
      }
    }
    
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  };

  // Extract script excerpts for each scene
  const extractScriptExcerpts = (content: string, numScenes: number): string[] => {
    const paragraphs = content.split(/\n+/).filter(p => p.trim());
    const excerpts: string[] = [];
    
    if (paragraphs.length >= numScenes) {
      const paragraphsPerScene = Math.ceil(paragraphs.length / numScenes);
      for (let i = 0; i < numScenes; i++) {
        const start = i * paragraphsPerScene;
        const end = Math.min(start + paragraphsPerScene, paragraphs.length);
        const excerpt = paragraphs.slice(start, end).join(' ').trim();
        excerpts.push(excerpt.length > 100 ? excerpt.substring(0, 100) + '...' : excerpt);
      }
    } else {
      const charsPerScene = Math.ceil(content.length / numScenes);
      for (let i = 0; i < numScenes; i++) {
        const start = i * charsPerScene;
        const end = Math.min(start + charsPerScene, content.length);
        const excerpt = content.substring(start, end).trim();
        excerpts.push(excerpt.length > 100 ? excerpt.substring(0, 100) + '...' : excerpt);
      }
    }
    
    return excerpts;
  };

  const handleStop = () => {
    stopGenerationRef.current = true;
    toast.info('Parando após o lote atual...');
  };

  const handleGenerate = async () => {
    if (!scriptContent.trim()) {
      toast.error('Selecione um roteiro primeiro');
      return;
    }

    setLoading(true);
    setGeneratedPrompts([]);
    setBatchProgress(0);
    setCurrentBatch(0);
    stopGenerationRef.current = false;

    try {
      const targetScenes = splitMode === 'characters' 
        ? Math.ceil(scriptContent.length / charactersPerScene)
        : numberOfScenes;

      if (targetScenes <= BATCH_SIZE) {
        const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
          body: {
            scriptContent,
            splitMode,
            numberOfScenes: targetScenes,
            charactersPerScene: splitMode === 'characters' ? charactersPerScene : undefined,
            model,
            stylePrompt: stylePrompt || undefined,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        const excerpts = extractScriptExcerpts(scriptContent, data.scenes.length);
        const scenesWithExcerpts = data.scenes.map((scene: ScenePrompt, idx: number) => ({
          ...scene,
          scriptExcerpt: excerpts[idx] || '',
        }));

        setGeneratedPrompts(scenesWithExcerpts);
        onPromptsGenerated(scenesWithExcerpts);
        await saveScenePrompts(scenesWithExcerpts);
        toast.success(`${scenesWithExcerpts.length} prompts de cenas gerados!`);
      } else {
        const numBatches = Math.ceil(targetScenes / BATCH_SIZE);
        setTotalBatches(numBatches);
        
        const scriptParts = divideScriptIntoParts(scriptContent, numBatches);
        
        const allScenes: ScenePrompt[] = [];
        let sceneNumberOffset = 0;
        
        for (let i = 0; i < scriptParts.length; i++) {
          if (stopGenerationRef.current) {
            toast.info(`Geração interrompida. ${allScenes.length} cenas geradas.`);
            break;
          }
          
          setCurrentBatch(i + 1);
          setBatchProgress(Math.round((i / scriptParts.length) * 100));
          
          const scenesInThisBatch = i === scriptParts.length - 1 
            ? targetScenes - (BATCH_SIZE * i) 
            : BATCH_SIZE;
          
          const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
            body: {
              scriptPart: scriptParts[i],
              splitMode: 'scenes',
              scenesPerBatch: Math.min(scenesInThisBatch, BATCH_SIZE),
              model,
              stylePrompt: stylePrompt || undefined,
              batchIndex: i,
              totalBatches: scriptParts.length,
            },
          });

          if (error) throw error;
          if (data.error) throw new Error(data.error);

          const batchExcerpts = extractScriptExcerpts(scriptParts[i], data.scenes.length);
          
          const renumberedScenes = data.scenes.map((scene: ScenePrompt, idx: number) => ({
            ...scene,
            number: sceneNumberOffset + idx + 1,
            scriptExcerpt: batchExcerpts[idx] || '',
          }));
          
          sceneNumberOffset += data.scenes.length;
          allScenes.push(...renumberedScenes);
          
          setGeneratedPrompts([...allScenes]);
          
          if (!stopGenerationRef.current && i < scriptParts.length - 1) {
            toast.info(`Aguardando 5 segundos antes do próximo lote...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        setBatchProgress(100);
        onPromptsGenerated(allScenes);
        await saveScenePrompts(allScenes);
        
        if (!stopGenerationRef.current) {
          toast.success(`${allScenes.length} prompts de cenas gerados em ${scriptParts.length} lotes!`);
        }
        
        // If automation mode, auto-apply all prompts to images
        if (autoStart && onApplyAllPrompts && !stopGenerationRef.current) {
          const allPrompts = allScenes.map(p => `Cena ${p.number}: ${p.prompt}`);
          setTimeout(() => {
            onApplyAllPrompts(allPrompts);
            onAutomationComplete?.();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error generating scene prompts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao gerar prompts: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCurrentBatch(0);
      setTotalBatches(0);
      stopGenerationRef.current = false;
    }
  };

  const copyPrompt = async (prompt: string, index: number) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedIndex(index);
    toast.success('Prompt copiado!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllPrompts = async () => {
    const allPrompts = generatedPrompts.map(p => `Cena ${p.number}: ${p.prompt}`).join('\n\n');
    await navigator.clipboard.writeText(allPrompts);
    toast.success('Todos os prompts copiados!');
  };

  const handleApplyAllPrompts = () => {
    if (generatedPrompts.length === 0) {
      toast.error('Nenhum prompt para aplicar');
      return;
    }
    const allPrompts = generatedPrompts.map(p => `Cena ${p.number}: ${p.prompt}`);
    onApplyAllPrompts?.(allPrompts);
    toast.success(`${allPrompts.length} prompts prontos para gerar imagens!`);
  };

  // Auto-start generation effect (must be after handleGenerate is defined)
  useEffect(() => {
    if (autoStart && autoSelectScriptId && selectedScriptId === autoSelectScriptId && !loading && !autoStartTriggeredRef.current) {
      const script = scripts.find(s => s.id === selectedScriptId);
      if (script?.content) {
        autoStartTriggeredRef.current = true;
        // Small delay to ensure UI is ready
        setTimeout(() => {
          handleGenerate();
        }, 500);
      }
    }
  }, [autoStart, autoSelectScriptId, selectedScriptId, scripts, loading]);

  const isFavorite = model === preferredModel;

  return (
    <div className="space-y-4">
      {/* Saved Scene Prompts */}
      {savedScenePrompts.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            onClick={() => setShowSavedPrompts(!showSavedPrompts)}
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Cenas Geradas Anteriormente ({savedScenePrompts.length})
            </span>
            {showSavedPrompts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          
          {showSavedPrompts && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {savedScenePrompts.map((saved) => (
                <div key={saved.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{saved.script_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {saved.prompts.length} cenas • {new Date(saved.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => loadSavedPrompts(saved)} title="Carregar">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="fire" 
                      onClick={() => {
                        const prompts = saved.prompts.map(p => `Cena ${p.number}: ${p.prompt}`);
                        onApplyAllPrompts?.(prompts);
                        toast.success('Prompts enviados para geração de imagens!');
                      }}
                      title="Gerar Imagens"
                    >
                      <Images className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSavedPrompts(saved.id)} className="text-destructive" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Script Selection */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Selecionar Roteiro</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-muted-foreground"
          >
            {showCompleted ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Ocultar Concluídos
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Exibir Todos
              </>
            )}
          </Button>
        </div>
        <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={loadingScripts ? "Carregando..." : "Escolha um roteiro salvo"} />
          </SelectTrigger>
          <SelectContent>
            {scripts.length === 0 ? (
              <SelectItem value="none" disabled>
                {showCompleted ? 'Nenhum roteiro salvo' : 'Nenhum roteiro em progresso'}
              </SelectItem>
            ) : (
              scripts.map((script) => (
                <SelectItem key={script.id} value={script.id}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{script.title}</span>
                    <span className="text-xs text-muted-foreground">
                      ({script.content?.length || 0} chars)
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {selectedScript && (
        <div className="bg-muted/50 rounded-lg p-3">
          <Label className="text-muted-foreground text-xs">Roteiro Selecionado</Label>
          <p className="text-sm font-medium mt-1">{selectedScript.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {scriptContent.substring(0, 200)}...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {scriptContent.length} caracteres
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Modelo de IA</Label>
          {onFavoriteModel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFavoriteModel(model)}
              className={isFavorite ? 'text-yellow-500' : 'text-muted-foreground'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
              {isFavorite ? 'Favorito' : 'Favoritar'}
            </Button>
          )}
        </div>
        <Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groq">
              <div className="flex items-center gap-2">
                <span>Groq (Llama 3.3)</span>
                {preferredModel === 'groq' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </div>
            </SelectItem>
            <SelectItem value="gemini">
              <div className="flex items-center gap-2">
                <span>Gemini 2.5 Flash</span>
                {preferredModel === 'gemini' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </div>
            </SelectItem>
            <SelectItem value="qwen">
              <div className="flex items-center gap-2">
                <span>Qwen3 (OpenRouter)</span>
                {preferredModel === 'qwen' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </div>
            </SelectItem>
            <SelectItem value="deepseek">
              <div className="flex items-center gap-2">
                <span>DeepSeek R1 (OpenRouter)</span>
                {preferredModel === 'deepseek' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </div>
            </SelectItem>
            <SelectItem value="llama">
              <div className="flex items-center gap-2">
                <span>Llama 3.3 70B (OpenRouter)</span>
                {preferredModel === 'llama' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Modo de Divisão</Label>
        <RadioGroup
          value={splitMode}
          onValueChange={(v) => setSplitMode(v as 'scenes' | 'characters')}
          className="flex gap-4"
        >
          {/* Por caracteres vem primeiro visualmente */}
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="characters" id="characters" />
            <Label htmlFor="characters" className="font-normal cursor-pointer">Por caracteres</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="scenes" id="scenes" />
            <Label htmlFor="scenes" className="font-normal cursor-pointer">Por número de cenas</Label>
          </div>
        </RadioGroup>
      </div>

      {splitMode === 'scenes' ? (
        <div>
          <Label>Número de Cenas</Label>
          <Input
            type="number"
            min={1}
            max={5000}
            value={numberOfScenes}
            onChange={(e) => setNumberOfScenes(parseInt(e.target.value) || 5)}
            className="mt-1"
          />
          {numberOfScenes > BATCH_SIZE && (
            <p className="text-xs text-muted-foreground mt-1">
              Será processado em {Math.ceil(numberOfScenes / BATCH_SIZE)} lotes de até {BATCH_SIZE} cenas
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label>Caracteres por Cena</Label>
          <Input
            type="number"
            min={100}
            max={5000}
            step={10}
            value={charactersPerScene}
            onChange={(e) => setCharactersPerScene(parseInt(e.target.value) || 130)}
            className="mt-1"
          />
          {scriptContent && (
            <p className="text-xs text-muted-foreground mt-1">
              Estimativa: ~{estimatedScenes} cenas para {scriptContent.length} caracteres
              {estimatedScenes > BATCH_SIZE && ` (${Math.ceil(estimatedScenes / BATCH_SIZE)} lotes)`}
            </p>
          )}
        </div>
      )}

      <div>
        <Label>Estilo Visual / Instruções (do Template)</Label>
        <Textarea
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          placeholder="Ex: Ilustração digital estilo anime, cores vibrantes, personagem principal tem cabelos azuis..."
          rows={3}
          className="mt-1 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Descreva o estilo visual, características dos personagens e qualquer instrução específica
        </p>
      </div>

      {/* Progress indicator for batch processing */}
      {loading && totalBatches > 1 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processando lote {currentBatch} de {totalBatches}</span>
            <span>{batchProgress}%</span>
          </div>
          <Progress value={batchProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {generatedPrompts.length} cenas geradas até agora...
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={loading || !scriptContent}
          className="flex-1"
          variant="fire"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {totalBatches > 1 ? `Gerando... (${currentBatch}/${totalBatches})` : 'Gerando Prompts...'}
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Gerar {splitMode === 'characters' ? `~${estimatedScenes}` : numberOfScenes} Prompts
            </>
          )}
        </Button>
        
        {loading && (
          <Button variant="destructive" onClick={handleStop}>
            <StopCircle className="w-4 h-4 mr-2" />
            Parar
          </Button>
        )}
      </div>

      {generatedPrompts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-medium text-foreground">Prompts Gerados ({generatedPrompts.length})</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={copyAllPrompts}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Todos
              </Button>
              {onApplyAllPrompts && (
                <Button size="sm" variant="fire" onClick={handleApplyAllPrompts}>
                  <Images className="w-4 h-4 mr-2" />
                  Gerar Todas Imagens
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {generatedPrompts.map((scene, index) => (
              <div key={index} className="bg-muted rounded-lg p-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      CENA {scene.number}:
                    </p>
                    {scene.scriptExcerpt && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {scene.scriptExcerpt}
                      </p>
                    )}
                    <p className="text-sm text-foreground mt-2 font-mono break-all">
                      {scene.prompt}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyPrompt(scene.prompt, index)}
                      title="Copiar prompt"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    {onApplyPrompt && (
                      <Button
                        size="icon"
                        variant="fire"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onApplyPrompt(scene.prompt)}
                        title="Aplicar na geração de imagem"
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
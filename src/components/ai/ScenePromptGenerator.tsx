import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wand2, Copy, Check, Star, FileText, Eye, EyeOff, Sparkles } from 'lucide-react';
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

interface ScenePromptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  defaultStylePrompt?: string;
  preferredModel?: string;
  onPromptsGenerated: (prompts: ScenePrompt[]) => void;
  onFavoriteModel?: (model: string) => void;
  onApplyPrompt?: (prompt: string) => void;
}

const BATCH_SIZE = 30;

export function ScenePromptGenerator({
  defaultStylePrompt = '',
  preferredModel = 'groq',
  onPromptsGenerated,
  onFavoriteModel,
  onApplyPrompt,
}: ScenePromptGeneratorProps) {
  const { user } = useAuth();
  const [model, setModel] = useState<'groq' | 'gemini' | 'qwen'>(preferredModel as 'groq' | 'gemini' | 'qwen');
  const [splitMode, setSplitMode] = useState<'scenes' | 'characters'>('scenes');
  const [numberOfScenes, setNumberOfScenes] = useState(5);
  const [charactersPerScene, setCharactersPerScene] = useState(500);
  const [stylePrompt, setStylePrompt] = useState(defaultStylePrompt);
  const [loading, setLoading] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<ScenePrompt[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Batch progress tracking
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [batchProgress, setBatchProgress] = useState(0);
  
  // Script selection
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Update model when preferredModel changes
  useEffect(() => {
    if (preferredModel && ['groq', 'gemini', 'qwen'].includes(preferredModel)) {
      setModel(preferredModel as 'groq' | 'gemini' | 'qwen');
    }
  }, [preferredModel]);

  // Fetch user scripts
  useEffect(() => {
    if (user) {
      fetchScripts();
    }
  }, [user, showCompleted]);

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

  const handleGenerate = async () => {
    if (!scriptContent.trim()) {
      toast.error('Selecione um roteiro primeiro');
      return;
    }

    setLoading(true);
    setGeneratedPrompts([]);
    setBatchProgress(0);
    setCurrentBatch(0);

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
        toast.success(`${scenesWithExcerpts.length} prompts de cenas gerados!`);
      } else {
        const numBatches = Math.ceil(targetScenes / BATCH_SIZE);
        setTotalBatches(numBatches);
        
        const scriptParts = divideScriptIntoParts(scriptContent, numBatches);
        
        const allScenes: ScenePrompt[] = [];
        let sceneNumberOffset = 0;
        
        for (let i = 0; i < scriptParts.length; i++) {
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
          
          if (i < scriptParts.length - 1) {
            toast.info(`Aguardando 5 segundos antes do próximo lote...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
        
        setBatchProgress(100);
        onPromptsGenerated(allScenes);
        toast.success(`${allScenes.length} prompts de cenas gerados em ${scriptParts.length} lotes!`);
      }
    } catch (error) {
      console.error('Error generating scene prompts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao gerar prompts: ${errorMessage}`);
    } finally {
      setLoading(false);
      setCurrentBatch(0);
      setTotalBatches(0);
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

  const isFavorite = model === preferredModel;

  return (
    <div className="space-y-4">
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
        <Select value={model} onValueChange={(v) => setModel(v as 'groq' | 'gemini' | 'qwen')}>
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
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="scenes" id="scenes" />
            <Label htmlFor="scenes" className="font-normal cursor-pointer">Por número de cenas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="characters" id="characters" />
            <Label htmlFor="characters" className="font-normal cursor-pointer">Por caracteres</Label>
          </div>
        </RadioGroup>
      </div>

      {splitMode === 'scenes' ? (
        <div>
          <Label>Número de Cenas</Label>
          <Input
            type="number"
            min={1}
            max={500}
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
            step={100}
            value={charactersPerScene}
            onChange={(e) => setCharactersPerScene(parseInt(e.target.value) || 500)}
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

      <Button
        onClick={handleGenerate}
        disabled={loading || !scriptContent}
        className="w-full"
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
            Gerar {splitMode === 'characters' ? `~${estimatedScenes}` : numberOfScenes} Prompts de Cenas
          </>
        )}
      </Button>

      {generatedPrompts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Prompts Gerados ({generatedPrompts.length})</h4>
            <Button size="sm" variant="secondary" onClick={copyAllPrompts}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar Todos
            </Button>
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

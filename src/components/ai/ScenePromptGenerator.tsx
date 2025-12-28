import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Wand2, Copy, Check, Star, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ScenePrompt {
  number: number;
  description: string;
  prompt: string;
}

interface Script {
  id: string;
  title: string;
  content: string;
}

interface ScenePromptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  defaultStylePrompt?: string;
  preferredModel?: string;
  onPromptsGenerated: (prompts: ScenePrompt[]) => void;
  onFavoriteModel?: (model: string) => void;
}

export function ScenePromptGenerator({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  defaultStylePrompt = '',
  preferredModel = 'groq',
  onPromptsGenerated,
  onFavoriteModel,
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
  
  // Script selection
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [loadingScripts, setLoadingScripts] = useState(true);

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
  }, [user]);

  const fetchScripts = async () => {
    setLoadingScripts(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('id, title, content')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });

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

  const handleGenerate = async () => {
    if (!scriptContent.trim()) {
      toast.error('Selecione um roteiro primeiro');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
        body: {
          scriptContent,
          splitMode,
          numberOfScenes: splitMode === 'scenes' ? numberOfScenes : undefined,
          charactersPerScene: splitMode === 'characters' ? charactersPerScene : undefined,
          model,
          stylePrompt: stylePrompt || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setGeneratedPrompts(data.scenes);
      onPromptsGenerated(data.scenes);
      toast.success('Prompts de cenas gerados!');
    } catch (error) {
      console.error('Error generating scene prompts:', error);
      toast.error('Erro ao gerar prompts de cenas');
    } finally {
      setLoading(false);
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
        <Label>Selecionar Roteiro</Label>
        <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={loadingScripts ? "Carregando..." : "Escolha um roteiro salvo"} />
          </SelectTrigger>
          <SelectContent>
            {scripts.length === 0 ? (
              <SelectItem value="none" disabled>
                Nenhum roteiro salvo
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
            max={50}
            value={numberOfScenes}
            onChange={(e) => setNumberOfScenes(parseInt(e.target.value) || 5)}
            className="mt-1"
          />
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

      <Button
        onClick={handleGenerate}
        disabled={loading || !scriptContent}
        className="w-full"
        variant="fire"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Gerando Prompts...
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
                      Cena {scene.number}: {scene.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                      {scene.prompt}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyPrompt(scene.prompt, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
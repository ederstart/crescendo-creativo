import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ScenePrompt {
  number: number;
  description: string;
  prompt: string;
}

interface ScenePromptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  scriptContent: string;
  defaultStylePrompt?: string;
  onPromptsGenerated: (prompts: ScenePrompt[]) => void;
}

export function ScenePromptGenerator({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  scriptContent,
  defaultStylePrompt = '',
  onPromptsGenerated,
}: ScenePromptGeneratorProps) {
  const [model, setModel] = useState<'groq' | 'gemini' | 'qwen'>('groq');
  const [numberOfScenes, setNumberOfScenes] = useState(5);
  const [stylePrompt, setStylePrompt] = useState(defaultStylePrompt);
  const [loading, setLoading] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<ScenePrompt[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!scriptContent.trim()) {
      toast.error('Primeiro gere ou cole um roteiro na aba anterior');
      return;
    }

    const apiKey = model === 'groq' ? groqApiKey : model === 'gemini' ? geminiApiKey : openrouterApiKey;
    if (!apiKey) {
      const modelName = model === 'groq' ? 'Groq' : model === 'gemini' ? 'Gemini' : 'OpenRouter (Qwen)';
      toast.error(`Configure a API key do ${modelName} nas configurações`);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
        body: {
          scriptContent,
          numberOfScenes,
          model,
          apiKey,
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

  const getApiKey = (m: string) => {
    if (m === 'groq') return groqApiKey;
    if (m === 'gemini') return geminiApiKey;
    return openrouterApiKey;
  };

  const hasApiKey = !!getApiKey(model);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Modelo de IA</Label>
          <Select value={model} onValueChange={(v) => setModel(v as 'groq' | 'gemini' | 'qwen')}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="groq">Groq (Llama 3.3)</SelectItem>
              <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
              <SelectItem value="qwen">Qwen3 (OpenRouter)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Número de Cenas</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={numberOfScenes}
            onChange={(e) => setNumberOfScenes(parseInt(e.target.value) || 5)}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label>Estilo Visual Base (opcional)</Label>
        <Textarea
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          placeholder="Ex: Ilustração digital estilo anime, cores vibrantes, iluminação dramática..."
          rows={2}
          className="mt-1 font-mono text-sm"
        />
      </div>

      {scriptContent ? (
        <div className="bg-muted/50 rounded-lg p-3">
          <Label className="text-muted-foreground text-xs">Roteiro Anexado</Label>
          <p className="text-sm mt-1 line-clamp-3">{scriptContent.substring(0, 200)}...</p>
        </div>
      ) : (
        <div className="bg-destructive/10 rounded-lg p-3 text-center">
          <p className="text-sm text-destructive">Gere um roteiro primeiro na aba "Roteiro"</p>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={loading || !hasApiKey || !scriptContent}
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
            Gerar Prompts de Cenas
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
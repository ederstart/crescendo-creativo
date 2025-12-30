import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Upload, FileText, X, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type ModelType = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

interface ScriptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  templateContent?: string;
  preferredModel?: string;
  onGenerated: (content: string, model: string) => void;
  onFavoriteModel?: (model: string) => void;
}

export function ScriptGenerator({ 
  groqApiKey, 
  geminiApiKey,
  openrouterApiKey,
  templateContent = '',
  preferredModel = 'deepseek',
  onGenerated,
  onFavoriteModel,
}: ScriptGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelType>(
    (preferredModel as ModelType) || 'deepseek'
  );

  // When template content is set, prepend it to the prompt
  useEffect(() => {
    if (templateContent) {
      setPrompt(prev => {
        if (!prev.includes(templateContent)) {
          return templateContent + (prev ? '\n\n' + prev : '');
        }
        return prev;
      });
    }
  }, [templateContent]);

  const [loading, setLoading] = useState(false);
  const [attachedContent, setAttachedContent] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update model when preferredModel changes
  useEffect(() => {
    if (preferredModel && ['groq', 'gemini', 'qwen', 'deepseek', 'llama'].includes(preferredModel)) {
      setModel(preferredModel as ModelType);
    }
  }, [preferredModel]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Apenas arquivos .txt ou .doc/.docx são suportados');
      return;
    }

    try {
      const text = await file.text();
      setAttachedContent(text);
      setAttachedFileName(file.name);
      toast.success('Arquivo anexado!');
    } catch (error) {
      toast.error('Erro ao ler arquivo');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Digite um pedido');
      return;
    }

    // Check API key for models that need it
    const apiKey = getApiKey(model);
    if (!apiKey) {
      const modelNames: Record<ModelType, string> = {
        groq: 'Groq',
        gemini: 'Gemini',
        qwen: 'OpenRouter',
        deepseek: 'OpenRouter',
        llama: 'OpenRouter',
      };
      toast.error(`Configure a API key do ${modelNames[model]} nas configurações`);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt,
          model,
          apiKey,
          attachedContent: attachedContent || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onGenerated(data.generatedText, data.model);
      toast.success('Roteiro gerado com sucesso!');
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error('Erro ao gerar roteiro');
    } finally {
      setLoading(false);
    }
  };

  const getApiKey = (m: ModelType): string | undefined => {
    if (m === 'groq') return groqApiKey;
    if (m === 'gemini') return geminiApiKey;
    // Free OpenRouter models all use openrouterApiKey
    if (['qwen', 'deepseek', 'llama'].includes(m)) return openrouterApiKey;
    return undefined;
  };

  const hasApiKey = !!getApiKey(model);
  const isFavorite = model === preferredModel;

  return (
    <div className="space-y-4">
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
        <Select value={model} onValueChange={(v) => setModel(v as ModelType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Free OpenRouter Models */}
            <SelectItem value="deepseek">
              <div className="flex items-center gap-2">
                <span>DeepSeek R1 (Raciocínio)</span>
                {preferredModel === 'deepseek' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                <span className="text-xs text-green-500">100% Grátis</span>
              </div>
            </SelectItem>
            <SelectItem value="llama">
              <div className="flex items-center gap-2">
                <span>Llama 3.3 70B (Português)</span>
                {preferredModel === 'llama' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                <span className="text-xs text-green-500">100% Grátis</span>
              </div>
            </SelectItem>
            <SelectItem value="qwen">
              <div className="flex items-center gap-2">
                <span>Qwen3 Coder</span>
                {preferredModel === 'qwen' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                <span className="text-xs text-green-500">100% Grátis</span>
              </div>
            </SelectItem>
            {/* API Key Models */}
            <SelectItem value="groq">
              <div className="flex items-center gap-2">
                <span>Groq (Llama 3.3 70B)</span>
                {preferredModel === 'groq' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                {!groqApiKey && <span className="text-xs text-destructive">Sem API Key</span>}
              </div>
            </SelectItem>
            <SelectItem value="gemini">
              <div className="flex items-center gap-2">
                <span>Gemini 2.5 Flash</span>
                {preferredModel === 'gemini' && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                {!geminiApiKey && <span className="text-xs text-destructive">Sem API Key</span>}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        {!openrouterApiKey && ['deepseek', 'llama', 'qwen'].includes(model) && (
          <p className="text-xs text-muted-foreground mt-1">
            Crie uma API key gratuita em{' '}
            <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              openrouter.ai
            </a>
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Conteúdo de Referência (opcional)</Label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.doc,.docx"
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Anexar Arquivo
          </Button>
        </div>
        
        {attachedFileName ? (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground flex-1">{attachedFileName}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setAttachedContent('');
                setAttachedFileName('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Textarea
            value={attachedContent}
            onChange={(e) => setAttachedContent(e.target.value)}
            placeholder="Cole aqui o conteúdo que a IA deve usar como referência, ou anexe um arquivo..."
            rows={3}
            className="font-mono text-sm"
          />
        )}
      </div>

      <div>
        <Label>Seu Pedido</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: Crie um roteiro para um vídeo sobre como começar a investir em ações..."
          rows={4}
          className="mt-1"
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading || !hasApiKey}
        className="w-full"
        variant="fire"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Roteiro
          </>
        )}
      </Button>

      {!hasApiKey && (
        <p className="text-sm text-destructive text-center">
          Configure a API Key nas configurações
        </p>
      )}
    </div>
  );
}

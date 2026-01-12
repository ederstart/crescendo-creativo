import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Copy, Save, Star, FileText, StopCircle, Settings2, Trash2, Undo2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AIModel = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

interface TranscriptionToScriptProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredModel?: string;
  onComplete?: (script: string, title: string) => void;
  onFavoriteModel?: (model: string) => void;
}

const DEFAULT_TRANSCRIPTION_PROMPT = `Você é um roteirista profissional. Sua tarefa é transformar a transcrição abaixo em um roteiro de vídeo profissional.

REGRAS OBRIGATÓRIAS:
- Mantenha as informações e ideias principais da transcrição
- Reorganize o conteúdo de forma lógica e fluida
- Melhore a linguagem para ser mais engajante
- Adicione ganchos e transições entre partes
- NÃO use marcadores como #, *, /, ---, travessões decorativos
- Texto deve ser limpo, apenas com quebras de linha normais
- Mantenha o tom e estilo do conteúdo original`;

const STORAGE_KEY_TRANSCRIPTION = 'transcription_input';
const STORAGE_KEY_RESULT = 'transcription_result';
const STORAGE_KEY_TITLE = 'transcription_title';

export function TranscriptionToScript({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: TranscriptionToScriptProps) {
  const { user } = useAuth();
  const { templates, loading: templatesLoading, createTemplate, refetch: refetchTemplates } = usePromptTemplates('transcription');
  
  const [model, setModel] = useState<AIModel>(preferredModel as AIModel);
  const [transcription, setTranscription] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_TRANSCRIPTION) || '';
  });
  const [result, setResult] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_RESULT) || '';
  });
  const [title, setTitle] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_TITLE) || '';
  });
  const [previousResult, setPreviousResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [promptTemplateName, setPromptTemplateName] = useState('');
  
  // Saved transcriptions
  const [savedTranscriptions, setSavedTranscriptions] = useState<Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
  }>>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  
  const stopRef = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRANSCRIPTION, transcription);
  }, [transcription]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RESULT, result);
  }, [result]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TITLE, title);
  }, [title]);

  // Load default template
  useEffect(() => {
    if (!templatesLoading && templates.length > 0 && !selectedTemplateId) {
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        setCustomPrompt(defaultTemplate.content);
      }
    }
  }, [templates, templatesLoading, selectedTemplateId]);

  useEffect(() => {
    if (preferredModel && ['groq', 'gemini', 'qwen', 'deepseek', 'llama'].includes(preferredModel)) {
      setModel(preferredModel as AIModel);
    }
  }, [preferredModel]);

  useEffect(() => {
    if (user) fetchSavedTranscriptions();
  }, [user]);

  const fetchSavedTranscriptions = async () => {
    setLoadingSaved(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('id, title, content, created_at')
      .eq('user_id', user?.id)
      .eq('status', 'transcription')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedTranscriptions(data);
    }
    setLoadingSaved(false);
  };

  const getApiKey = (m: AIModel): string | undefined => {
    if (m === 'groq') return groqApiKey;
    if (m === 'gemini') return geminiApiKey;
    if (['qwen', 'deepseek', 'llama'].includes(m)) return openrouterApiKey;
    return undefined;
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/^#+\s*/gm, '')
      .replace(/^\*+\s*/gm, '')
      .replace(/^-+\s*/gm, '')
      .replace(/^\/+\s*/gm, '')
      .replace(/^—+\s*/gm, '')
      .replace(/^–+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/_{2,}/g, '')
      .replace(/-{3,}/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const generateScript = async () => {
    if (!transcription.trim()) {
      toast.error('Cole a transcrição primeiro');
      return;
    }

    const apiKey = getApiKey(model);
    if (!apiKey) {
      toast.error('Configure a API Key nas configurações');
      return;
    }

    setIsGenerating(true);
    stopRef.current = false;

    try {
      const systemPrompt = customPrompt.trim() || DEFAULT_TRANSCRIPTION_PROMPT;

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: `Transforme esta transcrição em um roteiro profissional:\n\n${transcription}`,
          model,
          apiKey,
          systemPrompt,
        },
      });

      if (stopRef.current) {
        toast.info('Geração interrompida');
        return;
      }

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const cleanedText = cleanText(data.generatedText);
      setResult(cleanedText);
      toast.success(`Roteiro gerado! (${cleanedText.length} caracteres)`);
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error('Erro ao gerar roteiro');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    setIsGenerating(false);
  };

  const savePromptTemplate = async () => {
    if (!promptTemplateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }
    
    const newTemplate = await createTemplate({
      name: promptTemplateName,
      type: 'transcription',
      content: customPrompt || DEFAULT_TRANSCRIPTION_PROMPT,
      is_default: templates.length === 0,
    });
    
    if (newTemplate) {
      setSelectedTemplateId(newTemplate.id);
      await refetchTemplates();
    }
    
    setPromptTemplateName('');
    toast.success('Template salvo!');
  };

  const saveAsTranscription = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!title.trim()) {
      toast.error('Digite um título');
      return;
    }

    if (!transcription.trim()) {
      toast.error('Adicione uma transcrição');
      return;
    }

    try {
      const { error } = await supabase
        .from('scripts')
        .insert({
          user_id: user.id,
          title: title,
          content: transcription,
          status: 'transcription',
        });

      if (error) throw error;

      toast.success('Transcrição salva!');
      fetchSavedTranscriptions();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const loadTranscription = (saved: typeof savedTranscriptions[0]) => {
    setTitle(saved.title);
    setTranscription(saved.content);
    toast.success('Transcrição carregada');
  };

  const deleteTranscription = async (id: string) => {
    if (!confirm('Excluir esta transcrição?')) return;
    
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', id);

    if (!error) {
      toast.success('Transcrição excluída');
      fetchSavedTranscriptions();
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success('Roteiro copiado!');
  };

  const clearResult = () => {
    setPreviousResult(result);
    setResult('');
    toast.success('Resultado limpo. Clique em Desfazer para recuperar.');
  };

  const undoResult = () => {
    if (previousResult) {
      setResult(previousResult);
      setPreviousResult(null);
      toast.success('Resultado restaurado!');
    }
  };

  const saveAsScript = () => {
    if (!result.trim()) return;
    onComplete?.(result, title || 'Roteiro de Transcrição');
  };

  const hasApiKey = !!getApiKey(model);
  const isFavorite = model === preferredModel;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label>Título</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do conteúdo..."
          className="mt-1"
        />
      </div>

      {/* Saved Transcriptions */}
      {savedTranscriptions.length > 0 && (
        <div>
          <Label>Transcrições Salvas</Label>
          <div className="mt-1 max-h-[120px] overflow-y-auto space-y-1">
            {savedTranscriptions.map((saved) => (
              <div key={saved.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <button
                  onClick={() => loadTranscription(saved)}
                  className="text-left flex-1 hover:text-primary truncate"
                >
                  {saved.title}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTranscription(saved.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcription Input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Transcrição</Label>
          <span className="text-xs text-muted-foreground">
            {transcription.length.toLocaleString()} caracteres
          </span>
        </div>
        <Textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Cole aqui a transcrição do vídeo/áudio..."
          className="min-h-[150px]"
        />
        <div className="flex gap-2 mt-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={saveAsTranscription}
            disabled={!title.trim() || !transcription.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Transcrição
          </Button>
        </div>
      </div>

      {/* Custom Prompt Settings */}
      <Collapsible open={showPromptSettings} onOpenChange={setShowPromptSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Personalizar Prompt
            </span>
            <span className="text-xs text-muted-foreground">
              {customPrompt ? 'Customizado' : 'Padrão'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 mt-2">
          <div>
            <Label>Prompt de Conversão (opcional)</Label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={DEFAULT_TRANSCRIPTION_PROMPT}
              className="mt-1 min-h-[150px] text-xs"
            />
          </div>
          
          <div>
            <Label>Templates Salvos {templatesLoading && '(carregando...)'}</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={(id) => {
                const t = templates.find(t => t.id === id);
                if (t) {
                  setSelectedTemplateId(id);
                  setCustomPrompt(t.content);
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={templates.length === 0 ? "Nenhum template salvo" : "Selecione um template..."} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default && '⭐'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Nome do template..."
              value={promptTemplateName}
              onChange={(e) => setPromptTemplateName(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={savePromptTemplate}>
              Salvar Template
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* AI Model Selection */}
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
            <SelectItem value="deepseek">DeepSeek R1</SelectItem>
            <SelectItem value="llama">Llama 3.3 70B</SelectItem>
            <SelectItem value="qwen">Qwen3</SelectItem>
            <SelectItem value="groq">Groq (Llama 3.3)</SelectItem>
            <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Generate Button */}
      <div className="flex gap-2">
        {isGenerating ? (
          <Button variant="destructive" className="flex-1" onClick={handleStop}>
            <StopCircle className="w-4 h-4 mr-2" />
            Parar
          </Button>
        ) : (
          <Button 
            variant="fire" 
            className="flex-1" 
            onClick={generateScript}
            disabled={!hasApiKey || !transcription.trim()}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Transformar em Roteiro
          </Button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label>Resultado</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copyResult}>
                <Copy className="w-4 h-4" />
              </Button>
              {previousResult && (
                <Button variant="ghost" size="sm" onClick={undoResult}>
                  <Undo2 className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearResult} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="min-h-[200px]"
          />
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {result.length.toLocaleString()} caracteres
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={generateScript} disabled={isGenerating}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar Novamente
              </Button>
              <Button variant="fire" size="sm" onClick={saveAsScript}>
                <Save className="w-4 h-4 mr-2" />
                Salvar como Roteiro
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasApiKey && (
        <p className="text-sm text-destructive text-center">
          Configure a API Key nas configurações
        </p>
      )}
    </div>
  );
}

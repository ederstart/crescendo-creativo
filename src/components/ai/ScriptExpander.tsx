import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Expand, Copy, Save, Star, FileText, StopCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Script {
  id: string;
  title: string;
  content: string;
  status?: string;
}

interface ScriptPart {
  index: number;
  original: string;
  expanded: string | null;
  isExpanding: boolean;
}

type AIModel = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

interface ScriptExpanderProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredModel?: string;
  onComplete?: (script: string, title: string) => void;
  onFavoriteModel?: (model: string) => void;
}

export function ScriptExpander({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: ScriptExpanderProps) {
  const { user } = useAuth();
  const [model, setModel] = useState<AIModel>(preferredModel as AIModel);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [parts, setParts] = useState<ScriptPart[]>([]);
  const [expandingAll, setExpandingAll] = useState(false);
  const [showExpanded, setShowExpanded] = useState<Set<number>>(new Set());
  
  const stopRef = useRef(false);

  useEffect(() => {
    if (preferredModel && ['groq', 'gemini', 'qwen', 'deepseek', 'llama'].includes(preferredModel)) {
      setModel(preferredModel as AIModel);
    }
  }, [preferredModel]);

  useEffect(() => {
    if (user) fetchScripts();
  }, [user]);

  const fetchScripts = async () => {
    setLoadingScripts(true);
    const { data, error } = await supabase
      .from('scripts')
      .select('id, title, content, status')
      .eq('user_id', user?.id)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setScripts(data.filter(s => s.content && s.content.trim()));
    }
    setLoadingScripts(false);
  };

  const getApiKey = (m: AIModel): string | undefined => {
    if (m === 'groq') return groqApiKey;
    if (m === 'gemini') return geminiApiKey;
    if (['qwen', 'deepseek', 'llama'].includes(m)) return openrouterApiKey;
    return undefined;
  };

  const selectedScript = scripts.find(s => s.id === selectedScriptId);

  // Divide script into parts (by paragraphs or scene markers)
  const divideIntoParts = (content: string): string[] => {
    // Try to find scene markers first
    const sceneMarkers = content.split(/(?=(?:CENA|Cena|Scene)\s*\d+[:.]?)/i);
    if (sceneMarkers.length > 1 && sceneMarkers[0].trim() === '') {
      sceneMarkers.shift();
    }
    
    if (sceneMarkers.length > 1) {
      return sceneMarkers.filter(p => p.trim());
    }
    
    // Otherwise, split by double newlines (paragraphs)
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    
    // Group small paragraphs together (target ~500 chars per part)
    const grouped: string[] = [];
    let current = '';
    
    for (const p of paragraphs) {
      if (current.length + p.length < 500) {
        current += (current ? '\n\n' : '') + p;
      } else {
        if (current) grouped.push(current);
        current = p;
      }
    }
    if (current) grouped.push(current);
    
    return grouped;
  };

  const handleSelectScript = (scriptId: string) => {
    setSelectedScriptId(scriptId);
    const script = scripts.find(s => s.id === scriptId);
    if (script) {
      const divided = divideIntoParts(script.content);
      setParts(divided.map((text, index) => ({
        index,
        original: text,
        expanded: null,
        isExpanding: false,
      })));
    }
  };

  const expandPart = async (index: number) => {
    const part = parts[index];
    if (!part || part.isExpanding) return;

    const apiKey = getApiKey(model);
    if (!apiKey) {
      toast.error('Configure a API Key nas configurações');
      return;
    }

    setParts(prev => prev.map((p, i) => 
      i === index ? { ...p, isExpanding: true } : p
    ));

    try {
      const systemPrompt = `Você é um roteirista profissional. Sua tarefa é EXPANDIR o trecho de roteiro abaixo, adicionando mais detalhes, descrições visuais, diálogos e emoção. 
      
REGRAS:
- Mantenha o estilo e tom do texto original
- Adicione descrições visuais detalhadas
- Expanda diálogos com mais naturalidade
- Inclua direções de câmera quando apropriado
- O texto expandido deve ter pelo menos o DOBRO do tamanho original
- NÃO adicione marcadores de cena novos, apenas expanda o conteúdo
- Mantenha a formatação consistente`;

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: `Expanda este trecho de roteiro:\n\n${part.original}`,
          model,
          apiKey,
          systemPrompt,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setParts(prev => prev.map((p, i) => 
        i === index ? { ...p, expanded: data.generatedText, isExpanding: false } : p
      ));
      
      setShowExpanded(prev => new Set([...prev, index]));
      toast.success(`Parte ${index + 1} expandida!`);
    } catch (error) {
      console.error('Error expanding part:', error);
      toast.error('Erro ao expandir');
      setParts(prev => prev.map((p, i) => 
        i === index ? { ...p, isExpanding: false } : p
      ));
    }
  };

  const expandAll = async () => {
    const apiKey = getApiKey(model);
    if (!apiKey) {
      toast.error('Configure a API Key nas configurações');
      return;
    }

    setExpandingAll(true);
    stopRef.current = false;

    for (let i = 0; i < parts.length; i++) {
      if (stopRef.current) {
        toast.info('Expansão interrompida');
        break;
      }
      
      if (!parts[i].expanded) {
        await expandPart(i);
        // Wait between requests
        if (i < parts.length - 1 && !stopRef.current) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    setExpandingAll(false);
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  const toggleShowExpanded = (index: number) => {
    setShowExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getFinalScript = (): string => {
    return parts.map(p => p.expanded || p.original).join('\n\n');
  };

  const copyFinalScript = () => {
    navigator.clipboard.writeText(getFinalScript());
    toast.success('Roteiro copiado!');
  };

  const saveFinalScript = () => {
    if (!selectedScript) return;
    const finalScript = getFinalScript();
    onComplete?.(finalScript, `${selectedScript.title} (Expandido)`);
  };

  const hasApiKey = !!getApiKey(model);
  const isFavorite = model === preferredModel;
  const expandedCount = parts.filter(p => p.expanded).length;

  return (
    <div className="space-y-4">
      <div>
        <Label>Selecionar Roteiro para Expandir</Label>
        <Select value={selectedScriptId} onValueChange={handleSelectScript}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={loadingScripts ? "Carregando..." : "Escolha um roteiro"} />
          </SelectTrigger>
          <SelectContent>
            {scripts.map((script) => (
              <SelectItem key={script.id} value={script.id}>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{script.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({script.content?.length || 0} chars)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      {parts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {parts.length} partes detectadas • {expandedCount} expandidas
            </p>
            <div className="flex gap-2">
              {expandingAll ? (
                <Button variant="destructive" size="sm" onClick={handleStop}>
                  <StopCircle className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              ) : (
                <Button 
                  variant="fire" 
                  size="sm" 
                  onClick={expandAll}
                  disabled={!hasApiKey || expandedCount === parts.length}
                >
                  <Expand className="w-4 h-4 mr-2" />
                  Expandir Tudo
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {parts.map((part, index) => (
              <div key={index} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Parte {index + 1}</span>
                  <div className="flex gap-2">
                    {part.expanded && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleShowExpanded(index)}
                      >
                        {showExpanded.has(index) ? (
                          <><ChevronUp className="w-4 h-4 mr-1" />Ocultar</>
                        ) : (
                          <><ChevronDown className="w-4 h-4 mr-1" />Ver Expandido</>
                        )}
                      </Button>
                    )}
                    <Button
                      variant={part.expanded ? "secondary" : "fire"}
                      size="sm"
                      onClick={() => expandPart(index)}
                      disabled={part.isExpanding || !hasApiKey}
                    >
                      {part.isExpanding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><Expand className="w-4 h-4 mr-1" />{part.expanded ? 'Re-expandir' : 'Expandir'}</>
                      )}
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  Original: {part.original.substring(0, 150)}...
                </p>
                
                {part.expanded && showExpanded.has(index) && (
                  <div className="mt-2 p-2 bg-background rounded border">
                    <p className="text-xs text-muted-foreground mb-1">Expandido:</p>
                    <p className="text-sm whitespace-pre-wrap">{part.expanded}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {expandedCount > 0 && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={copyFinalScript} className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copiar Roteiro Final
              </Button>
              <Button variant="fire" onClick={saveFinalScript} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Salvar como Novo Roteiro
              </Button>
            </div>
          )}
        </>
      )}

      {!hasApiKey && (
        <p className="text-sm text-destructive text-center">
          Configure a API Key nas configurações
        </p>
      )}
    </div>
  );
}

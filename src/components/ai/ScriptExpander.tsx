import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Expand, Copy, Save, Star, FileText, StopCircle, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

const DEFAULT_EXPANSION_PROMPT = `Você é um roteirista profissional. Sua tarefa é EXPANDIR o trecho de roteiro abaixo.

REGRAS OBRIGATÓRIAS:
- O texto expandido DEVE ter MAIS de {TARGET_CHARS} caracteres
- Mantenha o estilo e tom do texto original
- Adicione descrições visuais detalhadas
- Expanda diálogos com mais naturalidade
- Inclua direções de câmera quando apropriado
- NÃO use marcadores como #, *, /, ---, travessões decorativos
- Texto deve ser limpo, apenas com quebras de linha normais
- NÃO adicione marcadores de cena novos, apenas expanda o conteúdo
- Mantenha a formatação consistente e legível`;

export function ScriptExpander({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: ScriptExpanderProps) {
  const { user } = useAuth();
  const { templates, createTemplate, updateTemplate } = usePromptTemplates('expansion');
  
  const [model, setModel] = useState<AIModel>(preferredModel as AIModel);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState('');
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [parts, setParts] = useState<ScriptPart[]>([]);
  const [expandingAll, setExpandingAll] = useState(false);
  
  // User-controlled division
  const [numberOfParts, setNumberOfParts] = useState<number>(() => {
    return parseInt(localStorage.getItem('expander-num-parts') || '2');
  });
  const [targetCharsPerPart, setTargetCharsPerPart] = useState<number>(() => {
    return parseInt(localStorage.getItem('expander-target-chars') || '5000');
  });
  
  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [promptTemplateName, setPromptTemplateName] = useState('');
  
  const stopRef = useRef(false);

  // Load saved prompt template
  useEffect(() => {
    const defaultTemplate = templates.find(t => t.is_default);
    if (defaultTemplate) {
      setCustomPrompt(defaultTemplate.content);
    }
  }, [templates]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('expander-num-parts', numberOfParts.toString());
  }, [numberOfParts]);

  useEffect(() => {
    localStorage.setItem('expander-target-chars', targetCharsPerPart.toString());
  }, [targetCharsPerPart]);

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
      .neq('status', 'done') // Exclude completed scripts
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

  // Divide script into N equal parts
  const divideIntoParts = (content: string, numParts: number): string[] => {
    const cleanContent = content.trim();
    const partLength = Math.ceil(cleanContent.length / numParts);
    const result: string[] = [];
    
    for (let i = 0; i < numParts; i++) {
      const start = i * partLength;
      let end = start + partLength;
      
      // Try to find a natural break point (newline or period)
      if (end < cleanContent.length) {
        const searchStart = Math.max(end - 100, start);
        const searchEnd = Math.min(end + 100, cleanContent.length);
        const segment = cleanContent.substring(searchStart, searchEnd);
        
        // Find the best break point
        const newlinePos = segment.lastIndexOf('\n');
        const periodPos = segment.lastIndexOf('. ');
        
        if (newlinePos > 0) {
          end = searchStart + newlinePos + 1;
        } else if (periodPos > 0) {
          end = searchStart + periodPos + 2;
        }
      }
      
      result.push(cleanContent.substring(start, end).trim());
    }
    
    return result.filter(p => p.length > 0);
  };

  const handleSelectScript = (scriptId: string) => {
    setSelectedScriptId(scriptId);
    setParts([]); // Clear parts until user clicks divide
  };

  const handleDivideScript = () => {
    if (!selectedScript) return;
    
    const divided = divideIntoParts(selectedScript.content, numberOfParts);
    setParts(divided.map((text, index) => ({
      index,
      original: text,
      expanded: null,
      isExpanding: false,
    })));
    
    toast.success(`Roteiro dividido em ${divided.length} partes`);
  };

  const getEffectivePrompt = (): string => {
    const basePrompt = customPrompt.trim() || DEFAULT_EXPANSION_PROMPT;
    return basePrompt.replace('{TARGET_CHARS}', targetCharsPerPart.toString());
  };

  const cleanExpandedText = (text: string): string => {
    return text
      .replace(/^#+\s*/gm, '') // Remove # headers
      .replace(/^\*+\s*/gm, '') // Remove * bullets
      .replace(/^-+\s*/gm, '') // Remove - bullets
      .replace(/^\/+\s*/gm, '') // Remove / markers
      .replace(/^—+\s*/gm, '') // Remove em-dashes
      .replace(/^–+\s*/gm, '') // Remove en-dashes
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\*/g, '') // Remove italic markers
      .replace(/_{2,}/g, '') // Remove multiple underscores
      .replace(/-{3,}/g, '\n') // Replace horizontal rules with newline
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .trim();
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
      const systemPrompt = getEffectivePrompt();

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: `Expanda este trecho de roteiro para ter MAIS de ${targetCharsPerPart} caracteres:\n\n${part.original}`,
          model,
          apiKey,
          systemPrompt,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const cleanedText = cleanExpandedText(data.generatedText);

      setParts(prev => prev.map((p, i) => 
        i === index ? { ...p, expanded: cleanedText, isExpanding: false } : p
      ));
      
      toast.success(`Parte ${index + 1} expandida! (${cleanedText.length} chars)`);
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
    
    if (!stopRef.current) {
      toast.success('Todas as partes foram expandidas!');
    }
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  const savePromptTemplate = async () => {
    if (!promptTemplateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }
    
    await createTemplate({
      name: promptTemplateName,
      type: 'expansion',
      content: customPrompt || DEFAULT_EXPANSION_PROMPT,
      is_default: templates.length === 0,
    });
    
    setPromptTemplateName('');
    toast.success('Template salvo!');
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
  const totalOriginalChars = selectedScript?.content?.length || 0;
  const estimatedFinalChars = numberOfParts * targetCharsPerPart;

  return (
    <div className="space-y-4">
      {/* Script Selection */}
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
        {scripts.length === 0 && !loadingScripts && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhum roteiro disponível (roteiros concluídos são ocultados)
          </p>
        )}
      </div>

      {selectedScript && (
        <>
          {/* Division Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dividir em quantas partes?</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={numberOfParts}
                onChange={(e) => setNumberOfParts(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Atual: {totalOriginalChars} chars → ~{Math.ceil(totalOriginalChars / numberOfParts)} chars/parte
              </p>
            </div>
            <div>
              <Label>Caracteres por parte (meta)</Label>
              <Input
                type="number"
                min={500}
                step={500}
                value={targetCharsPerPart}
                onChange={(e) => setTargetCharsPerPart(Math.max(500, parseInt(e.target.value) || 500))}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Estimado final: ~{estimatedFinalChars.toLocaleString()} chars
              </p>
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
                <Label>Prompt de Expansão (opcional)</Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={DEFAULT_EXPANSION_PROMPT}
                  className="mt-1 min-h-[150px] text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{TARGET_CHARS}'} para inserir o número de caracteres alvo
                </p>
              </div>
              
              {templates.length > 0 && (
                <div>
                  <Label>Templates Salvos</Label>
                  <Select onValueChange={(id) => {
                    const t = templates.find(t => t.id === id);
                    if (t) setCustomPrompt(t.content);
                  }}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Carregar template..." />
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
              )}
              
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

          {/* Divide Button */}
          {parts.length === 0 && (
            <Button 
              variant="fire" 
              className="w-full" 
              onClick={handleDivideScript}
              disabled={!hasApiKey}
            >
              <Expand className="w-4 h-4 mr-2" />
              Dividir em {numberOfParts} partes
            </Button>
          )}
        </>
      )}

      {/* Parts List */}
      {parts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {parts.length} partes • {expandedCount} expandidas
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
                  Expandir Todas
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {parts.map((part, index) => (
              <div key={index} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Parte {index + 1} 
                    <span className="text-xs text-muted-foreground ml-2">
                      ({part.original.length} → {part.expanded ? part.expanded.length : `meta: ${targetCharsPerPart}`} chars)
                    </span>
                  </span>
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
                
                <div className="text-xs bg-background/50 rounded p-2 mb-2">
                  <span className="text-muted-foreground">Original: </span>
                  {part.original.substring(0, 200)}...
                </div>
                
                {part.expanded && (
                  <div className="text-xs bg-primary/10 rounded p-2 border-l-2 border-primary">
                    <span className="text-primary font-medium">Expandido: </span>
                    <div className="whitespace-pre-wrap mt-1 text-foreground">
                      {part.expanded}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Final Actions */}
          {expandedCount === parts.length && expandedCount > 0 && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={copyFinalScript} className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copiar Roteiro Final ({getFinalScript().length} chars)
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

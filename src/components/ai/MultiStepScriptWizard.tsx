import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronRight, ChevronLeft, Check, Star, Sparkles, RotateCcw, Save, FileText, Settings2, ChevronDown, ChevronUp, Wand2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import { useAuth } from '@/hooks/useAuth';

interface MultiStepScriptWizardProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredModel?: string;
  onComplete: (script: string, title: string) => void;
  onFavoriteModel?: (model: string) => void;
}

interface StepData {
  title: string;
  synopsis: string;
  parts: string;
  expandedParts: string[];
  finalScript: string;
}

const STEPS = [
  { id: 'title', label: 'Título', description: 'Defina o título do seu roteiro' },
  { id: 'synopsis', label: 'Sinopse', description: 'Sinopse opcional para contexto' },
  { id: 'parts', label: 'Estrutura', description: 'Defina as partes da história' },
  { id: 'expand', label: 'Expansão', description: 'Expanda cada parte com detalhes' },
  { id: 'save', label: 'Salvar', description: 'Revise e salve seu roteiro' },
];

const DEFAULT_MULTISTEP_TEMPLATE = `Você é um roteirista profissional de vídeos para YouTube.

DIRETRIZES GERAIS:
- Linguagem: Siga o idioma do título/prompt do usuário
- Estilo: Narrativo, dramático, com ganchos de retenção
- Formato: Use descrições visuais detalhadas e diálogos quando apropriado
- Objetivo: Máxima retenção do espectador

REGRAS DE EXPANSÃO:
- Cada parte deve ter NO MÍNIMO 10.000 caracteres
- Inclua descrições visuais detalhadas (cenário, iluminação, ângulos de câmera)
- Adicione diálogos realistas quando apropriado
- Use ganchos narrativos para manter interesse
- Mantenha consistência de personagens, nomes e eventos
- Siga estritamente a cronologia da história
- Não invente informações contraditórias com partes anteriores

ESTRUTURA DE CADA CENA:
1. Descrição do ambiente/cenário
2. Ação principal com detalhes visuais
3. Diálogos (se aplicável)
4. Transição para próxima cena

IMPORTANTE: Responda SEMPRE no mesmo idioma do título/prompt do usuário.`;

export function MultiStepScriptWizard({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: MultiStepScriptWizardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templates, createTemplate, loading: templatesLoading } = usePromptTemplates('script');
  
  const [currentStep, setCurrentStep] = useState(0);
  const [model, setModel] = useState<'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama'>(preferredModel as 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama');
  const [loading, setLoading] = useState(false);
  const [expandingAll, setExpandingAll] = useState(false);
  const [expandProgress, setExpandProgress] = useState<{ current: number; total: number } | null>(null);
  const [userInput, setUserInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_MULTISTEP_TEMPLATE);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [expandedPartIndex, setExpandedPartIndex] = useState<number | null>(null);
  const [scriptTitle, setScriptTitle] = useState('');
  const [data, setData] = useState<StepData>({
    title: '',
    synopsis: '',
    parts: '',
    expandedParts: [],
    finalScript: '',
  });

  // Load default template on mount
  useEffect(() => {
    const defaultTemplate = templates.find(t => t.is_default);
    if (defaultTemplate) {
      setCustomTemplate(defaultTemplate.content);
    }
  }, [templates]);

  // Sync scriptTitle with data.title
  useEffect(() => {
    if (data.title && !scriptTitle) {
      setScriptTitle(data.title);
    }
  }, [data.title, scriptTitle]);

  const getApiKey = () => {
    if (model === 'groq') return groqApiKey;
    if (model === 'gemini') return geminiApiKey;
    return openrouterApiKey;
  };

  const hasApiKey = !!getApiKey();
  const isFavorite = model === preferredModel;

  // Detect language from title
  const detectLanguage = (text: string): string => {
    if (!text) return 'pt-BR';
    // Check for Portuguese characters
    if (/[àáâãéêíóôõúç]/i.test(text)) return 'pt-BR';
    // Check if primarily Latin characters without Portuguese accents
    if (/^[a-zA-Z0-9\s\-:!?,.']+$/.test(text.slice(0, 100))) return 'en';
    return 'pt-BR';
  };

  const generateWithAI = async (prompt: string, systemPrompt?: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key não configurada');

    const language = detectLanguage(data.title);

    const { data: result, error } = await supabase.functions.invoke('generate-script', {
      body: { 
        prompt, 
        model, 
        apiKey,
        systemPrompt: systemPrompt || customTemplate,
        language
      },
    });

    if (error) throw error;
    if (result.error) throw new Error(result.error);

    return result.generatedText;
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Digite um nome para o template');
      return;
    }
    
    await createTemplate({
      name: newTemplateName,
      type: 'script',
      content: customTemplate,
      is_default: false,
    });
    
    setShowSaveTemplateDialog(false);
    setNewTemplateName('');
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setCustomTemplate(template.content);
      toast.success(`Template "${template.name}" carregado`);
    }
  };

  const handleGenerateSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);

    const language = detectLanguage(data.title || userInput);
    const langInstr = language === 'en' 
      ? 'Respond in English.' 
      : 'Responda em Português do Brasil.';

    try {
      let prompt = '';
      
      if (currentStep === 0) {
        if (!userInput.trim()) {
          toast.error('Digite uma descrição primeiro');
          setLoading(false);
          return;
        }
        prompt = `${langInstr}

Based on this video/story idea: "${userInput}"
        
Generate exactly 3 creative and catchy title suggestions, one per line.
Only the titles, no numbering or explanation.`;
      } else if (currentStep === 1) {
        prompt = `${langInstr}

Title: "${data.title}"
Additional description: "${userInput}"

Generate exactly 3 different synopses (each 2-3 sentences) for this content.
Separate each synopsis with "---" on a new line.
Only the synopses, no numbering.`;
      } else if (currentStep === 2) {
        // Can generate with just title + template
        prompt = `${langInstr}

Title: "${data.title}"
${data.synopsis ? `Synopsis: "${data.synopsis}"` : ''}
${userInput ? `Additional instructions: "${userInput}"` : ''}

Suggest a structure divided into parts/chapters for this script.
List each part with a short title and brief description (1 line).
Format: "Part X: [Title] - [Brief description]"`;
      }

      const response = await generateWithAI(prompt);
      
      if (currentStep === 1) {
        setSuggestions(response.split('---').map(s => s.trim()).filter(Boolean));
      } else if (currentStep === 2) {
        setSuggestions([response]);
      } else {
        setSuggestions(response.split('\n').map(s => s.trim()).filter(Boolean));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao gerar sugestões');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPart = async (partDescription: string, partIndex: number) => {
    setLoading(true);

    const language = detectLanguage(data.title);
    const langInstr = language === 'en' 
      ? 'Write ENTIRELY in English. Do NOT translate to any other language.' 
      : 'Escreva em Português do Brasil.';

    try {
      const previousContext = data.expandedParts
        .slice(0, partIndex)
        .filter(Boolean)
        .map((p, i) => `[PART ${i + 1}]:\n${p.slice(0, 2000)}...`)
        .join('\n\n');

      const prompt = `${langInstr}

SCRIPT CONTEXT:
Title: "${data.title}"
${data.synopsis ? `Synopsis: "${data.synopsis}"` : ''}

FULL STRUCTURE:
${data.parts}

${previousContext ? `PREVIOUS PARTS (maintain consistency):\n${previousContext}\n\n` : ''}

TASK: Expand the following part in EXTREME DETAIL:
${partDescription}

INSTRUCTIONS: ${userInput || 'Maximum details, realistic dialogues, and cinematic visual descriptions.'}

REQUIREMENTS:
1. Write AT LEAST 10,000 characters (~2000 words)
2. Detailed visual descriptions (setting, lighting, expressions, camera angles)
3. Natural dialogues
4. Same language and tone as previous parts
5. Same character names
6. Correct chronology
7. DO NOT contradict previous parts
8. Transition hooks

Write ONLY the expanded content, no headers.`;

      const response = await generateWithAI(prompt);
      
      setData(prev => {
        const newParts = [...prev.expandedParts];
        newParts[partIndex] = response;
        return { ...prev, expandedParts: newParts };
      });
      
      if (!expandingAll) {
        toast.success(`Parte ${partIndex + 1} expandida! (${response.length.toLocaleString('pt-BR')} caracteres)`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao expandir parte');
    } finally {
      setLoading(false);
    }
  };

  const assembleFinalScript = () => {
    // Combine all expanded parts into final script
    const parts = getParts();
    let finalText = `# ${data.title}\n\n`;
    
    if (data.synopsis) {
      finalText += `*${data.synopsis}*\n\n---\n\n`;
    }
    
    parts.forEach((part, index) => {
      finalText += `## ${part}\n\n`;
      if (data.expandedParts[index]) {
        finalText += data.expandedParts[index];
        finalText += '\n\n---\n\n';
      }
    });

    setData(prev => ({ ...prev, finalScript: finalText }));
    setScriptTitle(data.title);
    setCurrentStep(4);
  };

  const selectSuggestion = (suggestion: string) => {
    if (currentStep === 0) {
      setData(prev => ({ ...prev, title: suggestion }));
      setScriptTitle(suggestion);
    } else if (currentStep === 1) {
      setData(prev => ({ ...prev, synopsis: suggestion }));
    } else if (currentStep === 2) {
      setData(prev => ({ ...prev, parts: suggestion }));
    }
    setSuggestions([]);
    setUserInput('');
  };

  const nextStep = () => {
    if (currentStep === 0 && !data.title) {
      toast.error('Defina um título');
      return;
    }
    // Step 1 (synopsis) is optional - can skip
    if (currentStep === 2 && !data.parts) {
      toast.error('Defina a estrutura');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    setSuggestions([]);
    setUserInput('');
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setSuggestions([]);
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setData({ title: '', synopsis: '', parts: '', expandedParts: [], finalScript: '' });
    setSuggestions([]);
    setUserInput('');
    setScriptTitle('');
  };

  const getParts = (): string[] => {
    if (!data.parts) return [];
    return data.parts.split('\n').filter(line => line.trim().length > 0);
  };

  const handleExpandAllSequentially = async () => {
    const parts = getParts();
    if (parts.length === 0) {
      toast.error('Nenhuma parte para expandir');
      return;
    }

    setExpandingAll(true);
    setExpandProgress({ current: 0, total: parts.length });

    try {
      for (let i = 0; i < parts.length; i++) {
        if (data.expandedParts[i]) {
          setExpandProgress({ current: i + 1, total: parts.length });
          continue;
        }

        setExpandProgress({ current: i + 1, total: parts.length });
        await handleExpandPart(parts[i], i);
        
        if (i < parts.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      toast.success('Todas as partes foram expandidas!');
      // Auto advance to step 5 after all expanded
      setTimeout(() => {
        assembleFinalScript();
      }, 500);
    } catch (error) {
      toast.error('Erro ao expandir partes');
    } finally {
      setExpandingAll(false);
      setExpandProgress(null);
    }
  };

  const handleSaveScript = async () => {
    if (!user) {
      toast.error('Faça login para salvar');
      return;
    }

    if (!scriptTitle.trim()) {
      toast.error('Digite um título para o roteiro');
      return;
    }

    try {
      const { error } = await supabase
        .from('scripts')
        .insert({
          title: scriptTitle,
          content: data.finalScript,
          user_id: user.id,
          status: 'draft'
        });

      if (error) throw error;
      toast.success('Roteiro salvo com sucesso!');
    } catch (error) {
      console.error('Error saving script:', error);
      toast.error('Erro ao salvar roteiro');
    }
  };

  const handleSaveAndAutomate = async () => {
    await handleSaveScript();
    onComplete(data.finalScript, scriptTitle);
    navigate('/ai-studio');
  };

  const parts = getParts();
  const allExpanded = parts.length > 0 && data.expandedParts.filter(Boolean).length === parts.length;
  const totalChars = data.expandedParts.reduce((acc, part) => acc + (part?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header with Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="groq">Groq (Llama 3.3)</SelectItem>
              <SelectItem value="gemini">Gemini 2.5</SelectItem>
              <SelectItem value="qwen">Qwen3 Coder</SelectItem>
              <SelectItem value="deepseek">DeepSeek R1</SelectItem>
              <SelectItem value="llama">Llama 3.3</SelectItem>
            </SelectContent>
          </Select>
          {onFavoriteModel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFavoriteModel(model)}
              className={isFavorite ? 'text-yellow-500' : 'text-muted-foreground'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
            </Button>
          )}
        </div>
        
        {!hasApiKey && (
          <p className="text-sm text-destructive">Configure a API Key nas configurações</p>
        )}
      </div>

      {/* Template Section - Collapsible */}
      <Collapsible open={templateOpen} onOpenChange={setTemplateOpen}>
        <Card className="border-dashed">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Template de Geração</CardTitle>
                </div>
                {templateOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="flex gap-2">
                {templates.length > 0 && (
                  <Select onValueChange={loadTemplate}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Carregar template salvo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.is_default && '⭐'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowSaveTemplateDialog(true)}>
                  <Save className="w-4 h-4 mr-1" />Salvar
                </Button>
              </div>
              <Textarea
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Steps Progress */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  index < currentStep 
                    ? 'bg-primary text-primary-foreground'
                    : index === currentStep
                    ? 'bg-secondary text-secondary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${index === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-8 md:w-16 h-1 mx-1 rounded ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Header */}
      <div className="text-center py-2">
        <h3 className="text-xl font-semibold text-foreground">{STEPS[currentStep].label}</h3>
        <p className="text-sm text-muted-foreground">{STEPS[currentStep].description}</p>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 4: Save/Final Result */}
          {currentStep === 4 ? (
            <div className="space-y-4">
              {/* Title and Stats */}
              <div className="space-y-3">
                <div>
                  <Label>Título do Roteiro</Label>
                  <Input
                    value={scriptTitle}
                    onChange={(e) => setScriptTitle(e.target.value)}
                    placeholder="Título do roteiro"
                    className="mt-1 text-lg font-medium"
                  />
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <div>
                    <span className="font-medium text-foreground">{data.finalScript.length.toLocaleString('pt-BR')}</span> caracteres
                  </div>
                  <div>
                    <span className="font-medium text-foreground">{parts.length}</span> partes
                  </div>
                  <div>
                    <span className="font-medium text-foreground">~{Math.ceil(data.finalScript.length / 1500)}</span> min leitura
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Roteiro Final</Label>
                <ScrollArea className="h-[400px] mt-1">
                  <Textarea
                    value={data.finalScript}
                    onChange={(e) => setData(prev => ({ ...prev, finalScript: e.target.value }))}
                    className="font-mono text-sm min-h-[380px]"
                  />
                </ScrollArea>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button variant="outline" onClick={resetWizard}>
                  <RotateCcw className="w-4 h-4 mr-2" />Recomeçar
                </Button>
                <Button variant="secondary" onClick={handleSaveScript} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />Apenas Salvar
                </Button>
                <Button 
                  variant="fire" 
                  onClick={handleSaveAndAutomate}
                  className="flex-1"
                >
                  <Zap className="w-4 h-4 mr-2" />Salvar e Automatizar
                </Button>
              </div>
            </div>
          ) : currentStep === 3 ? (
            /* Step 3: Expansion */
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                <strong>{data.title}</strong>
                {data.synopsis && <p className="text-muted-foreground">{data.synopsis}</p>}
              </div>

              {/* Progress bar when expanding */}
              {expandProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Expandindo partes...</span>
                    <span>{expandProgress.current} de {expandProgress.total}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(expandProgress.current / expandProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {parts.map((part, index) => (
                  <Card key={index} className={`border-l-4 ${data.expandedParts[index] ? 'border-l-primary' : 'border-l-muted-foreground/30'}`}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${data.expandedParts[index] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">{part}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {data.expandedParts[index] && (
                            <span className="text-xs text-muted-foreground">
                              {data.expandedParts[index].length.toLocaleString('pt-BR')} chars
                            </span>
                          )}
                          {data.expandedParts[index] ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedPartIndex(expandedPartIndex === index ? null : index)}
                            >
                              {expandedPartIndex === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleExpandPart(part, index)}
                              disabled={loading || expandingAll}
                            >
                              {loading && !expandingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                              Expandir
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedPartIndex === index && data.expandedParts[index] && (
                      <CardContent className="pt-0 px-4 pb-4">
                        <ScrollArea className="h-48">
                          <Textarea 
                            value={data.expandedParts[index]}
                            onChange={(e) => {
                              setData(prev => {
                                const newParts = [...prev.expandedParts];
                                newParts[index] = e.target.value;
                                return { ...prev, expandedParts: newParts };
                              });
                            }}
                            className="text-sm min-h-[180px]"
                          />
                        </ScrollArea>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExpandPart(part, index)}
                          disabled={loading}
                          className="mt-2"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />Regenerar
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>

              {/* Stats */}
              {totalChars > 0 && (
                <div className="text-center text-sm text-muted-foreground bg-muted/30 rounded-lg p-2">
                  Total expandido: <span className="font-medium text-foreground">{totalChars.toLocaleString('pt-BR')}</span> caracteres
                </div>
              )}

              <div className="space-y-3 pt-4 border-t">
                <div>
                  <Label>Instruções para expansão (opcional)</Label>
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ex: Mais diálogos, descrições visuais, tom humorístico..."
                    rows={2}
                    className="mt-1"
                  />
                </div>

                {!allExpanded && (
                  <Button 
                    variant="secondary" 
                    onClick={handleExpandAllSequentially}
                    disabled={loading || expandingAll}
                    className="w-full"
                  >
                    {expandingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Expandindo {expandProgress?.current} de {expandProgress?.total}...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Expandir Todas as Partes
                      </>
                    )}
                  </Button>
                )}

                {allExpanded && (
                  <Button 
                    variant="fire" 
                    onClick={assembleFinalScript}
                    className="w-full"
                  >
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Continuar para Salvar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Steps 0-2: Title, Synopsis, Structure */
            <div className="space-y-4">
              {/* Step 0: Title */}
              {currentStep === 0 && (
                <>
                  <div>
                    <Label>Descreva sua ideia (opcional)</Label>
                    <Textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Descreva sobre o que será seu vídeo/história para gerar sugestões de títulos..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={loading || !hasApiKey || !userInput.trim()}
                    variant="secondary"
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" />Gerar Sugestões de Título</>
                    )}
                  </Button>

                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Escolha uma opção:</Label>
                      {suggestions.map((suggestion, index) => (
                        <Card 
                          key={index} 
                          className="cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <CardContent className="py-3">
                            <p className="text-sm">{suggestion}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Label>Ou digite o título diretamente:</Label>
                    <Input
                      value={data.title}
                      onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Título do roteiro"
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {/* Step 1: Synopsis (Optional) */}
              {currentStep === 1 && (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                    <span className="text-muted-foreground">Título:</span> <strong>{data.title}</strong>
                  </div>

                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      💡 A sinopse é <strong>opcional</strong>. Você pode pular esta etapa e ir direto para a estrutura.
                    </p>
                  </div>

                  <div>
                    <Label>Adicione detalhes para a sinopse (opcional)</Label>
                    <Textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Descreva elementos adicionais para gerar sugestões de sinopse..."
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={loading || !hasApiKey}
                    variant="secondary"
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" />Gerar Sugestões de Sinopse</>
                    )}
                  </Button>

                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Escolha uma opção:</Label>
                      {suggestions.map((suggestion, index) => (
                        <Card 
                          key={index} 
                          className="cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <CardContent className="py-3">
                            <p className="text-sm">{suggestion}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Label>Ou digite a sinopse diretamente (opcional):</Label>
                    <Textarea
                      value={data.synopsis}
                      onChange={(e) => setData(prev => ({ ...prev, synopsis: e.target.value }))}
                      placeholder="Sinopse do roteiro (deixe vazio para pular)"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {/* Step 2: Structure */}
              {currentStep === 2 && (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg border text-sm space-y-1">
                    <div><span className="text-muted-foreground">Título:</span> <strong>{data.title}</strong></div>
                    {data.synopsis && <div><span className="text-muted-foreground">Sinopse:</span> {data.synopsis}</div>}
                  </div>

                  <div>
                    <Label>Instruções adicionais (opcional)</Label>
                    <Textarea
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Ex: Divida em 5 partes, foque no drama, inclua um plot twist..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={loading || !hasApiKey}
                    variant="secondary"
                    className="w-full"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Gerar Estrutura</>
                    )}
                  </Button>

                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Estrutura sugerida:</Label>
                      {suggestions.map((suggestion, index) => (
                        <Card 
                          key={index} 
                          className="cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors"
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <CardContent className="py-3">
                            <pre className="text-sm whitespace-pre-wrap font-sans">{suggestion}</pre>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Label>Ou digite a estrutura diretamente:</Label>
                    <Textarea
                      value={data.parts}
                      onChange={(e) => setData(prev => ({ ...prev, parts: e.target.value }))}
                      placeholder="Parte 1: Introdução&#10;Parte 2: Desenvolvimento&#10;Parte 3: Clímax&#10;Parte 4: Conclusão"
                      rows={5}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep < 4 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />Anterior
          </Button>
          
          {currentStep < 3 && (
            <Button onClick={nextStep}>
              {currentStep === 1 && !data.synopsis ? 'Pular' : 'Próximo'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Ex: Template para Vídeos de História"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button variant="fire" onClick={handleSaveTemplate}>
              <Save className="w-4 h-4 mr-2" />Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

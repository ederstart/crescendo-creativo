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
import { Loader2, ChevronRight, ChevronLeft, Check, Star, Sparkles, RotateCcw, Save, FileText, Settings2, ChevronDown, ChevronUp, Wand2, Zap, Square } from 'lucide-react';
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
  language: string;
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
  const [abortExpansionRef] = useState({ current: false }); // Use ref pattern for closure
  const [abortExpansion, setAbortExpansion] = useState(false);
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
    language: '',
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

  // No language detection on frontend - LLM will detect from title

  const generateWithAI = async (prompt: string, systemPrompt?: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key não configurada');

    const { data: result, error } = await supabase.functions.invoke('generate-script', {
      body: { 
        prompt, 
        model, 
        apiKey,
        systemPrompt: systemPrompt || customTemplate,
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

    try {
      let prompt = '';
      
      // Use user-defined language or instruct LLM to detect
      const langInstruction = data.language 
        ? `CRITICAL: Respond ONLY in ${data.language}. DO NOT use any other language.`
        : `CRITICAL: Detect the language of the content and respond ONLY in that same language. Match the language exactly.`;
      
      if (currentStep === 0) {
        if (!userInput.trim()) {
          toast.error('Digite uma descrição primeiro');
          setLoading(false);
          return;
        }
        prompt = `${langInstruction}

Based on this video/story idea: "${userInput}"
        
Generate exactly 3 creative and catchy title suggestions, one per line.
Only the titles, no numbering or explanation.`;
      } else if (currentStep === 1) {
        const stepLangInstruction = data.language 
          ? `CRITICAL: Respond ONLY in ${data.language}. DO NOT use any other language.`
          : `CRITICAL: Detect the language of the title "${data.title}" and respond ONLY in that same language.`;
        
        prompt = `${stepLangInstruction}

Title: "${data.title}"
Additional description: "${userInput}"

Generate exactly 3 different synopses (each 2-3 sentences) for this content.
Separate each synopsis with "---" on a new line.
Only the synopses, no numbering, no extra comments.`;
      } else if (currentStep === 2) {
        const stepLangInstruction = data.language 
          ? `CRITICAL: Respond ONLY in ${data.language}. DO NOT use any other language.`
          : `CRITICAL: Detect the language of the title "${data.title}" and respond ONLY in that same language.`;
        
        prompt = `${stepLangInstruction}

Do NOT add any personal comments or observations. Output ONLY the structure.

Title: "${data.title}"
${data.synopsis ? `Synopsis: "${data.synopsis}"` : ''}
${userInput ? `Additional instructions: "${userInput}"` : ''}

Generate a detailed structure divided into 10-20 parts/chapters.
Each part MUST be a scene/moment of the story, NOT a meta-comment.
Format: "Part X: [Scene Title] - [Brief scene description]"

FORBIDDEN: Do not add conclusions, comments like "I hope this helps", or any text outside the structure format.
Output ONLY the parts list, nothing else.`;
      }

      const response = await generateWithAI(prompt);
      
      if (currentStep === 1) {
        setSuggestions(response.split('---').map(s => s.trim()).filter(Boolean));
      } else if (currentStep === 2) {
        // Clean up any LLM commentary that slipped through
        const cleanedResponse = response
          .split('\n')
          .filter(line => /^(Part|Parte)\s*\d+/i.test(line.trim()))
          .join('\n');
        setSuggestions([cleanedResponse || response]);
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

  const handleExpandPart = async (partDescription: string, partIndex: number): Promise<boolean> => {
    setLoading(true);

    try {
      const parts = getParts();
      
      // Get last 4000 chars from previous part for smooth continuation
      const previousPartContent = partIndex > 0 && data.expandedParts[partIndex - 1] 
        ? data.expandedParts[partIndex - 1].slice(-4000) 
        : '';
      
      // Get the last paragraph for duplicate detection
      const lastParagraph = previousPartContent ? previousPartContent.split('\n\n').pop()?.trim() || '' : '';
      
      // Get next part info for transition
      const nextPartInfo = parts[partIndex + 1] ? `NEXT PART PREVIEW: ${parts[partIndex + 1]}` : '';

      // Use user-defined language or instruct LLM to detect
      const languageInstruction = data.language 
        ? `CRITICAL: Write your ENTIRE response in ${data.language}. DO NOT use any other language.`
        : `CRITICAL LANGUAGE RULE: Detect the language of the title "${data.title}" and write your ENTIRE response in that EXACT language. If the title is in English, write in English. If in Portuguese, write in Portuguese. If in Chinese, write in Chinese. DO NOT MIX LANGUAGES.`;

      const prompt = `${languageInstruction}

SCRIPT CONTEXT:
Title: "${data.title}"
${data.synopsis ? `Synopsis: "${data.synopsis}"` : ''}

FULL STRUCTURE:
${data.parts}

${previousPartContent ? `CONTINUATION FROM PREVIOUS PART (continue exactly from here, do not repeat):\n---\n...${previousPartContent}\n---\n\n` : ''}

CURRENT TASK: Expand this part in EXTREME DETAIL:
${partDescription}

${nextPartInfo}

INSTRUCTIONS: ${userInput || 'Maximum details, realistic dialogues, and cinematic visual descriptions.'}

CRITICAL REQUIREMENTS:
1. Write AT LEAST 10,000 characters (~2000 words)
2. Detailed visual descriptions (setting, lighting, expressions, camera angles)
3. Natural dialogues when applicable
4. CONTINUE exactly where the previous part ended - no gaps, no repeated content
5. Use the SAME character names from previous parts
6. CORRECT chronology - events must follow logically
7. DO NOT contradict anything from previous parts
8. End with a smooth transition to the next part
9. COMPLETE all sentences - no cut-off words or phrases
10. NO markdown formatting (no #, *, ---, etc.)
11. Plain text with paragraph breaks only

OUTPUT ONLY the expanded content. No headers, no comments, no "I hope this helps", no meta-text.`;

      let response = await generateWithAI(prompt);
      
      // Clean markdown from response
      response = response
        .replace(/^#+\s*/gm, '')  // Remove # headers
        .replace(/\*+/g, '')       // Remove * formatting
        .replace(/^---+$/gm, '')   // Remove --- lines
        .replace(/^—+$/gm, '')     // Remove — lines
        .replace(/^\/+/gm, '')     // Remove /
        .trim();
      
      // Detect and remove duplicated content from previous part
      if (lastParagraph && lastParagraph.length > 50) {
        // Check if response starts with similar content
        const responseStart = response.slice(0, lastParagraph.length + 200);
        const similarity = calculateSimilarity(lastParagraph, responseStart);
        if (similarity > 0.6) {
          // Find where the new content actually starts
          const lines = response.split('\n');
          let startIndex = 0;
          for (let i = 0; i < Math.min(lines.length, 10); i++) {
            if (lastParagraph.includes(lines[i].trim()) && lines[i].trim().length > 20) {
              startIndex = i + 1;
            }
          }
          if (startIndex > 0) {
            response = lines.slice(startIndex).join('\n').trim();
          }
        }
      }
      
      setData(prev => {
        const newParts = [...prev.expandedParts];
        newParts[partIndex] = response;
        return { ...prev, expandedParts: newParts };
      });
      
      if (!expandingAll) {
        toast.success(`Parte ${partIndex + 1} expandida! (${response.length.toLocaleString('pt-BR')} caracteres)`);
      }
      
      return true; // Success
    } catch (error) {
      console.error('Error:', error);
      toast.error(`Erro ao expandir parte ${partIndex + 1}`);
      return false; // Failure
    } finally {
      setLoading(false);
    }
  };

  // Simple similarity check for duplicate detection
  const calculateSimilarity = (str1: string, str2: string): number => {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    let matches = 0;
    for (const word of words2) {
      if (set1.has(word) && word.length > 3) matches++;
    }
    return matches / Math.max(words1.length, 1);
  };

  const assembleFinalScript = () => {
    // Combine all expanded parts into final script - NO markdown
    const parts = getParts();
    let finalText = `${data.title.toUpperCase()}\n\n`;
    
    if (data.synopsis) {
      finalText += `${data.synopsis}\n\n`;
    }
    
    parts.forEach((part, index) => {
      // Extract just the part name, removing "Part X:" prefix
      const partName = part.replace(/^(Part|Parte)\s*\d+:\s*/i, '').trim();
      finalText += `${partName.toUpperCase()}\n\n`;
      
      if (data.expandedParts[index]) {
        // Clean any remaining markdown from expanded content
        let content = data.expandedParts[index]
          .replace(/^#+\s*/gm, '')
          .replace(/\*+/g, '')
          .replace(/^---+$/gm, '')
          .replace(/^—+$/gm, '')
          .replace(/^\/+/gm, '')
          .trim();
        
        finalText += content + '\n\n';
      }
    });

    setData(prev => ({ ...prev, finalScript: finalText.trim() }));
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
    setData({ title: '', synopsis: '', parts: '', expandedParts: [], finalScript: '', language: '' });
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
    abortExpansionRef.current = false;
    setAbortExpansion(false);
    setExpandProgress({ current: 0, total: parts.length });

    let allSuccessful = true;

    try {
      for (let i = 0; i < parts.length; i++) {
        // Check if user wants to stop using ref (works inside closure)
        if (abortExpansionRef.current) {
          toast.info('Expansão cancelada pelo usuário');
          allSuccessful = false;
          break;
        }
        
        if (data.expandedParts[i]) {
          setExpandProgress({ current: i + 1, total: parts.length });
          continue;
        }

        setExpandProgress({ current: i + 1, total: parts.length });
        const success = await handleExpandPart(parts[i], i);
        
        // Abort if expansion failed
        if (!success) {
          toast.error(`Falha na parte ${i + 1}. Expansão abortada.`);
          allSuccessful = false;
          break;
        }
        
        if (i < parts.length - 1 && !abortExpansionRef.current) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      if (allSuccessful && !abortExpansionRef.current) {
        toast.success('Todas as partes foram expandidas!');
        // Auto advance to step 5 after all expanded
        setTimeout(() => {
          assembleFinalScript();
        }, 500);
      }
    } catch (error) {
      toast.error('Erro ao expandir partes');
    } finally {
      setExpandingAll(false);
      setExpandProgress(null);
      abortExpansionRef.current = false;
      setAbortExpansion(false);
    }
  };

  const handleStopExpansion = () => {
    abortExpansionRef.current = true;
    setAbortExpansion(true);
    toast.info('Parando expansão...');
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

                {!allExpanded && !expandingAll && (
                  <Button 
                    variant="secondary" 
                    onClick={handleExpandAllSequentially}
                    disabled={loading}
                    className="w-full"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Expandir Todas as Partes
                  </Button>
                )}

                {expandingAll && (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      disabled
                      className="flex-1"
                    >
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Expandindo {expandProgress?.current} de {expandProgress?.total}...
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleStopExpansion}
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Parar
                    </Button>
                  </div>
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

                  <div className="pt-4 border-t space-y-3">
                    <div>
                      <Label>Ou digite o título diretamente:</Label>
                      <Input
                        value={data.title}
                        onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Título do roteiro"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label>Idioma do roteiro (opcional)</Label>
                      <Input
                        value={data.language}
                        onChange={(e) => setData(prev => ({ ...prev, language: e.target.value }))}
                        placeholder="Ex: Português, English, 中文, Español... (deixe vazio para detectar automaticamente)"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Se não especificado, o idioma será detectado pelo título
                      </p>
                    </div>
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

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ChevronRight, ChevronLeft, Check, Star, Sparkles, RotateCcw, Save, FileText } from 'lucide-react';
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
  { id: 'template', label: 'Template', description: 'Configure o template de geração' },
  { id: 'title', label: 'Título', description: 'Defina o título do seu roteiro' },
  { id: 'synopsis', label: 'Sinopse', description: 'Crie uma sinopse envolvente' },
  { id: 'parts', label: 'Estrutura', description: 'Defina as partes da história' },
  { id: 'expand', label: 'Expansão', description: 'Expanda cada parte da história' },
  { id: 'final', label: 'Resultado', description: 'Roteiro final formatado' },
];

const DEFAULT_MULTISTEP_TEMPLATE = `Você é um roteirista profissional de vídeos para YouTube.

DIRETRIZES GERAIS:
- Linguagem: Português do Brasil, tom conversacional e envolvente
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
4. Transição para próxima cena`;

export function MultiStepScriptWizard({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: MultiStepScriptWizardProps) {
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
  const [data, setData] = useState<StepData>({
    title: '',
    synopsis: '',
    parts: '',
    expandedParts: [],
    finalScript: '',
  });
  const [currentPartIndex, setCurrentPartIndex] = useState(0);

  // Load default template on mount
  useEffect(() => {
    const defaultTemplate = templates.find(t => t.is_default);
    if (defaultTemplate) {
      setCustomTemplate(defaultTemplate.content);
    }
  }, [templates]);

  const getApiKey = () => {
    if (model === 'groq') return groqApiKey;
    if (model === 'gemini') return geminiApiKey;
    // qwen, deepseek, llama all use openrouter
    return openrouterApiKey;
  };

  const hasApiKey = !!getApiKey();
  const isFavorite = model === preferredModel;

  const generateWithAI = async (prompt: string, systemPrompt?: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key não configurada');

    const { data: result, error } = await supabase.functions.invoke('generate-script', {
      body: { 
        prompt, 
        model, 
        apiKey,
        systemPrompt: systemPrompt || customTemplate 
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
    if (!userInput.trim()) {
      toast.error('Digite uma descrição primeiro');
      return;
    }

    setLoading(true);
    setSuggestions([]);

    try {
      let prompt = '';
      
      if (currentStep === 1) {
        prompt = `Com base na seguinte ideia de vídeo/história: "${userInput}"
        
Gere exatamente 3 sugestões de títulos criativos e chamativos, um por linha.
Apenas os títulos, sem numeração ou explicação.`;
      } else if (currentStep === 2) {
        prompt = `Título do vídeo/história: "${data.title}"
Descrição adicional: "${userInput}"

Gere exatamente 3 sinopses diferentes (cada uma com 2-3 frases) para este conteúdo.
Separe cada sinopse com "---" em uma nova linha.
Apenas as sinopses, sem numeração.`;
      } else if (currentStep === 3) {
        prompt = `Título: "${data.title}"
Sinopse: "${data.synopsis}"
Instruções adicionais: "${userInput}"

Sugira uma estrutura dividida em partes/capítulos para este roteiro.
Liste cada parte com um título curto e uma breve descrição (1 linha).
Formato: "Parte X: [Título] - [Descrição breve]"`;
      }

      const response = await generateWithAI(prompt);
      
      if (currentStep === 2) {
        setSuggestions(response.split('---').map(s => s.trim()).filter(Boolean));
      } else if (currentStep === 3) {
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

    try {
      // Build context from previously expanded parts
      const previousContext = data.expandedParts
        .slice(0, partIndex)
        .filter(Boolean)
        .map((p, i) => `[PARTE ${i + 1} ANTERIOR - REFERÊNCIA]:\n${p.slice(0, 2000)}...`)
        .join('\n\n');

      const prompt = `CONTEXTO DO ROTEIRO:
Título: "${data.title}"
Sinopse: "${data.synopsis}"

ESTRUTURA COMPLETA DO ROTEIRO:
${data.parts}

${previousContext ? `PARTES ANTERIORES (para manter consistência de personagens/eventos):\n${previousContext}\n\n` : ''}

TAREFA: Expanda a seguinte parte de forma EXTREMAMENTE DETALHADA:
${partDescription}

INSTRUÇÕES ESPECÍFICAS:
${userInput || 'Expanda com máximo de detalhes, diálogos realistas e descrições visuais cinematográficas.'}

REQUISITOS OBRIGATÓRIOS:
1. Escreva NO MÍNIMO 10.000 caracteres (aproximadamente 2000 palavras)
2. Inclua descrições visuais detalhadas (cenário, iluminação, expressões faciais, movimentos de câmera)
3. Adicione diálogos realistas e naturais
4. Mantenha a mesma linguagem e tom das partes anteriores
5. Use os mesmos nomes de personagens já estabelecidos
6. Siga a cronologia correta da história
7. NÃO contradiga eventos de partes anteriores
8. Crie ganchos de transição para a próxima parte

Escreva APENAS o conteúdo expandido, sem cabeçalhos ou marcações.`;

      const response = await generateWithAI(prompt);
      
      setData(prev => {
        const newParts = [...prev.expandedParts];
        newParts[partIndex] = response;
        return { ...prev, expandedParts: newParts };
      });
      
      if (!expandingAll) {
        const charCount = response.length;
        toast.success(`Parte ${partIndex + 1} expandida! (${charCount.toLocaleString('pt-BR')} caracteres)`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao expandir parte');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFinal = async () => {
    setLoading(true);

    try {
      const prompt = `Com base nas seguintes informações, crie um roteiro final completo e bem formatado:

TÍTULO: ${data.title}

SINOPSE: ${data.synopsis}

ESTRUTURA:
${data.parts}

CONTEÚDO EXPANDIDO:
${data.expandedParts.map((p, i) => `--- Parte ${i + 1} ---\n${p}`).join('\n\n')}

Formate o roteiro final de forma profissional, unindo todas as partes em um texto coeso.
Use marcações como # para títulos e ## para subtítulos.
Mantenha a narrativa fluida entre as partes.`;

      const response = await generateWithAI(prompt);
      setData(prev => ({ ...prev, finalScript: response }));
      setCurrentStep(5);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao gerar roteiro final');
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    if (currentStep === 1) {
      setData(prev => ({ ...prev, title: suggestion }));
    } else if (currentStep === 2) {
      setData(prev => ({ ...prev, synopsis: suggestion }));
    } else if (currentStep === 3) {
      setData(prev => ({ ...prev, parts: suggestion }));
    }
    setSuggestions([]);
    setUserInput('');
  };

  const nextStep = () => {
    if (currentStep === 1 && !data.title) {
      toast.error('Selecione ou digite um título');
      return;
    }
    if (currentStep === 2 && !data.synopsis) {
      toast.error('Selecione ou digite uma sinopse');
      return;
    }
    if (currentStep === 3 && !data.parts) {
      toast.error('Defina a estrutura do roteiro');
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
        // Skip if already expanded
        if (data.expandedParts[i]) {
          setExpandProgress({ current: i + 1, total: parts.length });
          continue;
        }

        setExpandProgress({ current: i + 1, total: parts.length });
        await handleExpandPart(parts[i], i);
        
        // Small delay between parts to avoid rate limits
        if (i < parts.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      toast.success('Todas as partes foram expandidas!');
    } catch (error) {
      toast.error('Erro ao expandir partes');
    } finally {
      setExpandingAll(false);
      setExpandProgress(null);
    }
  };

  const renderStepContent = () => {
    const step = STEPS[currentStep];

    // Step 0: Template configuration
    if (currentStep === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Template de Geração</Label>
            <div className="flex gap-2">
              {templates.length > 0 && (
                <Select onValueChange={loadTemplate}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Carregar template..." />
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
                <Save className="w-4 h-4 mr-1" />
                Salvar
              </Button>
            </div>
          </div>
          <Textarea
            value={customTemplate}
            onChange={(e) => setCustomTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            placeholder="Digite as instruções para o modelo de IA..."
          />
          <p className="text-xs text-muted-foreground">
            Este template será usado em todas as etapas de geração. Defina regras, estilo, e diretrizes.
          </p>
        </div>
      );
    }

    // Step 5: Final result
    if (currentStep === 5) {
      return (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Título: {data.title}</h4>
            <p className="text-sm text-muted-foreground mb-4">{data.synopsis}</p>
          </div>
          
          <Textarea
            value={data.finalScript}
            onChange={(e) => setData(prev => ({ ...prev, finalScript: e.target.value }))}
            rows={15}
            className="font-mono text-sm"
          />
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetWizard}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Recomeçar
            </Button>
            <Button 
              variant="fire" 
              onClick={() => onComplete(data.finalScript, data.title)}
              className="flex-1"
            >
              <Check className="w-4 h-4 mr-2" />
              Usar Este Roteiro
            </Button>
          </div>
        </div>
      );
    }

    if (currentStep === 4) {
      const parts = getParts();
      return (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-1">{data.title}</h4>
            <p className="text-sm text-muted-foreground">{data.synopsis}</p>
          </div>

          <div className="space-y-3">
            <Label>Partes para Expandir:</Label>
            {parts.map((part, index) => (
              <Card key={index} className="border-border">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">{part}</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  {data.expandedParts[index] ? (
                    <div className="space-y-2">
                      <Textarea 
                        value={data.expandedParts[index]}
                        onChange={(e) => {
                          setData(prev => {
                            const newParts = [...prev.expandedParts];
                            newParts[index] = e.target.value;
                            return { ...prev, expandedParts: newParts };
                          });
                        }}
                        rows={4}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExpandPart(part, index)}
                        disabled={loading}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Regenerar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleExpandPart(part, index)}
                      disabled={loading}
                    >
                      {loading && currentPartIndex === index ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1" />
                      )}
                      Expandir
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Label>Instruções para Expansão (opcional)</Label>
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ex: Incluir mais diálogos, adicionar descrições visuais, tom humorístico..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Expand All Button */}
          {parts.length > 0 && data.expandedParts.filter(Boolean).length < parts.length && (
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

          {data.expandedParts.filter(Boolean).length === parts.length && parts.length > 0 && (
            <Button 
              variant="fire" 
              onClick={handleGenerateFinal}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Gerar Roteiro Final
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <Label>{step.description}</Label>
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={
              currentStep === 0 
                ? 'Descreva sobre o que será seu vídeo/história...'
                : currentStep === 1
                ? 'Adicione detalhes para a sinopse...'
                : 'Instruções para a estrutura...'
            }
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
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Gerar Sugestões
            </>
          )}
        </Button>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <Label>Escolha uma opção:</Label>
            {suggestions.map((suggestion, index) => (
              <Card 
                key={index} 
                className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                onClick={() => selectSuggestion(suggestion)}
              >
                <CardContent className="py-3">
                  <p className="text-sm">{suggestion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentStep === 0 && (
          <div>
            <Label>Ou digite o título diretamente:</Label>
            <Input
              value={data.title}
              onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título do roteiro"
              className="mt-1"
            />
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <Label>Ou digite a sinopse diretamente:</Label>
            <Textarea
              value={data.synopsis}
              onChange={(e) => setData(prev => ({ ...prev, synopsis: e.target.value }))}
              placeholder="Sinopse do roteiro"
              rows={3}
              className="mt-1"
            />
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <Label>Ou defina a estrutura diretamente:</Label>
            <Textarea
              value={data.parts}
              onChange={(e) => setData(prev => ({ ...prev, parts: e.target.value }))}
              placeholder="Parte 1: Introdução&#10;Parte 2: Desenvolvimento&#10;Parte 3: Clímax&#10;Parte 4: Conclusão"
              rows={5}
              className="mt-1"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Model selector */}
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
        <Select value={model} onValueChange={(v) => setModel(v as 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groq">Groq (Llama 3.3 70B)</SelectItem>
            <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
            <SelectItem value="qwen">Qwen3 Coder (OpenRouter)</SelectItem>
            <SelectItem value="deepseek">DeepSeek R1 (OpenRouter)</SelectItem>
            <SelectItem value="llama">Llama 3.3 (OpenRouter)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                index < currentStep 
                  ? 'bg-primary text-primary-foreground'
                  : index === currentStep
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current step label */}
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{STEPS[currentStep].label}</h3>
        <p className="text-sm text-muted-foreground">{STEPS[currentStep].description}</p>
      </div>

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          
          {currentStep < 4 && (
            <Button onClick={nextStep}>
              Próximo
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {!hasApiKey && (
        <p className="text-sm text-destructive text-center">
          Configure a API Key nas configurações
        </p>
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
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

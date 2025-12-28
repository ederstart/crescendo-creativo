import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronRight, ChevronLeft, Check, Star, Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
  { id: 'synopsis', label: 'Sinopse', description: 'Crie uma sinopse envolvente' },
  { id: 'parts', label: 'Estrutura', description: 'Defina as partes da história' },
  { id: 'expand', label: 'Expansão', description: 'Expanda cada parte da história' },
  { id: 'final', label: 'Resultado', description: 'Roteiro final formatado' },
];

export function MultiStepScriptWizard({
  groqApiKey,
  geminiApiKey,
  openrouterApiKey,
  preferredModel = 'groq',
  onComplete,
  onFavoriteModel,
}: MultiStepScriptWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [model, setModel] = useState<'groq' | 'gemini' | 'qwen'>(preferredModel as 'groq' | 'gemini' | 'qwen');
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [data, setData] = useState<StepData>({
    title: '',
    synopsis: '',
    parts: '',
    expandedParts: [],
    finalScript: '',
  });
  const [currentPartIndex, setCurrentPartIndex] = useState(0);

  const getApiKey = () => {
    if (model === 'groq') return groqApiKey;
    if (model === 'gemini') return geminiApiKey;
    return openrouterApiKey;
  };

  const hasApiKey = !!getApiKey();
  const isFavorite = model === preferredModel;

  const generateWithAI = async (prompt: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API Key não configurada');

    const { data: result, error } = await supabase.functions.invoke('generate-script', {
      body: { prompt, model, apiKey },
    });

    if (error) throw error;
    if (result.error) throw new Error(result.error);

    return result.generatedText;
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
      
      if (currentStep === 0) {
        prompt = `Com base na seguinte ideia de vídeo/história: "${userInput}"
        
Gere exatamente 3 sugestões de títulos criativos e chamativos, um por linha.
Apenas os títulos, sem numeração ou explicação.`;
      } else if (currentStep === 1) {
        prompt = `Título do vídeo/história: "${data.title}"
Descrição adicional: "${userInput}"

Gere exatamente 3 sinopses diferentes (cada uma com 2-3 frases) para este conteúdo.
Separe cada sinopse com "---" em uma nova linha.
Apenas as sinopses, sem numeração.`;
      } else if (currentStep === 2) {
        prompt = `Título: "${data.title}"
Sinopse: "${data.synopsis}"
Instruções adicionais: "${userInput}"

Sugira uma estrutura dividida em partes/capítulos para este roteiro.
Liste cada parte com um título curto e uma breve descrição (1 linha).
Formato: "Parte X: [Título] - [Descrição breve]"`;
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

    try {
      const prompt = `Título: "${data.title}"
Sinopse: "${data.synopsis}"
Estrutura completa: 
${data.parts}

Expanda APENAS a seguinte parte em um texto detalhado para roteiro:
${partDescription}

Instruções: ${userInput || 'Expanda com detalhes, diálogos e descrições visuais'}

Escreva o conteúdo expandido dessa parte do roteiro, com narrativa envolvente.`;

      const response = await generateWithAI(prompt);
      
      setData(prev => {
        const newParts = [...prev.expandedParts];
        newParts[partIndex] = response;
        return { ...prev, expandedParts: newParts };
      });
      
      toast.success(`Parte ${partIndex + 1} expandida!`);
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
      setCurrentStep(4);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao gerar roteiro final');
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    if (currentStep === 0) {
      setData(prev => ({ ...prev, title: suggestion }));
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
      toast.error('Selecione ou digite um título');
      return;
    }
    if (currentStep === 1 && !data.synopsis) {
      toast.error('Selecione ou digite uma sinopse');
      return;
    }
    if (currentStep === 2 && !data.parts) {
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

  const renderStepContent = () => {
    const step = STEPS[currentStep];

    if (currentStep === 4) {
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

    if (currentStep === 3) {
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
        <Select value={model} onValueChange={(v) => setModel(v as 'groq' | 'gemini' | 'qwen')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groq">Groq (Llama 3.3 70B)</SelectItem>
            <SelectItem value="gemini">Gemini 2.5 Flash</SelectItem>
            <SelectItem value="qwen">Qwen3 Coder (OpenRouter)</SelectItem>
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
      {currentStep < 4 && (
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          
          {currentStep < 3 && (
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
    </div>
  );
}

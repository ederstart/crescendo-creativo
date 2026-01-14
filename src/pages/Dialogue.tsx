import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Wand2, 
  Copy, 
  Save, 
  Star, 
  StopCircle, 
  Settings2, 
  Trash2, 
  Undo2, 
  RefreshCw,
  Users,
  FileText,
  Download,
  Eye,
  Check,
  Loader2,
  MessageSquare,
  User,
  UserCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import { useAISettings } from '@/hooks/useAISettings';

type AIModel = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

interface DialogueLine {
  speaker: string;
  text: string;
  speakerType: 'person1' | 'person2' | 'narrator';
}

interface SRTEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  speaker: string;
}

const DEFAULT_DIALOGUE_PROMPT = `Você é um roteirista profissional especializado em diálogos. Sua tarefa é transformar o texto em um roteiro de diálogo entre personagens.

REGRAS OBRIGATÓRIAS:
- Identifique os personagens e crie diálogos naturais
- Use o formato: PERSONAGEM 1: (fala) ou PERSONAGEM 2: (fala) ou NARRADOR: (texto)
- Mantenha as falas curtas e naturais para dublag
- Crie transições fluidas entre os personagens
- NÃO use marcadores como #, *, /, ---, travessões decorativos
- Cada fala deve ter no máximo 2-3 frases
- O diálogo deve parecer uma conversa real`;

const STORAGE_KEY_DIALOGUE_INPUT = 'dialogue_input';
const STORAGE_KEY_DIALOGUE_RESULT = 'dialogue_result';
const STORAGE_KEY_DIALOGUE_TITLE = 'dialogue_title';

// Speaker patterns to detect who is speaking
const SPEAKER_PATTERNS = [
  /^(PERSONAGEM\s*1|PESSOA\s*1|HOMEM|MACHO|MALE|SPEAKER\s*1|VOZ\s*1|P1|H|M1)\s*[:：]/i,
  /^(PERSONAGEM\s*2|PESSOA\s*2|MULHER|FÊMEA|FEMALE|SPEAKER\s*2|VOZ\s*2|P2|F|M2)\s*[:：]/i,
  /^(NARRADOR|NARRATOR|NARRACAO|NARRAÇÃO|N)\s*[:：]/i,
];

function parseSpeaker(line: string): { speaker: string; text: string; speakerType: 'person1' | 'person2' | 'narrator' } {
  const trimmed = line.trim();
  
  // Check for Person 1 patterns
  const p1Match = trimmed.match(SPEAKER_PATTERNS[0]);
  if (p1Match) {
    return {
      speaker: 'Personagem 1',
      text: trimmed.substring(p1Match[0].length).trim(),
      speakerType: 'person1'
    };
  }
  
  // Check for Person 2 patterns
  const p2Match = trimmed.match(SPEAKER_PATTERNS[1]);
  if (p2Match) {
    return {
      speaker: 'Personagem 2',
      text: trimmed.substring(p2Match[0].length).trim(),
      speakerType: 'person2'
    };
  }
  
  // Check for Narrator patterns
  const narrMatch = trimmed.match(SPEAKER_PATTERNS[2]);
  if (narrMatch) {
    return {
      speaker: 'Narrador',
      text: trimmed.substring(narrMatch[0].length).trim(),
      speakerType: 'narrator'
    };
  }
  
  // Try generic speaker detection (Name: text)
  const genericMatch = trimmed.match(/^([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s]*?)\s*[:：]\s*(.+)/);
  if (genericMatch) {
    const speakerName = genericMatch[1].trim().toLowerCase();
    // Determine type based on common names/patterns
    const isFemale = /mulher|fem|ela|she|woman|girl|senhora|menina|garota|maria|ana|julia|carla|patricia|fernanda/i.test(speakerName);
    const isNarrator = /narrador|narrator|narr/i.test(speakerName);
    
    return {
      speaker: genericMatch[1].trim(),
      text: genericMatch[2].trim(),
      speakerType: isNarrator ? 'narrator' : (isFemale ? 'person2' : 'person1')
    };
  }
  
  // Default: assume it's dialogue without explicit speaker
  return {
    speaker: '',
    text: trimmed,
    speakerType: 'narrator'
  };
}

function parseDialogue(text: string): DialogueLine[] {
  const lines = text.split('\n').filter(l => l.trim());
  const dialogueLines: DialogueLine[] = [];
  
  for (const line of lines) {
    const parsed = parseSpeaker(line);
    if (parsed.text) {
      dialogueLines.push(parsed);
    }
  }
  
  return dialogueLines;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function estimateSpeakingTime(text: string, wordsPerMinute = 150): number {
  // Calculate based on word count and adjust for punctuation pauses
  const words = text.split(/\s+/).length;
  const baseTime = (words / wordsPerMinute) * 60;
  
  // Add time for punctuation pauses
  const periods = (text.match(/[.!?]/g) || []).length * 0.3;
  const commas = (text.match(/[,;:]/g) || []).length * 0.15;
  
  // Minimum 1.5 seconds per line
  return Math.max(1.5, baseTime + periods + commas);
}

function generateDialogueSRTs(
  dialogueLines: DialogueLine[], 
  pauseBetween = 0.3,
  pauseAfterLine = 0.2
): { person1SRT: string; person2SRT: string; allEntries: SRTEntry[] } {
  const allEntries: SRTEntry[] = [];
  const person1Entries: SRTEntry[] = [];
  const person2Entries: SRTEntry[] = [];
  
  let currentTime = 0;
  let p1Index = 1;
  let p2Index = 1;
  
  for (const line of dialogueLines) {
    if (!line.text.trim()) continue;
    
    const duration = estimateSpeakingTime(line.text);
    const startTime = currentTime;
    const endTime = currentTime + duration;
    
    const entry: SRTEntry = {
      index: allEntries.length + 1,
      startTime,
      endTime,
      text: line.text, // Only the text, not the speaker name
      speaker: line.speaker
    };
    
    allEntries.push(entry);
    
    if (line.speakerType === 'person1' || line.speakerType === 'narrator') {
      person1Entries.push({ ...entry, index: p1Index++ });
    } else if (line.speakerType === 'person2') {
      person2Entries.push({ ...entry, index: p2Index++ });
    }
    
    // Add pause between speakers or after narrator
    currentTime = endTime + pauseBetween;
    
    // Extra pause after end of sentence
    if (line.text.match(/[.!?]$/)) {
      currentTime += pauseAfterLine;
    }
  }
  
  const formatSRT = (entries: SRTEntry[]): string => {
    return entries.map((entry, idx) => {
      return `${idx + 1}\n${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n${entry.text}\n`;
    }).join('\n');
  };
  
  return {
    person1SRT: formatSRT(person1Entries),
    person2SRT: formatSRT(person2Entries),
    allEntries
  };
}

export default function Dialogue() {
  const { user } = useAuth();
  const { settings } = useAISettings();
  const { templates, loading: templatesLoading, createTemplate, refetch: refetchTemplates } = usePromptTemplates('dialogue');
  
  const [activeTab, setActiveTab] = useState('generate');
  const [model, setModel] = useState<AIModel>('groq');
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEY_DIALOGUE_INPUT) || '');
  const [result, setResult] = useState(() => localStorage.getItem(STORAGE_KEY_DIALOGUE_RESULT) || '');
  const [title, setTitle] = useState(() => localStorage.getItem(STORAGE_KEY_DIALOGUE_TITLE) || '');
  const [previousResult, setPreviousResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // SRT States
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [person1SRT, setPerson1SRT] = useState('');
  const [person2SRT, setPerson2SRT] = useState('');
  const [allSRTEntries, setAllSRTEntries] = useState<SRTEntry[]>([]);
  const [person1Label, setPerson1Label] = useState('Personagem 1');
  const [person2Label, setPerson2Label] = useState('Personagem 2');
  const [copied, setCopied] = useState<string | null>(null);
  
  // Prompt settings
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [promptTemplateName, setPromptTemplateName] = useState('');
  
  // Saved dialogues
  const [savedDialogues, setSavedDialogues] = useState<Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
  }>>([]);
  
  const stopRef = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIALOGUE_INPUT, input);
  }, [input]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIALOGUE_RESULT, result);
  }, [result]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIALOGUE_TITLE, title);
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
  }, [templates, templatesLoading]);

  // Parse dialogue when result changes
  useEffect(() => {
    if (result) {
      const lines = parseDialogue(result);
      setDialogueLines(lines);
      
      // Generate SRTs
      const { person1SRT, person2SRT, allEntries } = generateDialogueSRTs(lines);
      setPerson1SRT(person1SRT);
      setPerson2SRT(person2SRT);
      setAllSRTEntries(allEntries);
    } else {
      setDialogueLines([]);
      setPerson1SRT('');
      setPerson2SRT('');
      setAllSRTEntries([]);
    }
  }, [result]);

  useEffect(() => {
    if (user) fetchSavedDialogues();
  }, [user]);

  useEffect(() => {
    if (settings?.preferred_model_script) {
      setModel(settings.preferred_model_script as AIModel);
    }
  }, [settings]);

  const fetchSavedDialogues = async () => {
    const { data } = await supabase
      .from('scripts')
      .select('id, title, content, created_at')
      .eq('user_id', user?.id)
      .eq('status', 'dialogue')
      .order('created_at', { ascending: false });

    if (data) setSavedDialogues(data);
  };

  const getApiKey = (m: AIModel): string | undefined => {
    if (m === 'groq') return settings?.groq_api_key;
    if (m === 'gemini') return settings?.gemini_api_key;
    if (['qwen', 'deepseek', 'llama'].includes(m)) return settings?.openrouter_api_key;
    return undefined;
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/^#+\s*/gm, '')
      .replace(/^\*+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const generateDialogue = async () => {
    if (!input.trim()) {
      toast.error('Cole o texto primeiro');
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
      const systemPrompt = customPrompt.trim() || DEFAULT_DIALOGUE_PROMPT;

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt: `Transforme este texto em um diálogo profissional:\n\n${input}`,
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
      toast.success(`Diálogo gerado! (${cleanedText.length} caracteres)`);
    } catch (error) {
      console.error('Error generating dialogue:', error);
      toast.error('Erro ao gerar diálogo');
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
      type: 'dialogue',
      content: customPrompt || DEFAULT_DIALOGUE_PROMPT,
      is_default: templates.length === 0,
    });
    
    if (newTemplate) {
      setSelectedTemplateId(newTemplate.id);
      await refetchTemplates();
    }
    
    setPromptTemplateName('');
    toast.success('Template salvo!');
  };

  const saveDialogue = async () => {
    if (!result.trim() || !title.trim()) {
      toast.error('Adicione título e gere um diálogo primeiro');
      return;
    }

    try {
      const { error } = await supabase
        .from('scripts')
        .insert({
          user_id: user!.id,
          title,
          content: result,
          status: 'dialogue',
        });

      if (error) throw error;

      toast.success('Diálogo salvo!');
      fetchSavedDialogues();
      
      // Clear after save
      localStorage.removeItem(STORAGE_KEY_DIALOGUE_RESULT);
      localStorage.removeItem(STORAGE_KEY_DIALOGUE_TITLE);
      setResult('');
      setTitle('');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const loadDialogue = (saved: typeof savedDialogues[0]) => {
    setTitle(saved.title);
    setResult(saved.content);
    setActiveTab('generate');
    toast.success('Diálogo carregado');
  };

  const deleteDialogue = async (id: string) => {
    if (!confirm('Excluir este diálogo?')) return;
    
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (!error) {
      toast.success('Diálogo excluído');
      fetchSavedDialogues();
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success('Diálogo copiado!');
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

  const copySRT = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    toast.success('SRT copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadSRT = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveSRTsToDatabase = async () => {
    if (!person1SRT && !person2SRT) {
      toast.error('Gere os SRTs primeiro');
      return;
    }

    try {
      const subtitlesToSave = [];
      
      if (person1SRT) {
        subtitlesToSave.push({
          user_id: user!.id,
          title: `${title || 'Diálogo'} - ${person1Label}`,
          content: person1SRT,
          source_script_ids: []
        });
      }
      
      if (person2SRT) {
        subtitlesToSave.push({
          user_id: user!.id,
          title: `${title || 'Diálogo'} - ${person2Label}`,
          content: person2SRT,
          source_script_ids: []
        });
      }

      const { error } = await supabase.from('subtitles').insert(subtitlesToSave);
      if (error) throw error;

      toast.success('SRTs salvos com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar SRTs: ' + error.message);
    }
  };

  const hasApiKey = !!getApiKey(model);

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <MessageSquare className="w-6 h-6 md:w-7 md:h-7 text-primary" />
            Diálogo
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gere diálogos e SRTs separados por personagem
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 text-xs md:text-sm">
          <TabsTrigger value="generate">Gerar Diálogo</TabsTrigger>
          <TabsTrigger value="srt">SRTs ({dialogueLines.length} falas)</TabsTrigger>
          <TabsTrigger value="saved">Salvos ({savedDialogues.length})</TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4 mt-4 md:mt-6">
          {/* Title */}
          <div>
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do diálogo..."
              className="mt-1"
            />
          </div>

          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Texto Base</Label>
              <span className="text-xs text-muted-foreground">
                {input.length.toLocaleString()} caracteres
              </span>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cole aqui o texto para transformar em diálogo..."
              className="min-h-[150px]"
            />
          </div>

          {/* Prompt Settings */}
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
                <Label>Prompt de Conversão</Label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={DEFAULT_DIALOGUE_PROMPT}
                  className="mt-1 min-h-[150px] text-xs"
                />
              </div>
              
              <div>
                <Label>Templates Salvos</Label>
                {templatesLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Carregando...</p>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum template</p>
                ) : (
                  <Select 
                    value={selectedTemplateId} 
                    onValueChange={(id) => {
                      const t = templates.find(t => t.id === id);
                      if (t) {
                        setSelectedTemplateId(id);
                        setCustomPrompt(t.content);
                        toast.success(`Template "${t.name}" carregado`);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.is_default && '⭐'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do template..."
                  value={promptTemplateName}
                  onChange={(e) => setPromptTemplateName(e.target.value)}
                />
                <Button variant="secondary" size="sm" onClick={savePromptTemplate}>
                  Salvar
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* AI Model */}
          <div>
            <Label>Modelo de IA</Label>
            <Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
              <SelectTrigger className="mt-1">
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
                onClick={generateDialogue}
                disabled={!hasApiKey || !input.trim()}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Gerar Diálogo
              </Button>
            )}
          </div>

          {!hasApiKey && (
            <p className="text-sm text-destructive text-center">
              Configure a API Key nas configurações
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Diálogo Gerado</Label>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[85vh]">
                      <DialogHeader>
                        <DialogTitle>{title || 'Diálogo'}</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[60vh] mt-4">
                        <div className="space-y-3 p-4">
                          {dialogueLines.map((line, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3 rounded-lg ${
                                line.speakerType === 'person1' 
                                  ? 'bg-blue-500/10 border-l-4 border-blue-500' 
                                  : line.speakerType === 'person2'
                                  ? 'bg-pink-500/10 border-l-4 border-pink-500'
                                  : 'bg-muted border-l-4 border-muted-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {line.speakerType === 'person1' ? (
                                  <User className="w-4 h-4 text-blue-500" />
                                ) : line.speakerType === 'person2' ? (
                                  <UserCircle2 className="w-4 h-4 text-pink-500" />
                                ) : (
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="text-xs font-semibold">
                                  {line.speaker || 'Narrador'}
                                </span>
                              </div>
                              <p className="text-sm">{line.text}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                  <Button variant="secondary" size="sm" onClick={copyResult}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  {previousResult && (
                    <Button variant="ghost" size="sm" onClick={undoResult}>
                      <Undo2 className="w-4 h-4 mr-2" />
                      Desfazer
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
                rows={12}
                className="font-mono text-sm"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {dialogueLines.length} falas detectadas | {result.length.toLocaleString()} caracteres
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={generateDialogue} disabled={isGenerating}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Gerar Novamente
                  </Button>
                  <Button variant="fire" size="sm" onClick={saveDialogue} disabled={!title.trim()}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* SRT Tab */}
        <TabsContent value="srt" className="space-y-4 mt-4 md:mt-6">
          {dialogueLines.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum diálogo para converter</p>
              <p className="text-sm mt-2">Gere um diálogo primeiro na aba "Gerar Diálogo"</p>
            </div>
          ) : (
            <>
              {/* Speaker Labels */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    Nome do Personagem 1
                  </Label>
                  <Input
                    value={person1Label}
                    onChange={(e) => setPerson1Label(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4 text-pink-500" />
                    Nome do Personagem 2
                  </Label>
                  <Input
                    value={person2Label}
                    onChange={(e) => setPerson2Label(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Timeline Preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Preview da Timeline</span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Completo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[85vh]">
                        <DialogHeader>
                          <DialogTitle>Timeline Completa</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] mt-4">
                          <div className="space-y-2 p-4">
                            {allSRTEntries.map((entry, idx) => {
                              const line = dialogueLines[idx];
                              return (
                                <div 
                                  key={idx}
                                  className={`flex items-start gap-4 p-3 rounded ${
                                    line?.speakerType === 'person1' 
                                      ? 'bg-blue-500/10' 
                                      : line?.speakerType === 'person2'
                                      ? 'bg-pink-500/10'
                                      : 'bg-muted/50'
                                  }`}
                                >
                                  <div className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                                    {formatTime(entry.startTime).substring(0, 8)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-semibold mb-1">
                                      {line?.speakerType === 'person1' ? person1Label : 
                                       line?.speakerType === 'person2' ? person2Label : 'Narrador'}
                                    </div>
                                    <p className="text-sm">{entry.text}</p>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {(entry.endTime - entry.startTime).toFixed(1)}s
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {allSRTEntries.slice(0, 5).map((entry, idx) => {
                      const line = dialogueLines[idx];
                      return (
                        <div 
                          key={idx}
                          className={`flex items-center gap-2 text-xs p-2 rounded ${
                            line?.speakerType === 'person1' 
                              ? 'bg-blue-500/10' 
                              : line?.speakerType === 'person2'
                              ? 'bg-pink-500/10'
                              : 'bg-muted/50'
                          }`}
                        >
                          <span className="font-mono text-muted-foreground">
                            {formatTime(entry.startTime).substring(3, 8)}
                          </span>
                          <span className="flex-1 truncate">{entry.text}</span>
                        </div>
                      );
                    })}
                    {allSRTEntries.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        + {allSRTEntries.length - 5} mais falas...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* SRT Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Person 1 SRT */}
                <Card className="border-blue-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500" />
                      {person1Label}
                      <span className="text-muted-foreground font-normal">
                        ({person1SRT.split('\n\n').filter(b => b.trim()).length} blocos)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="max-h-[150px] overflow-y-auto bg-muted/50 p-2 rounded text-xs font-mono cursor-pointer hover:bg-muted transition-colors">
                          <pre className="whitespace-pre-wrap">{person1SRT.substring(0, 500)}...</pre>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[85vh]">
                        <DialogHeader>
                          <DialogTitle>SRT - {person1Label}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] mt-4">
                          <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-muted rounded-lg">
                            {person1SRT}
                          </pre>
                        </ScrollArea>
                        <div className="flex gap-2 mt-4">
                          <Button variant="secondary" onClick={() => copySRT(person1SRT, 'p1')} className="flex-1">
                            {copied === 'p1' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            Copiar
                          </Button>
                          <Button variant="fire" onClick={() => downloadSRT(person1SRT, `${title || 'dialogo'}_${person1Label}`)} className="flex-1">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copySRT(person1SRT, 'p1')} className="flex-1">
                        {copied === 'p1' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadSRT(person1SRT, `${title || 'dialogo'}_${person1Label}`)} className="flex-1">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Person 2 SRT */}
                <Card className="border-pink-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <UserCircle2 className="w-4 h-4 text-pink-500" />
                      {person2Label}
                      <span className="text-muted-foreground font-normal">
                        ({person2SRT.split('\n\n').filter(b => b.trim()).length} blocos)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="max-h-[150px] overflow-y-auto bg-muted/50 p-2 rounded text-xs font-mono cursor-pointer hover:bg-muted transition-colors">
                          <pre className="whitespace-pre-wrap">{person2SRT.substring(0, 500) || 'Nenhuma fala detectada'}...</pre>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[85vh]">
                        <DialogHeader>
                          <DialogTitle>SRT - {person2Label}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] mt-4">
                          <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-muted rounded-lg">
                            {person2SRT || 'Nenhuma fala detectada para este personagem'}
                          </pre>
                        </ScrollArea>
                        <div className="flex gap-2 mt-4">
                          <Button variant="secondary" onClick={() => copySRT(person2SRT, 'p2')} className="flex-1" disabled={!person2SRT}>
                            {copied === 'p2' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            Copiar
                          </Button>
                          <Button variant="fire" onClick={() => downloadSRT(person2SRT, `${title || 'dialogo'}_${person2Label}`)} className="flex-1" disabled={!person2SRT}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copySRT(person2SRT, 'p2')} className="flex-1" disabled={!person2SRT}>
                        {copied === 'p2' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadSRT(person2SRT, `${title || 'dialogo'}_${person2Label}`)} className="flex-1" disabled={!person2SRT}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Save SRTs Button */}
              <Button variant="fire" className="w-full" onClick={saveSRTsToDatabase}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Ambos SRTs
              </Button>
            </>
          )}
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="mt-4 md:mt-6">
          {savedDialogues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum diálogo salvo</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {savedDialogues.map((dialogue) => (
                <div key={dialogue.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadDialogue(dialogue)}>
                      <h4 className="font-medium text-foreground truncate">{dialogue.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(dialogue.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <pre className="text-xs text-muted-foreground mt-2 line-clamp-2 font-mono whitespace-pre-wrap bg-muted p-2 rounded">
                        {dialogue.content.substring(0, 150)}...
                      </pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => loadDialogue(dialogue)} title="Carregar">
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive" 
                        onClick={() => deleteDialogue(dialogue.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

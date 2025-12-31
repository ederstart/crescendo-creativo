import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, Download, Trash2, Copy, Check, Plus, Subtitles as SubtitlesIcon, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Script { id: string; title: string; content: string; }
interface Subtitle { id: string; title: string; content: string; source_script_ids: string[]; created_at: string; }

// Split text into complete sentences
function splitIntoSentences(text: string): string[] {
  // First normalize the text - remove extra whitespace and normalize line breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Split by sentence-ending punctuation followed by space or end
  // This regex captures complete sentences ending in . ! or ?
  const sentences: string[] = [];
  let current = '';
  
  for (let i = 0; i < normalized.length; i++) {
    current += normalized[i];
    
    // Check if this is end of sentence
    if ('.!?'.includes(normalized[i])) {
      const nextChar = normalized[i + 1];
      // If next char is space, quote, or end of string, it's end of sentence
      if (!nextChar || nextChar === ' ' || nextChar === '"' || nextChar === "'") {
        const sentence = current.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
        current = '';
      }
    }
  }
  
  // Don't forget remaining text
  if (current.trim().length > 0) {
    sentences.push(current.trim());
  }
  
  return sentences;
}

// Group sentences to fit within max chars, respecting sentence boundaries
function groupSentences(sentences: string[], maxChars: number): string[] {
  const groups: string[] = [];
  let currentGroup = '';
  
  for (const sentence of sentences) {
    // If single sentence is too long, we need to split it by words
    if (sentence.length > maxChars) {
      // First, save current group if exists
      if (currentGroup.trim()) {
        groups.push(currentGroup.trim());
        currentGroup = '';
      }
      
      // Split long sentence by words
      const words = sentence.split(' ');
      let chunk = '';
      for (const word of words) {
        if ((chunk + ' ' + word).trim().length <= maxChars) {
          chunk = (chunk + ' ' + word).trim();
        } else {
          if (chunk) groups.push(chunk);
          chunk = word;
        }
      }
      if (chunk) groups.push(chunk);
      continue;
    }
    
    // Check if adding this sentence would exceed limit
    const testGroup = currentGroup ? currentGroup + ' ' + sentence : sentence;
    
    if (testGroup.length <= maxChars) {
      currentGroup = testGroup;
    } else {
      // Save current group and start new one
      if (currentGroup.trim()) {
        groups.push(currentGroup.trim());
      }
      currentGroup = sentence;
    }
  }
  
  // Don't forget the last group
  if (currentGroup.trim()) {
    groups.push(currentGroup.trim());
  }
  
  return groups;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},000`;
}

// Generate SRT respecting sentence boundaries
function generateSRT(text: string, charsPerSubtitle = 500, displaySeconds = 30, pauseSeconds = 20): string {
  const sentences = splitIntoSentences(text);
  const parts = groupSentences(sentences, charsPerSubtitle);
  
  const srtLines: string[] = [];
  parts.forEach((part, index) => {
    const startTime = index * (displaySeconds + pauseSeconds);
    const endTime = startTime + displaySeconds;
    srtLines.push(`${index + 1}`);
    srtLines.push(`${formatTime(startTime)} --> ${formatTime(endTime)}`);
    srtLines.push(part);
    srtLines.push('');
  });
  return srtLines.join('\n');
}

export default function Subtitles() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('generate');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedScripts, setSelectedScripts] = useState<Script[]>([]);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [generatedSRT, setGeneratedSRT] = useState('');

  useEffect(() => { if (location.state?.selectedScripts) { setSelectedScripts(location.state.selectedScripts); setActiveTab('generate'); } }, [location.state]);
  useEffect(() => { if (user) fetchSubtitles(); }, [user]);

  const fetchSubtitles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('subtitles').select('*').eq('user_id', user?.id).order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar legendas');
    else setSubtitles(data || []);
    setLoading(false);
  };

  const generateFromScripts = async () => {
    if (selectedScripts.length === 0) { toast.error('Selecione pelo menos um roteiro'); return; }
    setGenerating(true);
    try {
      const insertPromises = selectedScripts.map(async (script) => {
        if (!script.content?.trim()) return null;
        const srt = generateSRT(script.content);
        return supabase.from('subtitles').insert({ user_id: user?.id, title: `Legenda - ${script.title}`, content: srt, source_script_ids: [script.id] });
      });
      await Promise.all(insertPromises.filter(Boolean));
      toast.success(`${selectedScripts.length} legenda(s) SRT gerada(s)!`);
      setSelectedScripts([]);
      fetchSubtitles();
      setActiveTab('saved');
    } catch (error: any) { toast.error('Erro ao gerar legendas: ' + error.message); }
    finally { setGenerating(false); }
  };

  const generateManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) { toast.error('Preencha o título e o conteúdo'); return; }
    setGenerating(true);
    try {
      const srt = generateSRT(manualContent);
      setGeneratedSRT(srt);
      const { error } = await supabase.from('subtitles').insert({ user_id: user?.id, title: manualTitle, content: srt, source_script_ids: [] });
      if (error) throw error;
      toast.success('Legenda SRT gerada e salva!');
      setManualTitle(''); setManualContent('');
      fetchSubtitles();
    } catch (error: any) { toast.error('Erro ao gerar legenda: ' + error.message); }
    finally { setGenerating(false); }
  };

  const deleteSubtitle = async (id: string) => {
    const { error } = await supabase.from('subtitles').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir legenda');
    else { toast.success('Legenda excluída'); fetchSubtitles(); }
  };

  const downloadSRT = (subtitle: Subtitle) => {
    const blob = new Blob([subtitle.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${subtitle.title.replace(/[^a-zA-Z0-9]/g, '_')}.srt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const copySRT = async (content: string, id: string) => { await navigator.clipboard.writeText(content); setCopied(id); toast.success('SRT copiado!'); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground flex items-center gap-3"><SubtitlesIcon className="w-6 h-6 md:w-7 md:h-7 text-primary" />Legendas SRT</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Gere legendas SRT a partir dos seus roteiros</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 text-xs md:text-sm">
          <TabsTrigger value="generate">Gerar de Roteiros</TabsTrigger>
          <TabsTrigger value="manual">Gerar Manual</TabsTrigger>
          <TabsTrigger value="saved">Salvas ({subtitles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 mt-4 md:mt-6">
          {selectedScripts.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <Label className="text-sm text-muted-foreground">Roteiros Selecionados ({selectedScripts.length})</Label>
                <div className="mt-3 space-y-2">
                  {selectedScripts.map((script) => (
                    <div key={script.id} className="flex items-center gap-2 text-sm bg-background rounded-md p-2">
                      <FileText className="w-4 h-4 text-primary" /><span className="flex-1 truncate">{script.title}</span>
                      <span className="text-xs text-muted-foreground">{script.content?.length || 0} chars</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
                <p className="font-medium text-primary">Configurações:</p>
                <p className="text-muted-foreground">• Máx. 500 caracteres por legenda</p>
                <p className="text-muted-foreground">• 30 segundos de exibição</p>
                <p className="text-muted-foreground">• 20 segundos de pausa entre blocos</p>
              </div>
              <Button onClick={generateFromScripts} disabled={generating} variant="fire" className="w-full" size="lg">
                {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</> : <><Plus className="w-4 h-4 mr-2" />Gerar {selectedScripts.length} SRT(s)</>}
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum roteiro selecionado</p>
              <p className="text-sm mt-2">Vá até a aba "Roteiros" e selecione os roteiros para converter.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4 mt-4 md:mt-6">
          <div><Label>Título</Label><Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Ex: Legenda do Vídeo 1" className="mt-1" /></div>
          <div><Label>Conteúdo</Label><Textarea value={manualContent} onChange={(e) => setManualContent(e.target.value)} placeholder="Cole o texto do roteiro..." rows={10} className="mt-1 font-mono text-sm" /></div>
          <Button onClick={generateManual} disabled={generating || !manualTitle.trim() || !manualContent.trim()} variant="fire" className="w-full" size="lg">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</> : <><Plus className="w-4 h-4 mr-2" />Gerar SRT</>}
          </Button>
          {generatedSRT && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>SRT Gerado</Label><Button size="sm" variant="secondary" onClick={() => copySRT(generatedSRT, 'manual')}>{copied === 'manual' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button></div>
              <Textarea value={generatedSRT} readOnly rows={8} className="font-mono text-xs" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4 md:mt-6">
          {loading ? <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div> : subtitles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><SubtitlesIcon className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-lg font-medium">Nenhuma legenda ainda</p></div>
          ) : (
            <div className="grid gap-4">
              {subtitles.map((subtitle) => (
                <div key={subtitle.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{subtitle.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(subtitle.created_at).toLocaleDateString('pt-BR')}</p>
                      <pre className="text-xs text-muted-foreground mt-2 line-clamp-3 font-mono whitespace-pre-wrap bg-muted p-2 rounded">{subtitle.content.substring(0, 200)}...</pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Ver completo"><Eye className="w-4 h-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh]">
                          <DialogHeader>
                            <DialogTitle>{subtitle.title}</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] mt-4">
                            <pre className="text-sm font-mono whitespace-pre-wrap p-4 bg-muted rounded-lg">
                              {subtitle.content}
                            </pre>
                          </ScrollArea>
                          <div className="flex gap-2 mt-4">
                            <Button variant="secondary" onClick={() => copySRT(subtitle.content, subtitle.id)} className="flex-1">
                              {copied === subtitle.id ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                              Copiar
                            </Button>
                            <Button variant="fire" onClick={() => downloadSRT(subtitle)} className="flex-1">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="icon" variant="ghost" onClick={() => copySRT(subtitle.content, subtitle.id)}>{copied === subtitle.id ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}</Button>
                      <Button size="icon" variant="ghost" onClick={() => downloadSRT(subtitle)}><Download className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteSubtitle(subtitle.id)}><Trash2 className="w-4 h-4" /></Button>
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

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  FileText, 
  Download, 
  Trash2, 
  Copy, 
  Check,
  Plus,
  Subtitles as SubtitlesIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Script {
  id: string;
  title: string;
  content: string;
}

interface Subtitle {
  id: string;
  title: string;
  content: string;
  source_script_ids: string[];
  created_at: string;
}

function splitTextSafely(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChars, text.length);
    
    if (endIndex < text.length) {
      const lastSpace = text.lastIndexOf(' ', endIndex);
      if (lastSpace > currentIndex) {
        endIndex = lastSpace;
      }
    }
    
    const part = text.substring(currentIndex, endIndex).trim();
    if (part) {
      parts.push(part);
    }
    
    currentIndex = endIndex + 1;
  }
  
  return parts;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function generateSRT(text: string, charsPerSubtitle: number = 500, intervalSeconds: number = 30): string {
  const parts = splitTextSafely(text, charsPerSubtitle);
  const srtLines: string[] = [];
  
  parts.forEach((part, index) => {
    const startTime = index * intervalSeconds;
    const endTime = startTime + intervalSeconds - 1;
    
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
  
  // Scripts from navigation state
  const [selectedScripts, setSelectedScripts] = useState<Script[]>([]);
  
  // Manual generation state
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [generatedSRT, setGeneratedSRT] = useState('');

  useEffect(() => {
    if (location.state?.selectedScripts) {
      setSelectedScripts(location.state.selectedScripts);
      setActiveTab('generate');
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      fetchSubtitles();
    }
  }, [user]);

  const fetchSubtitles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subtitles')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar legendas');
    } else {
      setSubtitles(data || []);
    }
    setLoading(false);
  };

  const generateFromScripts = async () => {
    if (selectedScripts.length === 0) {
      toast.error('Selecione pelo menos um roteiro');
      return;
    }

    setGenerating(true);
    
    try {
      // Generate individual SRT for each script
      const insertPromises = selectedScripts.map(async (script) => {
        if (!script.content?.trim()) return null;
        
        const srt = generateSRT(script.content);
        const title = `Legenda - ${script.title}`;
        
        return supabase
          .from('subtitles')
          .insert({
            user_id: user?.id,
            title,
            content: srt,
            source_script_ids: [script.id],
          });
      });

      const results = await Promise.all(insertPromises.filter(Boolean));
      
      const errors = results.filter(r => r?.error);
      if (errors.length > 0) {
        throw new Error('Alguns SRTs falharam ao gerar');
      }
      
      toast.success(`${selectedScripts.length} legenda(s) SRT gerada(s) com sucesso!`);
      setSelectedScripts([]);
      fetchSubtitles();
      setActiveTab('saved');
    } catch (error: any) {
      toast.error('Erro ao gerar legendas: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      toast.error('Preencha o título e o conteúdo');
      return;
    }

    setGenerating(true);
    
    try {
      const srt = generateSRT(manualContent);
      setGeneratedSRT(srt);
      
      const { error } = await supabase
        .from('subtitles')
        .insert({
          user_id: user?.id,
          title: manualTitle,
          content: srt,
          source_script_ids: [],
        });

      if (error) throw error;
      
      toast.success('Legenda SRT gerada e salva!');
      setManualTitle('');
      setManualContent('');
      fetchSubtitles();
    } catch (error: any) {
      toast.error('Erro ao gerar legenda: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const deleteSubtitle = async (id: string) => {
    const { error } = await supabase
      .from('subtitles')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir legenda');
    } else {
      toast.success('Legenda excluída');
      fetchSubtitles();
    }
  };

  const downloadSRT = (subtitle: Subtitle) => {
    const blob = new Blob([subtitle.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subtitle.title.replace(/[^a-zA-Z0-9]/g, '_')}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySRT = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    toast.success('SRT copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <SubtitlesIcon className="w-7 h-7 text-primary" />
            Legendas SRT
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere legendas SRT a partir dos seus roteiros
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Gerar de Roteiros</TabsTrigger>
          <TabsTrigger value="manual">Gerar Manual</TabsTrigger>
          <TabsTrigger value="saved">
            Legendas Salvas ({subtitles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 mt-6">
          {selectedScripts.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <Label className="text-sm text-muted-foreground">Roteiros Selecionados ({selectedScripts.length})</Label>
                <div className="mt-3 space-y-2">
                  {selectedScripts.map((script) => (
                    <div key={script.id} className="flex items-center gap-2 text-sm bg-background rounded-md p-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="flex-1">{script.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {script.content?.length || 0} caracteres
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm space-y-1">
                <p className="font-medium text-primary">Configurações de geração:</p>
                <p className="text-muted-foreground">• Cada legenda terá no máximo 500 caracteres</p>
                <p className="text-muted-foreground">• Intervalo de 30 segundos entre legendas</p>
                <p className="text-muted-foreground">• Palavras não serão cortadas no meio</p>
                <p className="text-muted-foreground">• Cada roteiro gerará um arquivo SRT individual</p>
              </div>
              
              <Button 
                onClick={generateFromScripts} 
                disabled={generating}
                variant="fire"
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Gerar {selectedScripts.length} SRT(s) Individual(is)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum roteiro selecionado</p>
              <p className="text-sm mt-2">
                Vá até a aba "Roteiros" e use os checkboxes para selecionar os roteiros que deseja converter em SRT.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4 mt-6">
          <div>
            <Label>Título da Legenda</Label>
            <Input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Ex: Legenda do Vídeo 1"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>Conteúdo do Roteiro</Label>
            <Textarea
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              placeholder="Cole aqui o texto do roteiro para converter em SRT..."
              rows={12}
              className="mt-1 font-mono text-sm"
            />
          </div>
          
          <Button 
            onClick={generateManual} 
            disabled={generating || !manualTitle.trim() || !manualContent.trim()}
            variant="fire"
            className="w-full"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Gerar SRT
              </>
            )}
          </Button>

          {generatedSRT && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SRT Gerado</Label>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => copySRT(generatedSRT, 'manual')}
                >
                  {copied === 'manual' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Textarea
                value={generatedSRT}
                readOnly
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : subtitles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <SubtitlesIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma legenda gerada ainda</p>
              <p className="text-sm mt-2">Gere legendas a partir de roteiros ou manualmente</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {subtitles.map((subtitle) => (
                <div 
                  key={subtitle.id} 
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{subtitle.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Criado em {new Date(subtitle.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <pre className="text-xs text-muted-foreground mt-3 line-clamp-3 font-mono whitespace-pre-wrap bg-muted p-2 rounded">
                        {subtitle.content.substring(0, 200)}...
                      </pre>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => copySRT(subtitle.content, subtitle.id)}
                        title="Copiar SRT"
                      >
                        {copied === subtitle.id ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => downloadSRT(subtitle)}
                        title="Baixar SRT"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteSubtitle(subtitle.id)}
                        title="Excluir"
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

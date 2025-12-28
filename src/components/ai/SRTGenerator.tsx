import { useState, useEffect } from 'react';
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
  Plus
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

interface SRTGeneratorProps {
  selectedScripts?: Script[];
}

function splitTextSafely(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    let endIndex = Math.min(currentIndex + maxChars, text.length);
    
    // If we're not at the end and the cut would be in the middle of a word
    if (endIndex < text.length) {
      // Find the last space before the limit
      const lastSpace = text.lastIndexOf(' ', endIndex);
      if (lastSpace > currentIndex) {
        endIndex = lastSpace;
      }
    }
    
    const part = text.substring(currentIndex, endIndex).trim();
    if (part) {
      parts.push(part);
    }
    
    currentIndex = endIndex + 1; // Skip the space
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
    const endTime = startTime + intervalSeconds - 1; // 1 second gap
    
    srtLines.push(`${index + 1}`);
    srtLines.push(`${formatTime(startTime)} --> ${formatTime(endTime)}`);
    srtLines.push(part);
    srtLines.push('');
  });
  
  return srtLines.join('\n');
}

export function SRTGenerator({ selectedScripts = [] }: SRTGeneratorProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Manual generation state
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [generatedSRT, setGeneratedSRT] = useState('');
  const [copied, setCopied] = useState(false);

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
      // Combine all script contents
      const combinedContent = selectedScripts
        .map(s => s.content || '')
        .filter(c => c.trim())
        .join('\n\n');
      
      const srt = generateSRT(combinedContent);
      const title = selectedScripts.length === 1 
        ? `Legenda - ${selectedScripts[0].title}`
        : `Legenda - ${selectedScripts.length} roteiros`;
      
      const { error } = await supabase
        .from('subtitles')
        .insert({
          user_id: user?.id,
          title,
          content: srt,
          source_script_ids: selectedScripts.map(s => s.id),
        });

      if (error) throw error;
      
      toast.success('Legenda SRT gerada com sucesso!');
      fetchSubtitles();
      setActiveTab('saved');
    } catch (error: any) {
      toast.error('Erro ao gerar legenda: ' + error.message);
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

  const copySRT = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('SRT copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Gerar de Roteiros</TabsTrigger>
          <TabsTrigger value="manual">Gerar Manual</TabsTrigger>
          <TabsTrigger value="saved">
            Legendas Salvas ({subtitles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 mt-4">
          {selectedScripts.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <Label className="text-sm text-muted-foreground">Roteiros Selecionados</Label>
                <div className="mt-2 space-y-2">
                  {selectedScripts.map((script) => (
                    <div key={script.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-primary" />
                      <span>{script.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>• Cada legenda terá no máximo 500 caracteres</p>
                <p>• Intervalo de 30 segundos entre legendas</p>
                <p>• Palavras não serão cortadas no meio</p>
              </div>
              
              <Button 
                onClick={generateFromScripts} 
                disabled={generating}
                variant="fire"
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Gerar SRT dos Roteiros Selecionados
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Selecione roteiros na aba "Roteiros" para gerar legendas</p>
              <p className="text-sm mt-2">Use os checkboxes para selecionar múltiplos roteiros</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4 mt-4">
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
              rows={10}
              className="mt-1 font-mono text-sm"
            />
          </div>
          
          <Button 
            onClick={generateManual} 
            disabled={generating || !manualTitle.trim() || !manualContent.trim()}
            variant="fire"
            className="w-full"
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
                  onClick={() => copySRT(generatedSRT)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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

        <TabsContent value="saved" className="mt-4">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : subtitles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma legenda gerada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subtitles.map((subtitle) => (
                <div 
                  key={subtitle.id} 
                  className="bg-muted rounded-lg p-4 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground">{subtitle.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(subtitle.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <pre className="text-xs text-muted-foreground mt-2 line-clamp-3 font-mono whitespace-pre-wrap">
                        {subtitle.content.substring(0, 200)}...
                      </pre>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => copySRT(subtitle.content)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => downloadSRT(subtitle)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteSubtitle(subtitle.id)}
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
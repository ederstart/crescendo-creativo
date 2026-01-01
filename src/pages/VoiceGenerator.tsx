import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Volume2, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  RefreshCw, 
  Loader2,
  Star,
  List,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Archive,
  StopCircle
} from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { toast } from 'sonner';
import { useVoiceGenerator } from '@/hooks/useVoiceGenerator';
import { generateSpeech, isModelLoaded, isModelLoading, getLoadProgress, type TTSVoice } from '@/lib/kokoroTTS';
import JSZip from 'jszip';

// Kokoro TTS voices - English only (American and British)
const KOKORO_VOICES: Record<string, { id: TTSVoice; name: string; gender: 'male' | 'female'; quality?: string }[]> = {
  'en-US': [
    { id: 'af_heart', name: 'Heart', gender: 'female', quality: 'A' },
    { id: 'af_bella', name: 'Bella', gender: 'female', quality: 'A-' },
    { id: 'af_sarah', name: 'Sarah', gender: 'female', quality: 'C+' },
    { id: 'af_nicole', name: 'Nicole', gender: 'female', quality: 'B-' },
    { id: 'af_nova', name: 'Nova', gender: 'female', quality: 'C' },
    { id: 'af_sky', name: 'Sky', gender: 'female', quality: 'C-' },
    { id: 'am_michael', name: 'Michael', gender: 'male', quality: 'C+' },
    { id: 'am_fenrir', name: 'Fenrir', gender: 'male', quality: 'C+' },
    { id: 'am_adam', name: 'Adam', gender: 'male', quality: 'F+' },
    { id: 'am_puck', name: 'Puck', gender: 'male', quality: 'C+' },
    { id: 'am_santa', name: 'Santa', gender: 'male', quality: 'D-' },
  ],
  'en-GB': [
    { id: 'bf_emma', name: 'Emma', gender: 'female', quality: 'B-' },
    { id: 'bf_isabella', name: 'Isabella', gender: 'female', quality: 'C' },
    { id: 'bf_alice', name: 'Alice', gender: 'female', quality: 'D' },
    { id: 'bf_lily', name: 'Lily', gender: 'female', quality: 'D' },
    { id: 'bm_george', name: 'George', gender: 'male', quality: 'C' },
    { id: 'bm_lewis', name: 'Lewis', gender: 'male', quality: 'D+' },
    { id: 'bm_daniel', name: 'Daniel', gender: 'male', quality: 'D' },
    { id: 'bm_fable', name: 'Fable', gender: 'male', quality: 'C' },
  ],
};

const LANGUAGE_LABELS: Record<string, string> = {
  'en-US': '🇺🇸 English (US)',
  'en-GB': '🇬🇧 English (UK)',
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface BatchItem {
  index: number;
  text: string;
  status: 'pending' | 'generating' | 'success' | 'failed' | 'skipped';
  audioBlob?: Blob;
  audioUrl?: string;
  retries: number;
  error?: string;
}

export default function VoiceGenerator() {
  const { 
    generatedAudios, 
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios,
  } = useVoiceGenerator();

  const { settings, saveSettings } = useAISettings();

  // Single mode state
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [voiceId, setVoiceId] = useState<TTSVoice>('af_heart');
  const [loading, setLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Batch mode state
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const abortBatchRef = useRef(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load preferred voice
  useEffect(() => {
    if (settings?.preferred_voice) {
      const parts = settings.preferred_voice.split('|');
      if (parts.length === 2) {
        setLanguage(parts[0]);
        setVoiceId(parts[1] as TTSVoice);
      }
    }
  }, [settings?.preferred_voice]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update voice when language changes
  useEffect(() => {
    const voices = KOKORO_VOICES[language] || [];
    if (voices.length > 0 && !voices.find(v => v.id === voiceId)) {
      setVoiceId(voices[0].id);
    }
  }, [language, voiceId]);

  // Check model loading status
  useEffect(() => {
    if (isModelLoading()) {
      const interval = setInterval(() => {
        setModelLoadProgress(getLoadProgress());
        if (!isModelLoading()) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loading, batchProcessing]);

  // Single generation
  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto para gerar áudio');
      return;
    }

    setLoading(true);
    setModelLoadProgress(0);

    try {
      if (!isModelLoaded()) {
        toast.info('Carregando modelo de voz (~80MB)... Isso só acontece uma vez!');
      }

      const audioBlob = await generateSpeech(text, {
        voice: voiceId,
        speed: playbackSpeed,
        onProgress: setModelLoadProgress,
      });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audioElement = new Audio(audioUrl);
      audioElement.playbackRate = playbackSpeed;
      audioRef.current = audioElement;
      setCurrentAudioUrl(audioUrl);
      
      audioElement.play();
      setIsPlaying(true);
      audioElement.onended = () => setIsPlaying(false);

      try {
        const savedAudio = await saveGeneratedAudio(
          audioBlob, 
          text, 
          `kokoro-${voiceId}`, 
          undefined, 
          audioElement.duration || undefined
        );
        if (savedAudio) {
          refetchAudios();
        }
      } catch (saveError) {
        console.warn('Could not save audio:', saveError);
      }
      
      toast.success('Áudio gerado localmente!');
    } catch (error) {
      console.error('Error generating audio:', error);
      toast.error('Erro ao gerar áudio. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Parse batch text into items
  const parseBatchText = () => {
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const items: BatchItem[] = lines.map((text, index) => ({
      index,
      text,
      status: 'pending',
      retries: 0,
    }));
    setBatchItems(items);
    return items;
  };

  // Generate single item with retries
  const generateItemWithRetry = async (item: BatchItem, maxRetries: number = 3): Promise<BatchItem> => {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const audioBlob = await generateSpeech(item.text, {
          voice: voiceId,
          speed: playbackSpeed,
        });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        return {
          ...item,
          status: 'success',
          audioBlob,
          audioUrl,
          retries,
        };
      } catch (error) {
        retries++;
        item.retries = retries;
        
        if (retries < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          return {
            ...item,
            status: 'failed',
            retries,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          };
        }
      }
    }
    
    return { ...item, status: 'failed', retries };
  };

  // Process batch
  const handleBatchGenerate = async () => {
    const items = parseBatchText();
    if (items.length === 0) {
      toast.error('Adicione textos para gerar (um por linha)');
      return;
    }

    setBatchProcessing(true);
    abortBatchRef.current = false;
    setBatchProgress(0);

    if (!isModelLoaded()) {
      toast.info('Carregando modelo de voz (~80MB)... Isso só acontece uma vez!');
    }

    const results: BatchItem[] = [...items];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (abortBatchRef.current) {
        // Mark remaining as skipped
        for (let j = i; j < items.length; j++) {
          results[j] = { ...results[j], status: 'skipped' };
        }
        break;
      }

      // Update status to generating
      results[i] = { ...results[i], status: 'generating' };
      setBatchItems([...results]);

      const result = await generateItemWithRetry(items[i], 3);
      results[i] = result;
      
      if (result.status === 'success') {
        successCount++;
      } else {
        failCount++;
      }

      setBatchItems([...results]);
      setBatchProgress(Math.round(((i + 1) / items.length) * 100));
    }

    setBatchProcessing(false);
    
    if (abortBatchRef.current) {
      toast.info('Geração em lote interrompida');
    } else {
      toast.success(`Lote concluído: ${successCount} sucesso, ${failCount} falhas`);
    }
  };

  // Stop batch processing
  const handleStopBatch = () => {
    abortBatchRef.current = true;
    toast.info('Parando geração...');
  };

  // Retry failed items
  const handleRetryFailed = async () => {
    const failedItems = batchItems.filter(i => i.status === 'failed');
    if (failedItems.length === 0) return;

    setBatchProcessing(true);
    abortBatchRef.current = false;

    const results = [...batchItems];
    
    for (const item of failedItems) {
      if (abortBatchRef.current) break;

      results[item.index] = { ...results[item.index], status: 'generating' };
      setBatchItems([...results]);

      const result = await generateItemWithRetry(item, 3);
      results[item.index] = result;
      setBatchItems([...results]);
    }

    setBatchProcessing(false);
    toast.success('Tentativa de re-geração concluída');
  };

  // Save all to database
  const handleSaveAll = async () => {
    const successItems = batchItems.filter(i => i.status === 'success' && i.audioBlob);
    if (successItems.length === 0) {
      toast.error('Nenhum áudio para salvar');
      return;
    }

    let saved = 0;
    for (const item of successItems) {
      if (item.audioBlob) {
        try {
          await saveGeneratedAudio(
            item.audioBlob,
            item.text,
            `kokoro-${voiceId}`,
            undefined,
            undefined
          );
          saved++;
        } catch (error) {
          console.warn('Error saving audio:', error);
        }
      }
    }

    refetchAudios();
    toast.success(`${saved} áudios salvos!`);
  };

  // Download all as zip
  const handleDownloadAllZip = async () => {
    const successItems = batchItems.filter(i => i.status === 'success' && i.audioBlob);
    if (successItems.length === 0) {
      toast.error('Nenhum áudio para baixar');
      return;
    }

    const zip = new JSZip();
    
    // Sort by index to maintain order
    const sortedItems = [...successItems].sort((a, b) => a.index - b.index);
    
    for (const item of sortedItems) {
      if (item.audioBlob) {
        const fileName = `audio_${String(item.index + 1).padStart(3, '0')}.wav`;
        zip.file(fileName, item.audioBlob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audios_batch_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Download iniciado!');
  };

  // Download individual
  const handleDownloadIndividual = (item: BatchItem) => {
    if (!item.audioUrl) return;
    
    const a = document.createElement('a');
    a.href = item.audioUrl;
    a.download = `audio_${String(item.index + 1).padStart(3, '0')}.wav`;
    a.click();
  };

  const handlePlay = (audioUrl?: string) => {
    const url = audioUrl || currentAudioUrl;
    if (!url) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    
    audio.play();
    setIsPlaying(true);
    
    audio.onended = () => setIsPlaying(false);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleDownload = async (audioUrl: string, filename?: string) => {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'audio.wav';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentVoices = KOKORO_VOICES[language] || [];
  const successCount = batchItems.filter(i => i.status === 'success').length;
  const failedCount = batchItems.filter(i => i.status === 'failed').length;
  const pendingCount = batchItems.filter(i => i.status === 'pending' || i.status === 'generating').length;

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <div className="w-10 h-10 md:w-12 md:h-12 gradient-fire rounded-xl flex items-center justify-center">
          <Volume2 className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Gerador de Voz
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Kokoro TTS - 100% local, gratuito e ilimitado
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')}>
        <TabsList className="mb-4">
          <TabsTrigger 
            value="single"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white"
          >
            <Volume2 className="w-4 h-4 mr-2" />
            Individual
          </TabsTrigger>
          <TabsTrigger 
            value="batch"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white"
          >
            <List className="w-4 h-4 mr-2" />
            Em Lote
          </TabsTrigger>
        </TabsList>

        {/* Voice Settings - shared between tabs */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Configurações de Voz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Voz</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await saveSettings({ preferred_voice: `${language}|${voiceId}` });
                    }}
                    className={settings?.preferred_voice === `${language}|${voiceId}` ? 'text-yellow-500' : 'text-muted-foreground'}
                  >
                    <Star className={`w-4 h-4 ${settings?.preferred_voice === `${language}|${voiceId}` ? 'fill-yellow-500' : ''}`} />
                  </Button>
                </div>
                <Select value={voiceId} onValueChange={(v) => setVoiceId(v as TTSVoice)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.gender === 'male' ? '👨' : '👩'}</span>
                          <span>{voice.name}</span>
                          {voice.quality && (
                            <span className="text-xs text-muted-foreground">({voice.quality})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Velocidade</Label>
                <Select 
                  value={playbackSpeed.toString()} 
                  onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEED_OPTIONS.map((speed) => (
                      <SelectItem key={speed} value={speed.toString()}>
                        {speed}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model loading progress */}
        {(loading || batchProcessing) && !isModelLoaded() && modelLoadProgress > 0 && modelLoadProgress < 100 && (
          <div className="mb-4 space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Carregando modelo de voz...</span>
              <span>{modelLoadProgress}%</span>
            </div>
            <Progress value={modelLoadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              O modelo será salvo em cache para uso futuro
            </p>
          </div>
        )}

        {/* Single Mode */}
        <TabsContent value="single">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Texto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Digite o texto que será convertido em áudio..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    {text.length.toLocaleString('pt-BR')} caracteres
                  </p>

                  <Button 
                    onClick={handleGenerate} 
                    disabled={loading}
                    variant="fire"
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isModelLoaded() ? 'Gerando...' : 'Carregando modelo...'}
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Gerar Áudio
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Audio Player */}
              {currentAudioUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle>Prévia do Áudio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="icon"
                        variant={isPlaying ? 'secondary' : 'fire'}
                        onClick={() => isPlaying ? handlePause() : handlePlay()}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(currentAudioUrl, 'audio-gerado.wav')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          handlePause();
                          setCurrentAudioUrl(null);
                          audioRef.current = null;
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Limpar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Audio History */}
            <Card className="lg:sticky lg:top-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Histórico de Áudios</CardTitle>
                {generatedAudios.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (!confirm(`Excluir todos os ${generatedAudios.length} áudios?`)) return;
                      for (const audio of generatedAudios) {
                        await deleteGeneratedAudio(audio.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Tudo
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {generatedAudios.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum áudio gerado ainda
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {generatedAudios.map((audio) => (
                        <div 
                          key={audio.id} 
                          className="p-3 bg-muted rounded-lg flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground line-clamp-2">
                              {audio.text_content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {audio.model_used} • {new Date(audio.created_at || '').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handlePlay(audio.audio_url)}
                            >
                              <Play className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleDownload(audio.audio_url)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setText(audio.text_content)}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteGeneratedAudio(audio.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Batch Mode */}
        <TabsContent value="batch">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Textos em Lote</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder="Cole vários textos aqui (um por linha)..."
                    rows={10}
                    disabled={batchProcessing}
                  />
                  <p className="text-xs text-muted-foreground">
                    {batchText.split('\n').filter(l => l.trim()).length} textos
                  </p>

                  <div className="flex gap-2">
                    {!batchProcessing ? (
                      <Button 
                        onClick={handleBatchGenerate} 
                        disabled={!batchText.trim()}
                        variant="fire"
                        className="flex-1"
                      >
                        <Volume2 className="w-4 h-4 mr-2" />
                        Gerar Todos
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleStopBatch}
                        variant="destructive"
                        className="flex-1"
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Parar
                      </Button>
                    )}
                  </div>

                  {batchProcessing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progresso</span>
                        <span>{batchProgress}%</span>
                      </div>
                      <Progress value={batchProgress} className="h-2" />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    ⚡ Cada item que falhar será tentado novamente até 3 vezes antes de pular
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Batch Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resultados do Lote</CardTitle>
                  {batchItems.length > 0 && (
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {successCount}
                      </Badge>
                      <Badge variant="outline" className="text-destructive border-destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {failedCount}
                      </Badge>
                      {pendingCount > 0 && (
                        <Badge variant="outline">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          {pendingCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {batchItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Adicione textos e clique em "Gerar Todos"
                  </p>
                ) : (
                  <>
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {failedCount > 0 && !batchProcessing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRetryFailed}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Tentar Novamente ({failedCount})
                        </Button>
                      )}
                      
                      {successCount > 0 && !batchProcessing && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveAll}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Salvar Todos ({successCount})
                          </Button>
                          <Button
                            size="sm"
                            variant="fire"
                            onClick={handleDownloadAllZip}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download ZIP
                          </Button>
                        </>
                      )}
                    </div>

                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {batchItems.map((item) => (
                          <div 
                            key={item.index}
                            className={`p-3 rounded-lg flex items-start gap-3 ${
                              item.status === 'success' ? 'bg-green-500/10' :
                              item.status === 'failed' ? 'bg-destructive/10' :
                              item.status === 'generating' ? 'bg-secondary/20' :
                              item.status === 'skipped' ? 'bg-muted/50' :
                              'bg-muted'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-1">
                              {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              {item.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                              {item.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin" />}
                              {item.status === 'pending' && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                              {item.status === 'skipped' && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground line-clamp-2">
                                <span className="font-mono text-xs text-muted-foreground mr-2">
                                  #{item.index + 1}
                                </span>
                                {item.text}
                              </p>
                              {item.status === 'failed' && item.error && (
                                <p className="text-xs text-destructive mt-1">
                                  {item.error} (tentativas: {item.retries})
                                </p>
                              )}
                              {item.status === 'skipped' && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Pulado
                                </p>
                              )}
                            </div>

                            {item.status === 'success' && item.audioUrl && (
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handlePlay(item.audioUrl)}
                                >
                                  <Play className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleDownloadIndividual(item)}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {!isModelLoaded() && !loading && !batchProcessing && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          ⚡ Primeira geração baixa o modelo (~80MB). Depois é instantâneo!
        </p>
      )}
    </div>
  );
}

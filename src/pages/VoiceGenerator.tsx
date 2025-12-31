import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Volume2, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  RefreshCw, 
  Loader2,
  Star
} from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { toast } from 'sonner';
import { useVoiceGenerator } from '@/hooks/useVoiceGenerator';
import { generateSpeech, isModelLoaded, isModelLoading, getLoadProgress, type TTSVoice } from '@/lib/kokoroTTS';

// Kokoro TTS voices - English only (American and British)
// Note: Kokoro-js v1.2 only supports English voices
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

export default function VoiceGenerator() {
  const { 
    generatedAudios, 
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios,
  } = useVoiceGenerator();

  const { settings, saveSettings } = useAISettings();

  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [voiceId, setVoiceId] = useState<TTSVoice>('af_heart');
  
  // Carregar voz favorita se existir
  useEffect(() => {
    if (settings?.preferred_voice) {
      const parts = settings.preferred_voice.split('|');
      if (parts.length === 2) {
        setLanguage(parts[0]);
        setVoiceId(parts[1] as TTSVoice);
      }
    }
  }, [settings?.preferred_voice]);
  const [loading, setLoading] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Check model loading status periodically
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
  }, [loading]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto para gerar áudio');
      return;
    }

    setLoading(true);
    setModelLoadProgress(0);

    try {
      // Show loading message for first time (model download)
      if (!isModelLoaded()) {
        toast.info('Carregando modelo de voz (~80MB)... Isso só acontece uma vez!');
      }

      const audioBlob = await generateSpeech(text, {
        voice: voiceId,
        speed: playbackSpeed,
        onProgress: setModelLoadProgress,
      });
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element and play
      const audioElement = new Audio(audioUrl);
      audioElement.playbackRate = playbackSpeed;
      audioRef.current = audioElement;
      setCurrentAudioUrl(audioUrl);
      
      audioElement.play();
      setIsPlaying(true);
      audioElement.onended = () => setIsPlaying(false);

      // Save to database
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Left Column - Generator */}
        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language & Voice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              {/* Text */}
              <div>
                <Label>Texto</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Digite o texto que será convertido em áudio..."
                  rows={6}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {text.length} caracteres
                </p>
              </div>

              {/* Model loading progress */}
              {loading && !isModelLoaded() && modelLoadProgress > 0 && modelLoadProgress < 100 && (
                <div className="space-y-2">
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
                    Gerar Áudio (Local)
                  </>
                )}
              </Button>

              {!isModelLoaded() && !loading && (
                <p className="text-xs text-muted-foreground text-center">
                  ⚡ Primeira geração baixa o modelo (~80MB). Depois é instantâneo!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Audio Player */}
          {currentAudioUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Prévia do Áudio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <Button
                    size="icon"
                    variant={isPlaying ? 'secondary' : 'fire'}
                    onClick={() => isPlaying ? handlePause() : handlePlay()}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Velocidade:</Label>
                    <Select 
                      value={playbackSpeed.toString()} 
                      onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
                    >
                      <SelectTrigger className="w-20 h-8">
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

        {/* Right Column - Audio History */}
        <div>
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
                <ScrollArea className="h-[500px]">
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
                            className="h-8 w-8 text-destructive"
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
      </div>
    </div>
  );
}

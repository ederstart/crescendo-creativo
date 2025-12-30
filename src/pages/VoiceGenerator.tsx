import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Volume2, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  RefreshCw, 
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useVoiceGenerator } from '@/hooks/useVoiceGenerator';
import { supabase } from '@/lib/supabase';

// Kokoro TTS voices - multiple languages
const KOKORO_VOICES: Record<string, { id: string; name: string; gender: 'male' | 'female'; quality?: string }[]> = {
  'pt-BR': [
    { id: 'pm_santa', name: 'Santa', gender: 'male', quality: 'A' },
    { id: 'pf_dora', name: 'Dora', gender: 'female', quality: 'A' },
    { id: 'pm_alex', name: 'Alex', gender: 'male', quality: 'B' },
  ],
  'en-US': [
    { id: 'af_heart', name: 'Heart', gender: 'female', quality: 'A' },
    { id: 'af_bella', name: 'Bella', gender: 'female', quality: 'A-' },
    { id: 'af_sarah', name: 'Sarah', gender: 'female', quality: 'B' },
    { id: 'af_nicole', name: 'Nicole', gender: 'female', quality: 'B-' },
    { id: 'am_michael', name: 'Michael', gender: 'male', quality: 'B' },
    { id: 'am_fenrir', name: 'Fenrir', gender: 'male', quality: 'B' },
    { id: 'am_adam', name: 'Adam', gender: 'male', quality: 'C' },
  ],
  'en-GB': [
    { id: 'bf_emma', name: 'Emma', gender: 'female', quality: 'A' },
    { id: 'bf_isabella', name: 'Isabella', gender: 'female', quality: 'B' },
    { id: 'bm_george', name: 'George', gender: 'male', quality: 'B' },
    { id: 'bm_lewis', name: 'Lewis', gender: 'male', quality: 'B' },
  ],
  'es': [
    { id: 'ef_dora', name: 'Dora', gender: 'female', quality: 'A' },
    { id: 'em_alex', name: 'Alex', gender: 'male', quality: 'B' },
    { id: 'em_santa', name: 'Santa', gender: 'male', quality: 'B' },
  ],
  'ja': [
    { id: 'jf_alpha', name: 'Alpha', gender: 'female', quality: 'A' },
    { id: 'jf_gongitsune', name: 'Gongitsune', gender: 'female', quality: 'B' },
    { id: 'jm_kumo', name: 'Kumo', gender: 'male', quality: 'B' },
  ],
  'zh': [
    { id: 'zf_xiaobei', name: 'Xiaobei', gender: 'female', quality: 'A' },
    { id: 'zf_xiaoni', name: 'Xiaoni', gender: 'female', quality: 'B' },
    { id: 'zm_yunxi', name: 'Yunxi', gender: 'male', quality: 'B' },
  ],
  'fr': [
    { id: 'ff_siwis', name: 'Siwis', gender: 'female', quality: 'A' },
  ],
  'it': [
    { id: 'if_sara', name: 'Sara', gender: 'female', quality: 'A' },
    { id: 'im_nicola', name: 'Nicola', gender: 'male', quality: 'B' },
  ],
  'hi': [
    { id: 'hf_alpha', name: 'Alpha', gender: 'female', quality: 'A' },
    { id: 'hm_omega', name: 'Omega', gender: 'male', quality: 'B' },
  ],
};

const LANGUAGE_LABELS: Record<string, string> = {
  'pt-BR': '🇧🇷 Português (Brasil)',
  'en-US': '🇺🇸 English (US)',
  'en-GB': '🇬🇧 English (UK)',
  'es': '🇪🇸 Español',
  'ja': '🇯🇵 日本語',
  'zh': '🇨🇳 中文',
  'fr': '🇫🇷 Français',
  'it': '🇮🇹 Italiano',
  'hi': '🇮🇳 हिंदी',
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VoiceGenerator() {
  const { 
    generatedAudios, 
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios,
  } = useVoiceGenerator();

  const [text, setText] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [voiceId, setVoiceId] = useState('pm_santa');
  const [loading, setLoading] = useState(false);
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

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto para gerar áudio');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('kokoro-tts', {
        body: {
          text,
          voice: voiceId,
          speed: playbackSpeed,
        },
      });

      if (error) throw error;

      // The response is already a blob from the edge function
      const audioBlob = new Blob([data], { type: 'audio/mpeg' });
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
      
      toast.success('Áudio gerado!');
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
    a.download = filename || 'audio.mp3';
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
            Kokoro TTS - 100% gratuito e ilimitado
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
                  <Label>Voz</Label>
                  <Select value={voiceId} onValueChange={setVoiceId}>
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

              <Button 
                onClick={handleGenerate} 
                disabled={loading}
                variant="fire"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
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
                    onClick={() => handleDownload(currentAudioUrl, 'audio-gerado.mp3')}
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

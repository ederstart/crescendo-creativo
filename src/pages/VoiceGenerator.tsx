import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  Star, 
  Plus,
  Loader2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useVoiceGenerator, VoicePreset, GeneratedAudio } from '@/hooks/useVoiceGenerator';
import { useAuth } from '@/hooks/useAuth';
import { loadPuter } from '@/lib/puter';

const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual V2 (Recomendado)', description: 'Melhor para múltiplos idiomas' },
  { id: 'eleven_flash_v2_5', name: 'Flash V2.5', description: 'Rápido e eficiente' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo V2.5', description: 'Muito rápido' },
  { id: 'eleven_v3', name: 'V3 (Mais Novo)', description: 'Última versão' },
];

// Amazon Polly voices (subset of popular ones)
const POLLY_VOICES = [
  { id: 'Camila', name: 'Camila', description: 'Português BR - Feminina', language: 'pt-BR', engine: 'neural' as const },
  { id: 'Vitoria', name: 'Vitória', description: 'Português BR - Feminina', language: 'pt-BR', engine: 'neural' as const },
  { id: 'Ricardo', name: 'Ricardo', description: 'Português BR - Masculina', language: 'pt-BR', engine: 'standard' as const },
  { id: 'Thiago', name: 'Thiago', description: 'Português BR - Masculina', language: 'pt-BR', engine: 'neural' as const },
  { id: 'Ines', name: 'Inês', description: 'Português PT - Feminina', language: 'pt-PT', engine: 'neural' as const },
  { id: 'Cristiano', name: 'Cristiano', description: 'Português PT - Masculina', language: 'pt-PT', engine: 'standard' as const },
  { id: 'Joanna', name: 'Joanna', description: 'English US - Female', language: 'en-US', engine: 'neural' as const },
  { id: 'Matthew', name: 'Matthew', description: 'English US - Male', language: 'en-US', engine: 'neural' as const },
  { id: 'Amy', name: 'Amy', description: 'English UK - Female', language: 'en-GB', engine: 'neural' as const },
  { id: 'Brian', name: 'Brian', description: 'English UK - Male', language: 'en-GB', engine: 'neural' as const },
];

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VoiceGenerator() {
  const { user } = useAuth();
  const { 
    voicePresets, 
    generatedAudios, 
    saveVoicePreset, 
    deleteVoicePreset,
    toggleFavorite,
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios,
  } = useVoiceGenerator();

  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [model, setModel] = useState('eleven_multilingual_v2');
  const [provider, setProvider] = useState<'elevenlabs' | 'aws-polly'>('elevenlabs');
  const [pollyVoice, setPollyVoice] = useState('Camila');
  const [loading, setLoading] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSavePreset, setShowSavePreset] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleSelectPreset = (preset: VoicePreset) => {
    setVoiceId(preset.voice_id);
    setVoiceName(preset.voice_name);
  };

  const handleSavePreset = async () => {
    if (!voiceId.trim() || !voiceName.trim()) {
      toast.error('Preencha ID e nome da voz');
      return;
    }
    await saveVoicePreset(voiceId, voiceName);
    setShowSavePreset(false);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Digite o texto para gerar áudio');
      return;
    }
    
    if (provider === 'elevenlabs' && !voiceId.trim()) {
      toast.error('Informe o ID da voz ElevenLabs');
      return;
    }

    setLoading(true);

    try {
      const puterInstance = await loadPuter();
      
      let audioElement: HTMLAudioElement;
      
      if (provider === 'elevenlabs') {
        // ElevenLabs - usa voice ID e model
        audioElement = await puterInstance.ai.txt2speech(text, {
          provider: 'elevenlabs',
          voice: voiceId,
          model: model,
        });
      } else {
        // Amazon Polly - usa voice name, language e engine
        const selectedVoice = POLLY_VOICES.find(v => v.id === pollyVoice);
        audioElement = await puterInstance.ai.txt2speech(text, {
          provider: 'aws-polly',
          voice: pollyVoice,
          language: selectedVoice?.language || 'pt-BR',
          engine: selectedVoice?.engine || 'neural',
        });
      }

      // O Puter.js retorna um HTMLAudioElement pronto para tocar
      // Guardar referência e URL para o player
      audioRef.current = audioElement;
      setCurrentAudioUrl(audioElement.src);
      
      // Tocar automaticamente
      audioElement.playbackRate = playbackSpeed;
      audioElement.play();
      setIsPlaying(true);
      
      audioElement.onended = () => setIsPlaying(false);

      // Para salvar no banco, extrair o blob do src
      if (audioElement.src) {
        try {
          const response = await fetch(audioElement.src);
          if (response.ok) {
            const audioBlob = await response.blob();
            const modelUsed = provider === 'elevenlabs' ? model : `polly-${pollyVoice}`;
            const savedAudio = await saveGeneratedAudio(audioBlob, text, modelUsed, undefined, audioElement.duration || undefined);
            if (savedAudio) {
              refetchAudios();
              toast.success('Áudio gerado e salvo!');
            } else {
              toast.success('Áudio gerado!');
            }
          } else {
            console.warn('Could not fetch audio blob:', response.status);
            toast.success('Áudio gerado (não foi possível salvar no histórico)');
          }
        } catch (saveError) {
          console.warn('Could not save audio to database:', saveError);
          toast.success('Áudio gerado (não foi possível salvar no histórico)');
        }
      } else {
        toast.success('Áudio gerado!');
      }

      
    } catch (error) {
      console.error('Error generating audio:', error);
      toast.error(`Erro ao gerar áudio com ${provider === 'elevenlabs' ? 'ElevenLabs' : 'Amazon Polly'}`);
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

  const handleRegenerate = async (audio: GeneratedAudio) => {
    setText(audio.text_content);
    setModel(audio.model_used);
    // Trigger generation
    await handleGenerate();
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 gradient-fire rounded-xl flex items-center justify-center">
          <Volume2 className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Gerador de Voz
          </h1>
          <p className="text-muted-foreground">
            Gere áudios com ElevenLabs via Puter.js
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Generator */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Provider Selector */}
              <div>
                <Label>Provedor de Voz</Label>
                <Select value={provider} onValueChange={(v: 'elevenlabs' | 'aws-polly') => setProvider(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevenlabs">
                      <div className="flex items-center gap-2">
                        <span>🎙️ ElevenLabs</span>
                        <span className="text-xs text-muted-foreground">Alta qualidade, IDs de voz</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="aws-polly">
                      <div className="flex items-center gap-2">
                        <span>☁️ Amazon Polly</span>
                        <span className="text-xs text-muted-foreground">Vozes pré-definidas</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ElevenLabs Config */}
              {provider === 'elevenlabs' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ID da Voz</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={voiceId}
                          onChange={(e) => setVoiceId(e.target.value)}
                          placeholder="Ex: EXAVITQu4vr4xnSDxMaL"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSavePreset(!showSavePreset)}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Nome da Voz</Label>
                      <Input
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        placeholder="Ex: Sarah"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {showSavePreset && (
                    <div className="p-3 bg-muted rounded-lg flex gap-2 items-center">
                      <span className="text-sm text-muted-foreground">Salvar como preset?</span>
                      <Button size="sm" onClick={handleSavePreset}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSavePreset(false)}>
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {/* Model */}
                  <div>
                    <Label>Modelo</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ELEVENLABS_MODELS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <div>
                              <span>{m.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {m.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Amazon Polly Config */}
              {provider === 'aws-polly' && (
                <div>
                  <Label>Voz</Label>
                  <Select value={pollyVoice} onValueChange={setPollyVoice}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POLLY_VOICES.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <div>
                            <span>{v.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {v.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                <div className="flex items-center gap-4">
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

          {/* Generated Audios History */}
          <Card>
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
                <ScrollArea className="h-[300px]">
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
                            {audio.model_used} • {new Date(audio.created_at).toLocaleDateString('pt-BR')}
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
                            onClick={() => {
                              setText(audio.text_content);
                              setModel(audio.model_used);
                            }}
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

        {/* Right Column - Voice Presets */}
        <div>
          <Card className="sticky top-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Vozes Salvas</CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSavePreset(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {voicePresets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma voz salva
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {voicePresets.map((preset) => (
                      <div
                        key={preset.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          voiceId === preset.voice_id 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        onClick={() => handleSelectPreset(preset)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {preset.voice_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {preset.voice_id.slice(0, 12)}...
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(preset.id, preset.is_favorite);
                              }}
                            >
                              <Star className={`w-3 h-3 ${
                                preset.is_favorite ? 'fill-yellow-500 text-yellow-500' : ''
                              }`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteVoicePreset(preset.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Dica:</strong> Encontre IDs de vozes na{' '}
                  <a 
                    href="https://elevenlabs.io/voice-library" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    ElevenLabs Voice Library
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Image, Upload, X, Download, Trash2, Check, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface GeneratedImage {
  id: string;
  prompt_used?: string;
  image_url: string;
  scene_description?: string;
  subject_image_url?: string;
}

interface SceneGeneratorProps {
  whiskToken?: string;
  whiskSessionId?: string;
  defaultPrompt?: string;
  scriptContent?: string;
  images: GeneratedImage[];
  onImageGenerated: (image: Omit<GeneratedImage, 'id' | 'created_at'>) => void;
  onDeleteImage: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
}

export function SceneGenerator({
  whiskToken,
  whiskSessionId,
  defaultPrompt = '',
  scriptContent,
  images,
  onImageGenerated,
  onDeleteImage,
  onDeleteMultiple,
}: SceneGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [subjectImageUrl, setSubjectImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [batchPrompts, setBatchPrompts] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);

  const handleGenerate = async (promptText: string) => {
    if (!whiskToken || !whiskSessionId) {
      toast.error('Configure o Token e Session ID do Whisk nas configurações');
      return;
    }

    if (!promptText.trim()) {
      toast.error('Digite um prompt');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-whisk-image', {
        body: {
          prompt: promptText,
          token: whiskToken,
          sessionId: whiskSessionId,
          subjectImageUrl: subjectImageUrl || undefined,
          aspectRatio: '16:9',
        },
      });

      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        if (data.suggestion) {
          toast.info(data.suggestion);
        }
        return;
      }

      await onImageGenerated({
        image_url: data.imageUrl,
        prompt_used: promptText,
        scene_description: promptText.substring(0, 100),
        subject_image_url: subjectImageUrl || undefined,
      });

      toast.success('Imagem gerada!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar imagem');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGenerate = async () => {
    const prompts = batchPrompts.split('\n').filter(p => p.trim());
    if (prompts.length === 0) {
      toast.error('Adicione prompts (um por linha)');
      return;
    }

    toast.info(`Gerando ${prompts.length} imagens...`);
    
    for (let i = 0; i < prompts.length; i++) {
      toast.info(`Gerando imagem ${i + 1} de ${prompts.length}...`);
      await handleGenerate(prompts[i]);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    toast.success('Todas as imagens foram geradas!');
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedImages(images.map(img => img.id));
  };

  const deselectAll = () => {
    setSelectedImages([]);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (error) {
      toast.error('Erro ao baixar imagem');
    }
  };

  const downloadSelected = async () => {
    const selectedImgs = images.filter(img => selectedImages.includes(img.id));
    toast.info(`Baixando ${selectedImgs.length} imagens...`);
    
    for (let i = 0; i < selectedImgs.length; i++) {
      await downloadImage(selectedImgs[i].image_url, `scene-${i + 1}.png`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    toast.success('Download concluído!');
  };

  const downloadAll = async () => {
    toast.info(`Baixando ${images.length} imagens...`);
    
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i].image_url, `scene-${i + 1}.png`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    toast.success('Download concluído!');
  };

  const hasCredentials = whiskToken && whiskSessionId;

  return (
    <div className="space-y-6">
      {/* Generation Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant={!isBatchMode ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setIsBatchMode(false)}
          >
            Individual
          </Button>
          <Button
            variant={isBatchMode ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setIsBatchMode(true)}
          >
            Lote
          </Button>
        </div>

        <div>
          <Label>Prompt Base do Sistema</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Ex: Ilustração digital estilo anime, alta qualidade, 16:9..."
            rows={2}
            className="mt-1 font-mono text-sm"
          />
        </div>

        <div>
          <Label>Imagem de Referência (Personagem/Assunto)</Label>
          <Input
            value={subjectImageUrl}
            onChange={(e) => setSubjectImageUrl(e.target.value)}
            placeholder="URL da imagem do personagem para consistência..."
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Anexe uma imagem para manter consistência visual nas cenas
          </p>
        </div>

        {isBatchMode ? (
          <div>
            <Label>Prompts em Lote (um por linha)</Label>
            <Textarea
              value={batchPrompts}
              onChange={(e) => setBatchPrompts(e.target.value)}
              placeholder="Cena 1: Personagem caminhando na floresta&#10;Cena 2: Personagem encontra um tesouro&#10;Cena 3: Personagem celebra a vitória"
              rows={8}
              className="mt-1 font-mono text-sm"
            />
            <Button
              onClick={handleBatchGenerate}
              disabled={loading || !hasCredentials}
              className="w-full mt-2"
              variant="fire"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Image className="w-4 h-4 mr-2" />
                  Gerar Todas as Cenas
                </>
              )}
            </Button>
          </div>
        ) : (
          <div>
            <Label>Descrição da Cena</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a cena que deseja gerar..."
              rows={4}
              className="mt-1"
            />
            <Button
              onClick={() => handleGenerate(systemPrompt ? `${systemPrompt}. ${prompt}` : prompt)}
              disabled={loading || !hasCredentials}
              className="w-full mt-2"
              variant="fire"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Image className="w-4 h-4 mr-2" />
                  Gerar Cena
                </>
              )}
            </Button>
          </div>
        )}

        {!hasCredentials && (
          <p className="text-sm text-destructive text-center">
            Configure o Token e Session ID do Whisk nas configurações
          </p>
        )}

        {scriptContent && (
          <div className="bg-muted/50 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs">Roteiro Anexado</Label>
            <p className="text-sm mt-1 line-clamp-3">{scriptContent}</p>
          </div>
        )}
      </div>

      {/* Generated Images Gallery */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Imagens Geradas ({images.length})
            </h3>
            <div className="flex items-center gap-2">
              {selectedImages.length > 0 ? (
                <>
                  <Button size="sm" variant="ghost" onClick={deselectAll}>
                    Limpar seleção
                  </Button>
                  <Button size="sm" variant="secondary" onClick={downloadSelected}>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar ({selectedImages.length})
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      onDeleteMultiple(selectedImages);
                      setSelectedImages([]);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={selectAll}>
                    Selecionar todas
                  </Button>
                  <Button size="sm" variant="secondary" onClick={downloadAll}>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Todas
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "relative group aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
                  selectedImages.includes(image.id) 
                    ? "border-primary ring-2 ring-primary/50" 
                    : "border-transparent hover:border-primary/50"
                )}
                onClick={() => toggleImageSelection(image.id)}
              >
                <img
                  src={image.image_url}
                  alt={image.scene_description || 'Generated scene'}
                  className="w-full h-full object-cover"
                />
                
                {/* Selection indicator */}
                <div className={cn(
                  "absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  selectedImages.includes(image.id)
                    ? "bg-primary border-primary"
                    : "bg-background/80 border-muted-foreground/50"
                )}>
                  {selectedImages.includes(image.id) && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="secondary" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <img
                        src={image.image_url}
                        alt={image.scene_description || 'Generated scene'}
                        className="w-full h-auto rounded-lg"
                      />
                      {image.prompt_used && (
                        <p className="text-sm text-muted-foreground mt-2">{image.prompt_used}</p>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(image.image_url, `scene-${image.id}.png`);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteImage(image.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

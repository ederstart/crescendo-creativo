import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Image as ImageIcon, Download, Trash2, Check, Eye, Plus, FolderOpen, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GeneratedImage {
  id: string;
  prompt_used?: string;
  image_url: string;
  scene_description?: string;
  subject_image_url?: string;
  created_at?: string;
}

interface ImageGalleryProps {
  whiskToken?: string;
  whiskSessionId?: string;
  images: GeneratedImage[];
  onImageGenerated: (image: Omit<GeneratedImage, 'id' | 'created_at'>) => void;
  onDeleteImage: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
}

// Helper function to clean "Cena X:" prefix from prompts
const cleanScenePrefix = (prompt: string): string => {
  // Remove "Cena X:" or "CENA X:" prefix where X is 1-999
  return prompt.replace(/^(?:CENA|Cena|cena)\s*\d{1,3}\s*:\s*/i, '').trim();
};

export function ImageGallery({
  whiskToken,
  whiskSessionId,
  images,
  onImageGenerated,
  onDeleteImage,
  onDeleteMultiple,
}: ImageGalleryProps) {
  const [prompt, setPrompt] = useState('');
  const [subjectImageUrl, setSubjectImageUrl] = useState('');
  const [styleTemplate, setStyleTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [batchPrompts, setBatchPrompts] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<string>('all');

  // Load saved style template from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem('whisk-style-template');
    if (savedStyle) {
      setStyleTemplate(savedStyle);
    }
  }, []);

  const saveStyleTemplate = () => {
    localStorage.setItem('whisk-style-template', styleTemplate);
    toast.success('Template de estilo salvo!');
  };

  // Group images by date for album-like experience
  const groupedImages = images.reduce((acc, img) => {
    const date = img.created_at ? new Date(img.created_at).toLocaleDateString('pt-BR') : 'Sem data';
    if (!acc[date]) acc[date] = [];
    acc[date].push(img);
    return acc;
  }, {} as Record<string, GeneratedImage[]>);

  const albums = Object.keys(groupedImages);
  const displayImages = activeAlbum === 'all' ? images : groupedImages[activeAlbum] || [];

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
      // Clean the "Cena X:" prefix from the prompt
      const cleanedPrompt = cleanScenePrefix(promptText);
      
      // Combine style template with prompt if style exists
      const finalPrompt = styleTemplate.trim() 
        ? `${styleTemplate.trim()}, ${cleanedPrompt}` 
        : cleanedPrompt;

      const { data, error } = await supabase.functions.invoke('generate-whisk-image', {
        body: {
          prompt: finalPrompt,
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
        prompt_used: finalPrompt,
        scene_description: cleanedPrompt.substring(0, 100),
        subject_image_url: subjectImageUrl || undefined,
      });

      toast.success('Imagem gerada!');
      setPrompt('');
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

    // Count how many prompts there are (based on "Cena X:" pattern or just lines)
    const sceneCount = prompts.filter(p => /^(?:CENA|Cena|cena)\s*\d{1,3}\s*:/i.test(p)).length || prompts.length;
    toast.info(`Detectados ${sceneCount} prompts para gerar...`);
    
    for (let i = 0; i < prompts.length; i++) {
      toast.info(`Gerando imagem ${i + 1} de ${prompts.length}...`);
      await handleGenerate(prompts[i]);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    toast.success('Todas as imagens foram geradas!');
    setBatchPrompts('');
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => setSelectedImages(displayImages.map(img => img.id));
  const deselectAll = () => setSelectedImages([]);

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
    const selectedImgs = displayImages.filter(img => selectedImages.includes(img.id));
    toast.info(`Baixando ${selectedImgs.length} imagens...`);
    
    for (let i = 0; i < selectedImgs.length; i++) {
      await downloadImage(selectedImgs[i].image_url, `whisk-${i + 1}.png`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    toast.success('Download concluído!');
  };

  const downloadAll = async () => {
    toast.info(`Baixando ${displayImages.length} imagens...`);
    
    for (let i = 0; i < displayImages.length; i++) {
      await downloadImage(displayImages[i].image_url, `whisk-${i + 1}.png`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    toast.success('Download concluído!');
  };

  const hasCredentials = whiskToken && whiskSessionId;

  return (
    <div className="space-y-6">
      {/* Album Navigation */}
      {albums.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            variant={activeAlbum === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveAlbum('all')}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Todas ({images.length})
          </Button>
          {albums.map(album => (
            <Button
              key={album}
              variant={activeAlbum === album ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveAlbum(album)}
            >
              {album} ({groupedImages[album].length})
            </Button>
          ))}
        </div>
      )}

      {/* Generation Section */}
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
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
          <Label>Imagem de Referência (Personagem/Assunto)</Label>
          <Input
            value={subjectImageUrl}
            onChange={(e) => setSubjectImageUrl(e.target.value)}
            placeholder="URL da imagem do personagem para consistência..."
            className="mt-1"
          />
        </div>

        <div>
          <Label>Template de Estilo</Label>
          <div className="flex gap-2 mt-1">
            <Textarea
              value={styleTemplate}
              onChange={(e) => setStyleTemplate(e.target.value)}
              placeholder="Ex: cartoon style, white background, 16:9 aspect ratio, high quality, detailed illustration..."
              rows={2}
              className="flex-1"
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={saveStyleTemplate}
              title="Salvar template de estilo"
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            O template será combinado com cada prompt gerado
          </p>
        </div>

        {isBatchMode ? (
          <div>
            <Label>Prompts em Lote (um por linha)</Label>
            <Textarea
              value={batchPrompts}
              onChange={(e) => setBatchPrompts(e.target.value)}
              placeholder="Prompt 1&#10;Prompt 2&#10;Prompt 3"
              rows={6}
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
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Gerar Todas
                </>
              )}
            </Button>
          </div>
        ) : (
          <div>
            <Label>Prompt da Imagem</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva a imagem que deseja gerar..."
              rows={3}
              className="mt-1"
            />
            <Button
              onClick={() => handleGenerate(prompt)}
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
                  <Plus className="w-4 h-4 mr-2" />
                  Gerar Imagem
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
      </div>

      {/* Gallery Section */}
      {displayImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              Galeria ({displayImages.length} imagens)
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
            {displayImages.map((image) => (
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
                  alt={image.scene_description || 'Generated image'}
                  className="w-full h-full object-cover"
                />
                
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

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="secondary" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Visualizar Imagem</DialogTitle>
                      </DialogHeader>
                      <img
                        src={image.image_url}
                        alt={image.scene_description || 'Generated image'}
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
                      downloadImage(image.image_url, `whisk-${image.id}.png`);
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

      {displayImages.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma imagem gerada ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Use o gerador acima para criar suas primeiras imagens</p>
        </div>
      )}
    </div>
  );
}
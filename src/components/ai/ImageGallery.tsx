import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Image as ImageIcon, Download, Trash2, Check, Eye, Plus, FolderOpen, Save, StopCircle, Star, Sparkles, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import JSZip from 'jszip';
import { useStyleTemplates, StyleTemplate } from '@/hooks/useStyleTemplates';
import { useAISettings } from '@/hooks/useAISettings';

interface GeneratedImage {
  id: string;
  prompt_used?: string;
  image_url: string;
  scene_description?: string;
  subject_image_url?: string;
  created_at?: string;
}

interface ImageGalleryProps {
  googleCookie?: string;
  perchanceUserKey?: string;
  styleTemplate?: string;
  images: GeneratedImage[];
  onImageGenerated: (image: Omit<GeneratedImage, 'id' | 'created_at'>) => void;
  onDeleteImage: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onSaveStyleTemplate: (template: string) => void;
  onRefetch?: () => void;
  initialPrompt?: string;
  onPromptUsed?: () => void;
  initialBatchPrompts?: string;
  onBatchPromptsUsed?: () => void;
  autoStartBatch?: boolean;
  onAutoStartBatchComplete?: () => void;
}

type ImageGenerator = 'whisk' | 'perchance';

// Helper function to clean "Cena X:" prefix from prompts
const cleanScenePrefix = (prompt: string): string => {
  return prompt.replace(/^(?:CENA|Cena|cena)\s*\d{1,3}\s*:\s*/i, '').trim();
};

const MAX_RETRIES = 3;
// Progressive retry delays: 10s, 20s, 30s
const RETRY_DELAYS = [10000, 20000, 30000];

export function ImageGallery({
  googleCookie,
  perchanceUserKey,
  styleTemplate: initialStyleTemplate,
  images,
  onImageGenerated,
  onDeleteImage,
  onDeleteMultiple,
  onSaveStyleTemplate,
  onRefetch,
  initialPrompt,
  onPromptUsed,
  initialBatchPrompts,
  onBatchPromptsUsed,
  autoStartBatch,
  onAutoStartBatchComplete,
}: ImageGalleryProps) {
  const { settings } = useAISettings();
  const { templates: styleTemplates, createTemplate, setFavorite, favoriteTemplate } = useStyleTemplates();
  
  const [prompt, setPrompt] = useState('');
  const [subjectImageUrl, setSubjectImageUrl] = useState('');
  const [styleTemplate, setStyleTemplate] = useState(initialStyleTemplate || '');
  const [aspectRatio, setAspectRatio] = useState('landscape');
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [batchPrompts, setBatchPrompts] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<string>('all');
  const [savingStyle, setSavingStyle] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  
  // Image generator selection
  const [imageGenerator, setImageGenerator] = useState<ImageGenerator>(
    (settings?.preferred_image_generator as ImageGenerator) || 'whisk'
  );
  
  // Ref to control stopping batch generation
  const stopBatchRef = useRef(false);
  // Track failed prompts
  const failedPromptsRef = useRef<string[]>([]);
  // Track if auto-start was triggered
  const autoStartTriggeredRef = useRef(false);

  // Sync with prop when it changes
  useEffect(() => {
    if (initialStyleTemplate !== undefined) {
      setStyleTemplate(initialStyleTemplate);
    } else if (favoriteTemplate) {
      // Carregar template favorito
      setStyleTemplate(favoriteTemplate.content);
    }
  }, [initialStyleTemplate]);

  // Apply initial prompt when received from scene generator
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setPrompt(initialPrompt);
      onPromptUsed?.();
    }
  }, [initialPrompt, onPromptUsed]);

  // Apply batch prompts when received from scene generator "Apply All"
  useEffect(() => {
    if (initialBatchPrompts && initialBatchPrompts.trim()) {
      setBatchPrompts(initialBatchPrompts);
      setIsBatchMode(true);
      onBatchPromptsUsed?.();
    }
  }, [initialBatchPrompts, onBatchPromptsUsed]);

  // Auto-start batch generation when automation triggers it
  useEffect(() => {
    const hasCredentials = imageGenerator === 'whisk' ? googleCookie : perchanceUserKey;
    if (autoStartBatch && batchPrompts.trim() && !loading && !autoStartTriggeredRef.current && hasCredentials) {
      autoStartTriggeredRef.current = true;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        handleBatchGenerate().finally(() => {
          onAutoStartBatchComplete?.();
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStartBatch, batchPrompts, loading, googleCookie, perchanceUserKey, imageGenerator]);

  // Reset auto-start ref when autoStartBatch becomes false
  useEffect(() => {
    if (!autoStartBatch) {
      autoStartTriggeredRef.current = false;
    }
  }, [autoStartBatch]);
  const saveStyleTemplate = async () => {
    setSavingStyle(true);
    await onSaveStyleTemplate(styleTemplate);
    setSavingStyle(false);
  };

  const handleSaveAsNewTemplate = async () => {
    if (!newTemplateName.trim() || !styleTemplate.trim()) {
      toast.error('Preencha o nome e o conteúdo do template');
      return;
    }
    await createTemplate(newTemplateName, styleTemplate);
    setNewTemplateName('');
    setShowSaveTemplateDialog(false);
  };

  const handleLoadTemplate = (template: StyleTemplate) => {
    setStyleTemplate(template.content);
    toast.success(`Template "${template.name}" carregado`);
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

  const handleGenerate = async (promptText: string, retryCount = 0): Promise<boolean> => {
    // Check credentials based on selected generator
    if (imageGenerator === 'whisk' && !googleCookie) {
      toast.error('Configure o Cookie do Google nas configurações');
      return false;
    }
    if (imageGenerator === 'perchance' && !perchanceUserKey) {
      toast.error('Configure a UserKey do Perchance nas configurações');
      return false;
    }

    if (!promptText.trim()) {
      toast.error('Digite um prompt');
      return false;
    }

    setLoading(true);

    try {
      // Clean the "Cena X:" prefix from the prompt
      const cleanedPrompt = cleanScenePrefix(promptText);

      let data: any;
      let error: any;

      if (imageGenerator === 'whisk') {
        // Google Whisk generation
        const response = await supabase.functions.invoke('generate-whisk-v2', {
          body: {
            prompt: cleanedPrompt,
            cookie: googleCookie,
            styleTemplate: styleTemplate.trim() || undefined,
            aspectRatio,
          },
        });
        data = response.data;
        error = response.error;
      } else {
        // Perchance generation
        const resolutionMap: Record<string, string> = {
          'landscape': '1280x720',
          '16:9': '1280x720',
          'portrait': '720x1280',
          '9:16': '720x1280',
          'square': '1024x1024',
          '1:1': '1024x1024',
        };
        
        const response = await supabase.functions.invoke('generate-perchance-image', {
          body: {
            prompt: styleTemplate.trim() ? `${styleTemplate.trim()}, ${cleanedPrompt}` : cleanedPrompt,
            userKey: perchanceUserKey,
            resolution: resolutionMap[aspectRatio] || '1280x720',
          },
        });
        data = response.data;
        error = response.error;
      }

      if (error) throw error;
      
      if (data.error) {
        // Check if we should retry with progressive delay
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount];
          toast.warning(`Erro na geração, aguardando ${delay / 1000}s e tentando novamente (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return handleGenerate(promptText, retryCount + 1);
        }
        
        toast.error(data.error);
        if (data.suggestion) {
          toast.info(data.suggestion);
        }
        return false;
      }

      // Convert base64 to data URL for display
      const imageUrl = data.imageBase64.startsWith('data:') 
        ? data.imageBase64 
        : `data:image/png;base64,${data.imageBase64}`;

      await onImageGenerated({
        image_url: imageUrl,
        prompt_used: data.prompt || cleanedPrompt,
        scene_description: cleanedPrompt.substring(0, 100),
        subject_image_url: subjectImageUrl || undefined,
      });

      const genName = imageGenerator === 'whisk' ? 'IMAGEN_3_5' : 'Perchance';
      toast.success(`Imagem gerada com ${genName}!`);
      setPrompt('');
      return true;
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Retry on network/server errors with progressive delay
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount];
        toast.warning(`Erro na geração, aguardando ${delay / 1000}s e tentando novamente (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleGenerate(promptText, retryCount + 1);
      }
      
      toast.error('Erro ao gerar imagem após várias tentativas');
      return false;
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

    // Reset stop flag and failed prompts
    stopBatchRef.current = false;
    failedPromptsRef.current = [];

    const sceneCount = prompts.filter(p => /^(?:CENA|Cena|cena)\s*\d{1,3}\s*:/i.test(p)).length || prompts.length;
    toast.info(`Detectados ${sceneCount} prompts para gerar...`);
    
    setBatchProgress({ current: 0, total: prompts.length });
    
    for (let i = 0; i < prompts.length; i++) {
      // Check if user requested to stop
      if (stopBatchRef.current) {
        toast.info(`Geração interrompida. ${i} de ${prompts.length} imagens geradas.`);
        break;
      }
      
      setBatchProgress({ current: i + 1, total: prompts.length });
      toast.info(`Gerando imagem ${i + 1} de ${prompts.length}...`);
      
      const success = await handleGenerate(prompts[i]);
      
      // Track failed prompts
      if (!success) {
        failedPromptsRef.current.push(prompts[i]);
      }
      
      // If user wants to stop, break
      if (stopBatchRef.current) {
        break;
      }
      
      // Wait between requests (only if not stopped and not last)
      if (!stopBatchRef.current && i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setBatchProgress(null);
    
    // Refresh gallery after batch generation
    if (onRefetch) {
      onRefetch();
    }
    
    // Show results
    const successCount = prompts.length - failedPromptsRef.current.length;
    const failedCount = failedPromptsRef.current.length;
    
    if (!stopBatchRef.current) {
      if (failedCount === 0) {
        toast.success(`Todas as ${successCount} imagens foram geradas!`);
      } else {
        toast.warning(`${successCount} geradas, ${failedCount} falharam`);
        // Show failed prompts
        console.log('Prompts que falharam:', failedPromptsRef.current);
        toast.error(
          `Cenas que falharam: ${failedPromptsRef.current.map(p => {
            const match = p.match(/^(?:CENA|Cena|cena)\s*(\d{1,3})\s*:/i);
            return match ? `Cena ${match[1]}` : p.substring(0, 30);
          }).join(', ')}`,
          { duration: 10000 }
        );
      }
    }
    
    setBatchPrompts('');
  };

  const handleStopBatch = () => {
    stopBatchRef.current = true;
    toast.info('Parando geração após a imagem atual...');
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
      // Handle base64 images
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        return;
      }
      
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

  const downloadAsZip = async (imagesToDownload: GeneratedImage[], zipName: string) => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < imagesToDownload.length; i++) {
        const img = imagesToDownload[i];
        let imageData: Blob;
        
        if (img.image_url.startsWith('data:')) {
          // Convert base64 to blob
          const base64Data = img.image_url.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          imageData = new Blob([byteArray], { type: 'image/png' });
        } else {
          const response = await fetch(img.image_url);
          imageData = await response.blob();
        }
        
        zip.file(`imagen-${i + 1}.png`, imageData);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${zipName}.zip`;
      link.click();
      
      toast.success('Download ZIP concluído!');
    } catch (error) {
      console.error('Error creating zip:', error);
      toast.error('Erro ao criar arquivo ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };

  const downloadSelected = async () => {
    const selectedImgs = displayImages.filter(img => selectedImages.includes(img.id));
    await downloadAsZip(selectedImgs, `imagens-selecionadas-${Date.now()}`);
  };

  const downloadAll = async () => {
    await downloadAsZip(displayImages, `todas-imagens-${Date.now()}`);
  };

  const hasCredentials = imageGenerator === 'whisk' ? !!googleCookie : !!perchanceUserKey;

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
        {/* Generator Selector */}
        <div className="flex items-center gap-4 p-3 bg-background rounded-lg border">
          <Label className="text-sm font-medium">Gerador:</Label>
          <Select value={imageGenerator} onValueChange={(v: ImageGenerator) => setImageGenerator(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whisk">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>Google Whisk (IMAGEN)</span>
                </div>
              </SelectItem>
              <SelectItem value="perchance">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Perchance (Ilimitado)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Generator Info */}
        {imageGenerator === 'whisk' && (
          <div className="text-xs text-muted-foreground p-2 bg-amber-500/10 rounded border border-amber-500/20">
            <span className="font-medium text-amber-600">Google Whisk:</span> Usa cookie do Google Labs. Filtro inteligente ativo (termos como "sangue" → "líquido vermelho").
          </div>
        )}
        {imageGenerator === 'perchance' && (
          <div className="text-xs text-muted-foreground p-2 bg-green-500/10 rounded border border-green-500/20">
            <span className="font-medium text-green-600">Perchance:</span> 100% gratuito e ilimitado. Suporta 16:9 nativo (1280x720). Menos restrições de conteúdo.
          </div>
        )}

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Imagem de Referência (opcional)</Label>
            <Input
              value={subjectImageUrl}
              onChange={(e) => setSubjectImageUrl(e.target.value)}
              placeholder="URL da imagem do personagem..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>Proporção</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Paisagem (16:9)</SelectItem>
                <SelectItem value="portrait">Retrato (9:16)</SelectItem>
                <SelectItem value="square">Quadrado (1:1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Template de Estilo - Redesigned */}
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Template de Estilo</Label>
              <div className="flex gap-1">
                {styleTemplates.length > 0 && (
                  <Select onValueChange={(id) => {
                    const t = styleTemplates.find(t => t.id === id);
                    if (t) handleLoadTemplate(t);
                  }}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Carregar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {styleTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-1">
                            {t.is_favorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                            <span>{t.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={saveStyleTemplate}
                  disabled={savingStyle}
                  title="Salvar como padrão"
                >
                  {savingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
                <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" title="Salvar como novo">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Salvar Template de Estilo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome do Template</Label>
                        <Input
                          value={newTemplateName}
                          onChange={e => setNewTemplateName(e.target.value)}
                          placeholder="Ex: Estilo Cartoon"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Conteúdo</Label>
                        <Textarea value={styleTemplate} readOnly rows={3} className="mt-1 text-sm" />
                      </div>
                      <Button onClick={handleSaveAsNewTemplate} className="w-full">
                        <Save className="w-4 h-4 mr-2" />Salvar Template
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <Textarea
              value={styleTemplate}
              onChange={(e) => setStyleTemplate(e.target.value)}
              placeholder="Ex: cartoon style, white background, high quality..."
              rows={2}
              className="text-sm"
            />
            
            {styleTemplates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {styleTemplates.slice(0, 6).map(t => (
                  <Button
                    key={t.id}
                    variant={styleTemplate === t.content ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => handleLoadTemplate(t)}
                  >
                    {t.is_favorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 mr-1" />}
                    {t.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isBatchMode ? (
          <div>
            <Label>Prompts em Lote (um por linha)</Label>
            <Textarea
              value={batchPrompts}
              onChange={(e) => setBatchPrompts(e.target.value)}
              placeholder="Prompt 1&#10;Prompt 2&#10;Prompt 3"
              rows={6}
              className="mt-1 font-mono text-sm"
              disabled={loading}
            />
            
            {batchProgress && (
              <div className="mt-2 p-2 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso: {batchProgress.current} de {batchProgress.total}</span>
                  <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-muted-foreground/20 rounded-full h-2 mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all" 
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex gap-2 mt-2">
              <Button
                onClick={handleBatchGenerate}
                disabled={loading || !hasCredentials}
                className="flex-1"
                variant="fire"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '...'}
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Gerar Todas (IMAGEN_3_5)
                  </>
                )}
              </Button>
              
              {loading && (
                <Button
                  onClick={handleStopBatch}
                  variant="destructive"
                  className="px-4"
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              )}
            </div>
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
                  Gerar Imagem (IMAGEN_3_5)
                </>
              )}
            </Button>
          </div>
        )}

        {!hasCredentials && (
          <p className="text-sm text-destructive text-center">
            {imageGenerator === 'whisk' 
              ? 'Configure o Cookie do Google nas configurações para gerar imagens'
              : 'Configure a UserKey do Perchance nas configurações para gerar imagens'
            }
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
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={downloadSelected}
                    disabled={downloadingZip}
                  >
                    {downloadingZip ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Baixar ZIP ({selectedImages.length})
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
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={downloadAll}
                    disabled={downloadingZip}
                  >
                    {downloadingZip ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Baixar Todas (ZIP)
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
                      downloadImage(image.image_url, `imagen-${image.id}.png`);
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
          <p className="text-sm text-muted-foreground mt-1">Use o gerador acima para criar suas primeiras imagens com IMAGEN_3_5</p>
        </div>
      )}
    </div>
  );
}

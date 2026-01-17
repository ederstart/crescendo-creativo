import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { 
  Loader2, 
  Wand2, 
  Copy, 
  Check, 
  Eye, 
  Plus, 
  Save, 
  StopCircle, 
  Star, 
  Trash2, 
  Download,
  History,
  EyeOff,
  Settings,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAISettings } from '@/hooks/useAISettings';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import { useGeneratedImages } from '@/hooks/useGeneratedImages';
import { useStyleTemplates } from '@/hooks/useStyleTemplates';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

interface ScenePrompt {
  number: number;
  prompt: string;
}

interface SavedScenePrompts {
  id: string;
  script_id: string | null;
  script_title: string;
  prompts: ScenePrompt[];
  style_prompt: string | null;
  created_at: string;
}

type AIModel = 'groq' | 'gemini' | 'qwen' | 'deepseek' | 'llama';

// Template padrão para geração consistente de cenas
const DEFAULT_CONSISTENCY_TEMPLATE = `You are a professional scene prompt generator for AI image generation (Google Whisk/IMAGEN 3.5).

CRITICAL RULES FOR CONSISTENCY:
1. MAINTAIN the SAME character description across ALL scenes
2. MAINTAIN the SAME location/environment details
3. MAINTAIN the SAME lighting style and color grading
4. MAINTAIN the SAME camera equipment and style
5. Each scene should be 600-900 characters for maximum detail

OUTPUT FORMAT (for each scene):
Scene [NUMBER]: [Brief Action Title]
Cinematic 4K scene: [DETAILED ACTION with specific movements and expressions]. 
Main character: [FULL consistent character description - age, ethnicity, hair, clothes, accessories].
Location: [FULL consistent environment description].
Lighting: [Consistent lighting setup].
Camera: [Shot type], [Equipment], [Focal length], [Aperture].
Style: Photorealistic, ultra-detailed, professional cinematography.

Generate scenes in CHRONOLOGICAL ORDER telling a cohesive story.
Each scene must be detailed enough for standalone image generation while maintaining visual consistency.`;

// Número de cenas por lote para a API
const SCENES_PER_BATCH = 15;

export default function AILabs() {
  const { user } = useAuth();
  const { settings } = useAISettings();
  const { templates: promptTemplates, createTemplate: createPromptTemplate, deleteTemplate: deletePromptTemplate, setDefaultTemplate, refetch: refetchPromptTemplates } = usePromptTemplates('labs');
  const { templates: styleTemplates, createTemplate: createStyleTemplate, setFavorite, favoriteTemplate, deleteTemplate: deleteStyleTemplate, refetch: refetchStyleTemplates } = useStyleTemplates();
  const { images, loading: loadingImages, saveImage, deleteImage, deleteMultiple, refetch } = useGeneratedImages();
  
  // Find default template
  const defaultTemplate = promptTemplates.find(t => t.is_default);

  // State
  const [activeTab, setActiveTab] = useState('generator');
  const [model, setModel] = useState<AIModel>('groq');
  const [projectTheme, setProjectTheme] = useState('');
  const [totalScenes, setTotalScenes] = useState(30);
  const [sceneCharacters, setSceneCharacters] = useState(700);
  const [consistencyTemplate, setConsistencyTemplate] = useState(DEFAULT_CONSISTENCY_TEMPLATE);
  const [styleTemplate, setStyleTemplate] = useState('');
  const [generatedScenes, setGeneratedScenes] = useState<ScenePrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [progress, setProgress] = useState(0);
  const stopGenerationRef = useRef(false);
  
  // Template management
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showManageTemplatesDialog, setShowManageTemplatesDialog] = useState(false);
  const [showManageStylesDialog, setShowManageStylesDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Saved scene prompts
  const [savedScenePrompts, setSavedScenePrompts] = useState<SavedScenePrompts[]>([]);
  const [showSavedPrompts, setShowSavedPrompts] = useState(false);

  // Image generation
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [batchImageProgress, setBatchImageProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const stopImageGenRef = useRef(false);
  
  // Regeneration dialog
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedImageForRegen, setSelectedImageForRegen] = useState<typeof images[0] | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');

  // Load settings
  useEffect(() => {
    if (settings?.preferred_model_scene) {
      setModel(settings.preferred_model_scene as AIModel);
    }
    if (favoriteTemplate) {
      setStyleTemplate(favoriteTemplate.content);
    }
  }, [settings, favoriteTemplate]);

  // Load default template
  useEffect(() => {
    if (defaultTemplate) {
      setConsistencyTemplate(defaultTemplate.content);
    }
  }, [defaultTemplate]);

  // Fetch saved scene prompts
  useEffect(() => {
    if (user) {
      fetchSavedScenePrompts();
    }
  }, [user]);

  const fetchSavedScenePrompts = async () => {
    const { data, error } = await supabase
      .from('generated_scene_prompts')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedScenePrompts(data);
    }
  };

  const handleStop = () => {
    stopGenerationRef.current = true;
    toast.info('Parando após o lote atual...');
  };

  const handleGenerate = async () => {
    if (!projectTheme.trim()) {
      toast.error('Digite o tema do projeto');
      return;
    }

    setLoading(true);
    setGeneratedScenes([]);
    setProgress(0);
    stopGenerationRef.current = false;

    try {
      const numBatches = Math.ceil(totalScenes / SCENES_PER_BATCH);
      setTotalBatches(numBatches);
      
      const allScenes: ScenePrompt[] = [];
      
      for (let i = 0; i < numBatches; i++) {
        if (stopGenerationRef.current) {
          toast.info(`Geração interrompida. ${allScenes.length} cenas geradas.`);
          break;
        }
        
        setCurrentBatch(i + 1);
        setProgress(Math.round((i / numBatches) * 100));
        
        const scenesInBatch = i === numBatches - 1 
          ? totalScenes - (SCENES_PER_BATCH * i) 
          : SCENES_PER_BATCH;
        
        const startSceneNum = allScenes.length + 1;
        
        const systemPrompt = `${consistencyTemplate}

PROJECT THEME: ${projectTheme}
${styleTemplate ? `VISUAL STYLE REFERENCE: ${styleTemplate}` : ''}

Generate scenes ${startSceneNum} to ${startSceneNum + scenesInBatch - 1} of a ${totalScenes}-scene video.
Each scene prompt should be approximately ${sceneCharacters} characters for maximum detail.
Maintain PERFECT consistency across all scenes.`;

        const userPrompt = i === 0 
          ? `Create the first ${scenesInBatch} scenes (scenes ${startSceneNum}-${startSceneNum + scenesInBatch - 1}) for this ${totalScenes}-scene video about "${projectTheme}".
Start with establishing shots and introduce the main character(s) and setting.
Output ONLY the scene prompts in the exact format specified, no additional text.`
          : `Continue with scenes ${startSceneNum}-${startSceneNum + scenesInBatch - 1}.
Previous scenes summary: Scenes 1-${startSceneNum - 1} have been generated.
Maintain the EXACT same character descriptions, environment, lighting, and camera style.
Progress the story naturally from where we left off.
Output ONLY the scene prompts in the exact format specified, no additional text.`;

        const { data, error } = await supabase.functions.invoke('generate-scene-prompts', {
          body: {
            scriptContent: userPrompt,
            splitMode: 'scenes',
            numberOfScenes: scenesInBatch,
            model,
            stylePrompt: systemPrompt,
            batchIndex: i,
            totalBatches: numBatches,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        const renumberedScenes = data.scenes.map((scene: ScenePrompt, idx: number) => ({
          ...scene,
          number: startSceneNum + idx,
        }));
        
        allScenes.push(...renumberedScenes);
        setGeneratedScenes([...allScenes]);
        
        if (!stopGenerationRef.current && i < numBatches - 1) {
          toast.info(`Lote ${i + 1}/${numBatches} concluído. Aguardando 8s...`);
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }
      
      setProgress(100);
      
      if (!stopGenerationRef.current && allScenes.length > 0) {
        toast.success(`${allScenes.length} cenas geradas com sucesso!`);
        // Auto-save
        await saveScenePrompts(allScenes);
      }
    } catch (error) {
      console.error('Error generating scenes:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar cenas');
    } finally {
      setLoading(false);
      setCurrentBatch(0);
      setTotalBatches(0);
      stopGenerationRef.current = false;
    }
  };

  const saveScenePrompts = async (prompts: ScenePrompt[]) => {
    if (!user) return;

    const { error } = await supabase
      .from('generated_scene_prompts')
      .insert({
        user_id: user.id,
        script_id: null,
        script_title: `AI Labs: ${projectTheme.substring(0, 50)}`,
        prompts: prompts,
        style_prompt: consistencyTemplate,
      });

    if (error) {
      console.error('Error saving scene prompts:', error);
    } else {
      fetchSavedScenePrompts();
    }
  };

  const copyPrompt = async (prompt: string, index: number) => {
    await navigator.clipboard.writeText(prompt);
    setCopiedIndex(index);
    toast.success('Prompt copiado!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllPrompts = async () => {
    const allPrompts = generatedScenes.map(p => `Cena ${p.number}: ${p.prompt}`).join('\n\n');
    await navigator.clipboard.writeText(allPrompts);
    toast.success('Todos os prompts copiados!');
  };

  const loadSavedPrompts = (saved: SavedScenePrompts) => {
    setGeneratedScenes(saved.prompts);
    if (saved.style_prompt) {
      setConsistencyTemplate(saved.style_prompt);
    }
    toast.success(`${saved.prompts.length} cenas carregadas`);
  };

  const deleteSavedPrompts = async (id: string) => {
    const { error } = await supabase
      .from('generated_scene_prompts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir');
    } else {
      setSavedScenePrompts(prev => prev.filter(p => p.id !== id));
      toast.success('Cenas excluídas');
    }
  };

  // Image generation
  const handleGenerateAllImages = async () => {
    if (generatedScenes.length === 0) {
      toast.error('Gere as cenas primeiro');
      return;
    }

    if (!settings?.google_cookie) {
      toast.error('Configure o Cookie do Google nas configurações');
      return;
    }

    stopImageGenRef.current = false;
    setBatchImageProgress({ current: 0, total: generatedScenes.length });

    for (let i = 0; i < generatedScenes.length; i++) {
      if (stopImageGenRef.current) {
        toast.info(`Geração interrompida. ${i} imagens geradas.`);
        break;
      }

      setBatchImageProgress({ current: i + 1, total: generatedScenes.length });
      toast.info(`Gerando imagem ${i + 1}/${generatedScenes.length}...`);

      try {
        const { data, error } = await supabase.functions.invoke('generate-whisk-v2', {
          body: {
            prompt: generatedScenes[i].prompt,
            cookie: settings.google_cookie,
            styleTemplate: styleTemplate.trim() || undefined,
            aspectRatio: 'landscape',
          },
        });

        if (error) throw error;
        
        if (data.error) {
          toast.error(`Cena ${i + 1}: ${data.error}`);
          continue;
        }

        const imageUrl = data.imageBase64.startsWith('data:') 
          ? data.imageBase64 
          : `data:image/png;base64,${data.imageBase64}`;

        await saveImage({
          image_url: imageUrl,
          prompt_used: generatedScenes[i].prompt,
          scene_description: `Cena ${generatedScenes[i].number}: ${generatedScenes[i].prompt.substring(0, 100)}`,
        });

      } catch (error) {
        console.error('Error generating image:', error);
        toast.error(`Erro na cena ${i + 1}`);
      }

      // Wait between requests
      if (!stopImageGenRef.current && i < generatedScenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    setBatchImageProgress(null);
    refetch();
    if (!stopImageGenRef.current) {
      toast.success('Todas as imagens foram geradas!');
    }
  };

  const handleStopImageGeneration = () => {
    stopImageGenRef.current = true;
    toast.info('Parando após a imagem atual...');
  };

  // Regenerate image
  const openRegenerateDialog = (image: typeof images[0]) => {
    setSelectedImageForRegen(image);
    setRegeneratePrompt(image.prompt_used || '');
    setRegenerateDialogOpen(true);
  };

  const handleRegenerate = async () => {
    if (!regeneratePrompt.trim()) {
      toast.error('Digite um prompt');
      return;
    }

    if (regeneratePrompt === selectedImageForRegen?.prompt_used) {
      toast.error('Altere o prompt para obter um resultado diferente');
      return;
    }

    if (!settings?.google_cookie) {
      toast.error('Configure o Cookie do Google');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-whisk-v2', {
        body: {
          prompt: regeneratePrompt,
          cookie: settings.google_cookie,
          styleTemplate: styleTemplate.trim() || undefined,
          aspectRatio: 'landscape',
        },
      });

      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      const imageUrl = data.imageBase64.startsWith('data:') 
        ? data.imageBase64 
        : `data:image/png;base64,${data.imageBase64}`;

      await saveImage({
        image_url: imageUrl,
        prompt_used: regeneratePrompt,
        scene_description: `Regenerado: ${regeneratePrompt.substring(0, 100)}`,
      });

      toast.success('Imagem regenerada!');
      setRegenerateDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error regenerating:', error);
      toast.error('Erro ao regenerar imagem');
    } finally {
      setLoading(false);
    }
  };

  // Download functions
  const downloadImage = async (url: string, filename: string) => {
    try {
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

  const downloadAsZip = async (imagesToDownload: typeof images, zipName: string) => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < imagesToDownload.length; i++) {
        const img = imagesToDownload[i];
        let imageData: Blob;
        
        if (img.image_url.startsWith('data:')) {
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
        
        zip.file(`cena-${i + 1}.png`, imageData);
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

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Digite o nome do template');
      return;
    }
    await createPromptTemplate({
      name: newTemplateName,
      type: 'labs',
      content: consistencyTemplate,
      is_default: false,
    });
    setNewTemplateName('');
    setShowSaveTemplateDialog(false);
    refetchPromptTemplates();
  };

  const handleDeletePromptTemplate = async (id: string, name: string) => {
    if (!confirm(`Excluir template "${name}"?`)) return;
    await deletePromptTemplate(id);
    refetchPromptTemplates();
  };

  const handleDeleteStyleTemplate = async (id: string, name: string) => {
    if (!confirm(`Excluir estilo "${name}"?`)) return;
    await deleteStyleTemplate(id);
    refetchStyleTemplates();
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Labs</h1>
          <p className="text-muted-foreground">Gerador profissional de cenas com consistência visual</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <a href="/settings">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generator">
            <Wand2 className="w-4 h-4 mr-2" />
            Gerador
          </TabsTrigger>
          <TabsTrigger value="scenes">
            <FileText className="w-4 h-4 mr-2" />
            Cenas ({generatedScenes.length})
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <ImageIcon className="w-4 h-4 mr-2" />
            Galeria ({images.length})
          </TabsTrigger>
          <TabsTrigger value="saved">
            <History className="w-4 h-4 mr-2" />
            Salvos ({savedScenePrompts.length})
          </TabsTrigger>
        </TabsList>

        {/* Generator Tab */}
        <TabsContent value="generator" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Theme */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Tema do Projeto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Descreva o tema do vídeo</Label>
                  <Textarea
                    value={projectTheme}
                    onChange={(e) => setProjectTheme(e.target.value)}
                    placeholder="Ex: Restauração de carros clássicos, Construindo uma casa na floresta, Cozinhando pratos italianos em restaurante tradicional..."
                    rows={4}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Seja específico sobre o tema, personagens e ambiente desejado
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Número de Cenas</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[totalScenes]}
                        onValueChange={(v) => setTotalScenes(v[0])}
                        min={10}
                        max={200}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">{totalScenes}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Caracteres por Cena</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Slider
                        value={[sceneCharacters]}
                        onValueChange={(v) => setSceneCharacters(v[0])}
                        min={300}
                        max={1200}
                        step={50}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-12 text-right">{sceneCharacters}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Modelo de IA</Label>
                  <Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groq">Groq (Rápido)</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="qwen">Qwen (OpenRouter)</SelectItem>
                      <SelectItem value="deepseek">DeepSeek (OpenRouter)</SelectItem>
                      <SelectItem value="llama">Llama (OpenRouter)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Consistency Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Template de Consistência
                  </span>
                  <div className="flex gap-1">
                    {promptTemplates.length > 0 && (
                      <Select onValueChange={(id) => {
                        const t = promptTemplates.find(t => t.id === id);
                        if (t) {
                          setConsistencyTemplate(t.content);
                          toast.success(`Template "${t.name}" carregado`);
                        }
                      }}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="Carregar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {promptTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-1">
                                {t.is_default && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                                <span>{t.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Dialog open={showManageTemplatesDialog} onOpenChange={setShowManageTemplatesDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Gerenciar templates">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Gerenciar Templates</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                          {promptTemplates.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-4">Nenhum template salvo</p>
                          ) : (
                            promptTemplates.map(t => (
                              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-2">
                                  {t.is_default && <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />}
                                  <span className="font-medium">{t.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setConsistencyTemplate(t.content);
                                      toast.success(`Template "${t.name}" carregado`);
                                      setShowManageTemplatesDialog(false);
                                    }}
                                    title="Carregar"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setDefaultTemplate(t.id, 'labs')}
                                    title="Definir como padrão"
                                  >
                                    <Star className={cn("w-4 h-4", t.is_default && "fill-yellow-500 text-yellow-500")} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeletePromptTemplate(t.id, t.name)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Salvar template">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Salvar Template de Consistência</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Nome do Template</Label>
                            <Input
                              value={newTemplateName}
                              onChange={e => setNewTemplateName(e.target.value)}
                              placeholder="Ex: Estilo Cinematográfico"
                              className="mt-1"
                            />
                          </div>
                          <Button onClick={handleSaveTemplate} className="w-full">
                            <Save className="w-4 h-4 mr-2" />Salvar
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setConsistencyTemplate(DEFAULT_CONSISTENCY_TEMPLATE)}
                      title="Restaurar padrão"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={consistencyTemplate}
                  onChange={(e) => setConsistencyTemplate(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Este template define as regras de consistência visual para todas as cenas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Style Template */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Template de Estilo Visual (Opcional)
                </span>
                <div className="flex gap-1">
                  {styleTemplates.length > 0 && (
                    <Select onValueChange={(id) => {
                      const t = styleTemplates.find(t => t.id === id);
                      if (t) {
                        setStyleTemplate(t.content);
                        toast.success(`Estilo "${t.name}" aplicado`);
                      }
                    }}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Carregar estilo..." />
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
                  <Dialog open={showManageStylesDialog} onOpenChange={setShowManageStylesDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8" title="Gerenciar estilos">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Gerenciar Estilos Visuais</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {styleTemplates.length === 0 ? (
                          <p className="text-muted-foreground text-sm text-center py-4">Nenhum estilo salvo</p>
                        ) : (
                          styleTemplates.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                {t.is_favorite && <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />}
                                <span className="font-medium">{t.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setStyleTemplate(t.content);
                                    toast.success(`Estilo "${t.name}" aplicado`);
                                    setShowManageStylesDialog(false);
                                  }}
                                  title="Aplicar"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setFavorite(t.id)}
                                  title="Favoritar"
                                >
                                  <Star className={cn("w-4 h-4", t.is_favorite && "fill-yellow-500 text-yellow-500")} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteStyleTemplate(t.id, t.name)}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setStyleTemplate('')}
                    title="Limpar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={styleTemplate}
                onChange={(e) => setStyleTemplate(e.target.value)}
                placeholder="Ex: Cinematic 4K, golden hour lighting, RED Komodo 6K camera, professional color grading with earthy tones, shallow depth of field..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Progress & Actions */}
          {loading && (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Gerando lote {currentBatch} de {totalBatches}...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={loading || !projectTheme.trim()}
              className="flex-1"
              variant="fire"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Gerando Cenas...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Gerar {totalScenes} Cenas
                </>
              )}
            </Button>
            
            {loading && (
              <Button onClick={handleStop} variant="destructive" size="lg">
                <StopCircle className="w-5 h-5 mr-2" />
                Parar
              </Button>
            )}
          </div>
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="space-y-4">
          {generatedScenes.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{generatedScenes.length} Cenas Geradas</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={copyAllPrompts}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Todas
                  </Button>
                  <Button
                    size="sm"
                    variant="fire"
                    onClick={handleGenerateAllImages}
                    disabled={loading || batchImageProgress !== null || !settings?.google_cookie}
                  >
                    {batchImageProgress ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {batchImageProgress.current}/{batchImageProgress.total}
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Gerar Todas as Imagens
                      </>
                    )}
                  </Button>
                  {batchImageProgress && (
                    <Button size="sm" variant="destructive" onClick={handleStopImageGeneration}>
                      <StopCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {batchImageProgress && (
                <Progress value={(batchImageProgress.current / batchImageProgress.total) * 100} />
              )}

              <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                {generatedScenes.map((scene, idx) => (
                  <Card key={scene.number} className="relative">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Cena {scene.number}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {scene.prompt.length} caracteres
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {scene.prompt}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="flex-shrink-0"
                          onClick={() => copyPrompt(scene.prompt, idx)}
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Wand2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma cena gerada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use o gerador para criar suas cenas
              </p>
            </div>
          )}
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="space-y-4">
          {images.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{images.length} Imagens</h3>
                <div className="flex gap-2">
                  {selectedImages.length > 0 ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedImages([])}>
                        Limpar seleção
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const selected = images.filter(img => selectedImages.includes(img.id));
                          downloadAsZip(selected, `ai-labs-selecionadas-${Date.now()}`);
                        }}
                        disabled={downloadingZip}
                      >
                        {downloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="ml-2">ZIP ({selectedImages.length})</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          deleteMultiple(selectedImages);
                          setSelectedImages([]);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedImages(images.map(i => i.id))}>
                        Selecionar todas
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => downloadAsZip(images, `ai-labs-todas-${Date.now()}`)}
                        disabled={downloadingZip}
                      >
                        {downloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span className="ml-2">Baixar Todas</span>
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
                          openRegenerateDialog(image);
                        }}
                        title="Regenerar com novo prompt"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(image.image_url, `ai-labs-${image.id}.png`);
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
                          deleteImage(image.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma imagem gerada ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Gere cenas e use "Gerar Todas as Imagens"
              </p>
            </div>
          )}
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="space-y-4">
          {savedScenePrompts.length > 0 ? (
            <div className="space-y-2">
              {savedScenePrompts.map((saved) => (
                <Card key={saved.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{saved.script_title}</p>
                        <p className="text-xs text-muted-foreground">
                          {saved.prompts.length} cenas • {new Date(saved.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => loadSavedPrompts(saved)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteSavedPrompts(saved.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma cena salva ainda</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Regenerar Imagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedImageForRegen && (
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedImageForRegen.image_url}
                  alt="Imagem original"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <Label>Prompt (edite para obter resultado diferente)</Label>
              <Textarea
                value={regeneratePrompt}
                onChange={(e) => setRegeneratePrompt(e.target.value)}
                rows={6}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Altere o prompt para gerar uma variação da imagem
              </p>
            </div>
            <Button
              onClick={handleRegenerate}
              disabled={loading || !regeneratePrompt.trim()}
              className="w-full"
              variant="fire"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerar com Novo Prompt
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

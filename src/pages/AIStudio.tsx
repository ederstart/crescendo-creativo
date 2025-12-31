import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Wand2, Image, Settings, Copy, Save, Layers, Trash2 } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import { useGeneratedImages } from '@/hooks/useGeneratedImages';
import { PromptTemplateManager } from '@/components/ai/PromptTemplateManager';
import { ScriptGenerator } from '@/components/ai/ScriptGenerator';
import { ScenePromptGenerator } from '@/components/ai/ScenePromptGenerator';
import { ImageGallery } from '@/components/ai/ImageGallery';
import { MultiStepScriptWizard } from '@/components/ai/MultiStepScriptWizard';
import { toast } from 'sonner';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const SCRIPT_STORAGE_KEY = 'ai_studio_generated_script';
const SCRIPT_TITLE_STORAGE_KEY = 'ai_studio_script_title';

export default function AIStudio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { settings, saveSettings } = useAISettings();
  const { templates, createTemplate, updateTemplate, deleteTemplate, setDefaultTemplate } = usePromptTemplates();
  const { images, saveImage, deleteImage, deleteMultiple, refetch: refetchImages } = useGeneratedImages();
  
  const [generatedScript, setGeneratedScript] = useState(() => {
    return localStorage.getItem(SCRIPT_STORAGE_KEY) || '';
  });
  const [scriptTitle, setScriptTitle] = useState(() => {
    return localStorage.getItem(SCRIPT_TITLE_STORAGE_KEY) || '';
  });
  const [selectedScriptPrompt, setSelectedScriptPrompt] = useState('');
  const [selectedScenePrompt, setSelectedScenePrompt] = useState('');
  const [savingScript, setSavingScript] = useState(false);
  const [activeTab, setActiveTab] = useState('script');
  const [imagePromptFromScene, setImagePromptFromScene] = useState('');
  const [batchPromptsForImages, setBatchPromptsForImages] = useState('');
  
  // Automation state
  const [automationScriptId, setAutomationScriptId] = useState<string | null>(null);
  const [automationPending, setAutomationPending] = useState(false);
  const [autoStartImageGeneration, setAutoStartImageGeneration] = useState(false);

  // Read URL params for title (from Script Ideas)
  useEffect(() => {
    const titleFromUrl = searchParams.get('title');
    if (titleFromUrl) {
      setScriptTitle(titleFromUrl);
      // Concatenar template existente + título ao invés de substituir
      const existingTemplate = templates.find(t => t.type === 'script' && t.is_default)?.content || '';
      const titlePrompt = `Tema do vídeo: ${titleFromUrl}`;
      setSelectedScriptPrompt(existingTemplate ? `${existingTemplate}\n\n${titlePrompt}` : titlePrompt);
      // Clear the param after reading
      searchParams.delete('title');
      setSearchParams(searchParams, { replace: true });
      toast.info(`Criando roteiro: "${titleFromUrl}"`);
    }
    
    // Read automation params
    const automate = searchParams.get('automate');
    const scriptId = searchParams.get('scriptId');
    if (automate === 'true' && scriptId) {
      setAutomationScriptId(scriptId);
      setAutomationPending(true);
      setActiveTab('scene');
      // Clear params
      searchParams.delete('automate');
      searchParams.delete('scriptId');
      setSearchParams(searchParams, { replace: true });
      toast.info('Iniciando automação: gerando cenas...');
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (generatedScript) {
      localStorage.setItem(SCRIPT_STORAGE_KEY, generatedScript);
    }
  }, [generatedScript]);

  useEffect(() => {
    if (scriptTitle) {
      localStorage.setItem(SCRIPT_TITLE_STORAGE_KEY, scriptTitle);
    }
  }, [scriptTitle]);

  const handleScriptGenerated = (content: string) => {
    setGeneratedScript(content);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success('Roteiro copiado!');
  };

  const clearScript = () => {
    if (!confirm('Limpar o roteiro gerado?')) return;
    setGeneratedScript('');
    setScriptTitle('');
    localStorage.removeItem(SCRIPT_STORAGE_KEY);
    localStorage.removeItem(SCRIPT_TITLE_STORAGE_KEY);
    toast.success('Roteiro limpo');
  };

  const handleTemplateSelect = (template: { content: string }) => {
    setSelectedScriptPrompt(template.content);
    toast.success('Template carregado! Complete seu pedido abaixo.');
  };

  const handleSceneTemplateSelect = (template: { content: string }) => {
    setSelectedScenePrompt(template.content);
  };

  const handleApplyPromptToImage = (prompt: string) => {
    setImagePromptFromScene(prompt);
    setActiveTab('images');
    toast.success('Prompt aplicado! Configure e gere a imagem.');
  };

  const handleApplyAllPromptsToImages = (prompts: string[]) => {
    setBatchPromptsForImages(prompts.join('\n'));
    setActiveTab('images');
    toast.success(`${prompts.length} prompts prontos! Clique em "Gerar Todas" para criar as imagens.`);
  };

  const saveScriptToDatabase = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    if (!scriptTitle.trim()) {
      toast.error('Digite um título para o roteiro');
      return;
    }

    if (!generatedScript.trim()) {
      toast.error('Gere um roteiro primeiro');
      return;
    }

    setSavingScript(true);

    try {
      const { data, error } = await supabase
        .from('scripts')
        .insert({
          user_id: user.id,
          title: scriptTitle,
          content: generatedScript,
          status: 'draft',
          project_id: null,
        })
        .select()
        .single();

      if (error) throw error;

      localStorage.removeItem(SCRIPT_STORAGE_KEY);
      localStorage.removeItem(SCRIPT_TITLE_STORAGE_KEY);
      
      toast.success('Roteiro salvo com sucesso!');
      navigate(`/scripts/${data.id}`);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSavingScript(false);
    }
  };

  const handleFavoriteModel = async (section: 'script' | 'scene', model: string) => {
    const updates: any = {};
    if (section === 'script') {
      updates.preferred_model_script = model;
    } else {
      updates.preferred_model_scene = model;
    }
    
    await saveSettings({
      ...settings,
      ...updates,
    });
    toast.success('Modelo favorito salvo!');
  };

  const defaultScriptTemplate = templates.find(t => t.type === 'script' && t.is_default);
  const defaultSceneTemplate = templates.find(t => t.type === 'scene' && t.is_default);

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">AI Studio</h1>
          <p className="text-muted-foreground mt-1">Gere roteiros, cenas e imagens com IA</p>
        </div>
        <Button variant="ghost" asChild>
          <NavLink to="/settings">
            <Settings className="w-4 h-4 mr-2" />
            Configurar APIs
          </NavLink>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger 
            value="script" 
            className={`flex items-center gap-2 transition-all ${activeTab === 'script' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white' : ''}`}
          >
            <FileText className="w-4 h-4" />
            Roteiro
          </TabsTrigger>
          <TabsTrigger 
            value="wizard" 
            className={`flex items-center gap-2 transition-all ${activeTab === 'wizard' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white' : ''}`}
          >
            <Layers className="w-4 h-4" />
            Multi-Etapas
          </TabsTrigger>
          <TabsTrigger 
            value="scene" 
            className={`flex items-center gap-2 transition-all ${activeTab === 'scene' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white' : ''}`}
          >
            <Wand2 className="w-4 h-4" />
            Cenas
          </TabsTrigger>
          <TabsTrigger 
            value="images" 
            className={`flex items-center gap-2 transition-all ${activeTab === 'images' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white' : ''}`}
          >
            <Image className="w-4 h-4" />
            Imagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="script" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <PromptTemplateManager
                templates={templates}
                type="script"
                onSelect={handleTemplateSelect}
                onCreate={createTemplate}
                onUpdate={updateTemplate}
                onDelete={deleteTemplate}
                onSetDefault={setDefaultTemplate}
              />
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Gerar Roteiro</h3>
              <ScriptGenerator
                groqApiKey={settings?.groq_api_key}
                geminiApiKey={settings?.gemini_api_key}
                openrouterApiKey={settings?.openrouter_api_key}
                templateContent={selectedScriptPrompt || defaultScriptTemplate?.content || ''}
                preferredModel={settings?.preferred_model_script || 'groq'}
                onGenerated={handleScriptGenerated}
                onFavoriteModel={(model) => handleFavoriteModel('script', model)}
              />
            </div>
          </div>

          {generatedScript && (
            <div className="glass rounded-xl p-6">
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Roteiro Gerado</h3>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={copyScript}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearScript} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpar
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="script-title">Título do Roteiro</Label>
                    <Input
                      id="script-title"
                      value={scriptTitle}
                      onChange={(e) => setScriptTitle(e.target.value)}
                      placeholder="Digite o título do seu roteiro..."
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    variant="fire" 
                    onClick={saveScriptToDatabase}
                    disabled={savingScript || !scriptTitle.trim()}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingScript ? 'Salvando...' : 'Salvar Roteiro'}
                  </Button>
                </div>
              </div>
              
              <Textarea
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground mt-2 text-right">
                {generatedScript.length.toLocaleString('pt-BR')} caracteres
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="wizard" className="space-y-6">
          <div className="glass rounded-xl p-6 max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">Roteiro em Etapas</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Construa seu roteiro passo a passo: título, sinopse, estrutura e expansão.
            </p>
            <MultiStepScriptWizard
              groqApiKey={settings?.groq_api_key}
              geminiApiKey={settings?.gemini_api_key}
              openrouterApiKey={settings?.openrouter_api_key}
              preferredModel={settings?.preferred_model_script || 'groq'}
              onComplete={(script, title) => {
                setGeneratedScript(script);
                setScriptTitle(title);
                toast.success('Roteiro criado! Vá para a aba "Roteiro" para salvar.');
              }}
              onFavoriteModel={(model) => handleFavoriteModel('script', model)}
            />
          </div>
        </TabsContent>

        <TabsContent value="scene" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <PromptTemplateManager
                templates={templates}
                type="scene"
                onSelect={handleSceneTemplateSelect}
                onCreate={createTemplate}
                onUpdate={updateTemplate}
                onDelete={deleteTemplate}
                onSetDefault={setDefaultTemplate}
              />
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Gerar Prompts de Cenas</h3>
              <ScenePromptGenerator
                groqApiKey={settings?.groq_api_key}
                geminiApiKey={settings?.gemini_api_key}
                openrouterApiKey={settings?.openrouter_api_key}
                defaultStylePrompt={selectedScenePrompt || defaultSceneTemplate?.content || ''}
                preferredModel={settings?.preferred_model_scene || 'groq'}
                onPromptsGenerated={() => {}}
                onFavoriteModel={(model) => handleFavoriteModel('scene', model)}
                onApplyPrompt={handleApplyPromptToImage}
                onApplyAllPrompts={handleApplyAllPromptsToImages}
                autoSelectScriptId={automationScriptId}
                autoStart={automationPending}
                onAutomationComplete={() => {
                  setAutomationPending(false);
                  setAutomationScriptId(null);
                  // Trigger auto image generation after scenes are ready
                  setAutoStartImageGeneration(true);
                  toast.success('Cenas geradas! Iniciando geração de imagens...');
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="images">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Galeria de Imagens (IMAGEN_3_5)</h3>
            <ImageGallery
              googleCookie={settings?.google_cookie}
              styleTemplate={settings?.style_template}
              images={images}
              onImageGenerated={saveImage}
              onDeleteImage={deleteImage}
              onDeleteMultiple={deleteMultiple}
              onSaveStyleTemplate={async (template) => {
                await saveSettings({ style_template: template });
              }}
              onRefetch={refetchImages}
              initialPrompt={imagePromptFromScene}
              onPromptUsed={() => setImagePromptFromScene('')}
              initialBatchPrompts={batchPromptsForImages}
              onBatchPromptsUsed={() => setBatchPromptsForImages('')}
              autoStartBatch={autoStartImageGeneration}
              onAutoStartBatchComplete={() => {
                setAutoStartImageGeneration(false);
                toast.success('Automação completa! Todas as imagens foram geradas.');
              }}
            />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

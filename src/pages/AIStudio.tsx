import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Wand2, Image, Settings, Copy, Save } from 'lucide-react';
import { useAISettings } from '@/hooks/useAISettings';
import { usePromptTemplates } from '@/hooks/usePromptTemplates';
import { useGeneratedImages } from '@/hooks/useGeneratedImages';
import { PromptTemplateManager } from '@/components/ai/PromptTemplateManager';
import { ScriptGenerator } from '@/components/ai/ScriptGenerator';
import { ScenePromptGenerator } from '@/components/ai/ScenePromptGenerator';
import { ImageGallery } from '@/components/ai/ImageGallery';
import { toast } from 'sonner';
import { NavLink, useNavigate } from 'react-router-dom';

export default function AIStudio() {
  const navigate = useNavigate();
  const { settings } = useAISettings();
  const { templates, createTemplate, updateTemplate, deleteTemplate, setDefaultTemplate } = usePromptTemplates();
  const { images, saveImage, deleteImage, deleteMultiple } = useGeneratedImages();
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [selectedScriptPrompt, setSelectedScriptPrompt] = useState('');
  const [selectedScenePrompt, setSelectedScenePrompt] = useState('');

  const handleScriptGenerated = (content: string, model: string) => {
    setGeneratedScript(content);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success('Roteiro copiado!');
  };

  const saveScript = () => {
    // Navigate to scripts page with script content
    sessionStorage.setItem('newScriptContent', generatedScript);
    navigate('/scripts/new');
    toast.success('Redirecionando para salvar o roteiro...');
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

      <Tabs defaultValue="script" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="script" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Roteiro
          </TabsTrigger>
          <TabsTrigger value="scene" className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Cenas
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Imagens
          </TabsTrigger>
        </TabsList>

        {/* Script Tab */}
        <TabsContent value="script" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <PromptTemplateManager
                templates={templates}
                type="script"
                onSelect={(t) => setSelectedScriptPrompt(t.content)}
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
                defaultPrompt={selectedScriptPrompt || defaultScriptTemplate?.content || ''}
                onGenerated={handleScriptGenerated}
              />
            </div>
          </div>

          {generatedScript && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Roteiro Gerado</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={copyScript}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                  <Button variant="fire" size="sm" onClick={saveScript}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Roteiro
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
            </div>
          )}
        </TabsContent>

        {/* Scene Tab */}
        <TabsContent value="scene" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-xl p-6">
              <PromptTemplateManager
                templates={templates}
                type="scene"
                onSelect={(t) => setSelectedScenePrompt(t.content)}
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
                scriptContent={generatedScript}
                defaultStylePrompt={selectedScenePrompt || defaultSceneTemplate?.content || ''}
                onPromptsGenerated={() => {}}
              />
            </div>
          </div>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Galeria de Imagens (Whisk)</h3>
            <ImageGallery
              whiskToken={settings?.whisk_token}
              whiskSessionId={settings?.whisk_session_id}
              images={images}
              onImageGenerated={saveImage}
              onDeleteImage={deleteImage}
              onDeleteMultiple={deleteMultiple}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
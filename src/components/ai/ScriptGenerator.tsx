import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ScriptGeneratorProps {
  groqApiKey?: string;
  geminiApiKey?: string;
  defaultPrompt?: string;
  onGenerated: (content: string, model: string) => void;
}

export function ScriptGenerator({ 
  groqApiKey, 
  geminiApiKey, 
  defaultPrompt = '',
  onGenerated 
}: ScriptGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [model, setModel] = useState<'groq' | 'gemini'>('groq');
  const [loading, setLoading] = useState(false);
  const [attachedContent, setAttachedContent] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Apenas arquivos .txt ou .doc/.docx são suportados');
      return;
    }

    try {
      const text = await file.text();
      setAttachedContent(text);
      setAttachedFileName(file.name);
      toast.success('Arquivo anexado!');
    } catch (error) {
      toast.error('Erro ao ler arquivo');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Digite um prompt');
      return;
    }

    const apiKey = model === 'groq' ? groqApiKey : geminiApiKey;
    if (!apiKey) {
      toast.error(`Configure a API key do ${model === 'groq' ? 'Groq' : 'Gemini'} nas configurações`);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt,
          model,
          apiKey,
          systemPrompt,
          attachedContent: attachedContent || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onGenerated(data.generatedText, data.model);
      toast.success('Roteiro gerado com sucesso!');
    } catch (error) {
      console.error('Error generating script:', error);
      toast.error('Erro ao gerar roteiro');
    } finally {
      setLoading(false);
    }
  };

  const hasApiKey = model === 'groq' ? !!groqApiKey : !!geminiApiKey;

  return (
    <div className="space-y-4">
      <div>
        <Label>Modelo de IA</Label>
        <Select value={model} onValueChange={(v) => setModel(v as 'groq' | 'gemini')}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="groq">
              <div className="flex items-center gap-2">
                <span>Groq (Llama 3.3 70B)</span>
                {!groqApiKey && <span className="text-xs text-destructive">- Sem API Key</span>}
              </div>
            </SelectItem>
            <SelectItem value="gemini">
              <div className="flex items-center gap-2">
                <span>Gemini 1.5 Flash</span>
                {!geminiApiKey && <span className="text-xs text-destructive">- Sem API Key</span>}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Prompt do Sistema (Personalidade da IA)</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Ex: Você é um roteirista profissional de vídeos para YouTube..."
          rows={3}
          className="mt-1 font-mono text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Conteúdo de Referência (opcional)</Label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.doc,.docx"
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Anexar Arquivo
          </Button>
        </div>
        
        {attachedFileName ? (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground flex-1">{attachedFileName}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setAttachedContent('');
                setAttachedFileName('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Textarea
            value={attachedContent}
            onChange={(e) => setAttachedContent(e.target.value)}
            placeholder="Cole aqui o conteúdo que a IA deve usar como referência, ou anexe um arquivo..."
            rows={4}
            className="font-mono text-sm"
          />
        )}
      </div>

      <div>
        <Label>Seu Pedido</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: Crie um roteiro para um vídeo sobre como começar a investir em ações..."
          rows={4}
          className="mt-1"
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading || !hasApiKey}
        className="w-full"
        variant="fire"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Gerar Roteiro
          </>
        )}
      </Button>

      {!hasApiKey && (
        <p className="text-sm text-destructive text-center">
          Configure a API Key do {model === 'groq' ? 'Groq' : 'Gemini'} nas configurações
        </p>
      )}
    </div>
  );
}

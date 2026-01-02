import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAISettings } from '@/hooks/useAISettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Lock, Bot, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { settings, saveSettings } = useAISettings();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [validatingCookie, setValidatingCookie] = useState(false);
  const [cookieValidationResult, setCookieValidationResult] = useState<'success' | 'error' | null>(null);
  const [claudeCookieValidationResult, setClaudeCookieValidationResult] = useState<'success' | 'error' | null>(null);
  const [validatingClaudeCookie, setValidatingClaudeCookie] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [googleCookie, setGoogleCookie] = useState('');
  const [claudeCookie, setClaudeCookie] = useState('');

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error('Erro ao atualizar senha');
    } else {
      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
    }
    setLoading(false);
  };

  const handleSaveAISettings = async () => {
    await saveSettings({
      groq_api_key: groqKey || settings?.groq_api_key,
      gemini_api_key: geminiKey || settings?.gemini_api_key,
      openrouter_api_key: openrouterKey || settings?.openrouter_api_key,
      google_cookie: googleCookie || settings?.google_cookie,
      claude_cookie: claudeCookie || settings?.claude_cookie,
    });
  };

  const handleClaudeCookieValidation = async () => {
    const cookie = claudeCookie || settings?.claude_cookie;

    if (!cookie) {
      toast.error('Configure o Cookie do Claude primeiro');
      return;
    }

    setValidatingClaudeCookie(true);
    setClaudeCookieValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-claude', {
        body: {
          prompt: 'Responda apenas com a palavra "OK" para confirmar que está funcionando.',
          cookie,
          model: 'claude-sonnet-4-20250514',
        },
      });

      if (error) throw error;
      
      if (data.error) {
        setClaudeCookieValidationResult('error');
        toast.error('Validação falhou: ' + data.error);
        if (data.suggestion) {
          toast.info(data.suggestion);
        }
      } else if (data.generatedText) {
        setClaudeCookieValidationResult('success');
        toast.success('Cookie do Claude validado com sucesso!');
      }
    } catch (error) {
      console.error('Claude cookie validation error:', error);
      setClaudeCookieValidationResult('error');
      toast.error('Erro ao validar cookie. Verifique se está correto e não expirou.');
    } finally {
      setValidatingClaudeCookie(false);
    }
  };

  const handleCookieValidation = async () => {
    const cookie = googleCookie || settings?.google_cookie;

    if (!cookie) {
      toast.error('Configure o Cookie do Google primeiro');
      return;
    }

    setValidatingCookie(true);
    setCookieValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-whisk-v2', {
        body: {
          prompt: 'A simple red circle on white background, minimal, clean',
          cookie,
          aspectRatio: 'square',
        },
      });

      if (error) throw error;
      
      if (data.error) {
        setCookieValidationResult('error');
        toast.error('Validação falhou: ' + data.error);
        if (data.suggestion) {
          toast.info(data.suggestion);
        }
      } else if (data.imageBase64) {
        setCookieValidationResult('success');
        toast.success('Cookie validado com sucesso! IMAGEN_3_5 funcionando!');
      }
    } catch (error) {
      console.error('Cookie validation error:', error);
      setCookieValidationResult('error');
      toast.error('Erro ao validar cookie. Verifique se está correto e não expirou.');
    } finally {
      setValidatingCookie(false);
    }
  };

  return (
    <div className="p-8 animate-fade-in max-w-2xl">
      <h1 className="text-3xl font-display font-bold text-foreground mb-8">
        Configurações
      </h1>

      {/* Account Section */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-fire rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Conta</h2>
            <p className="text-sm text-muted-foreground">Gerencie suas informações</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-foreground">Email</Label>
            <Input
              value={user?.email || ''}
              disabled
              className="bg-muted border-border mt-1"
            />
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Segurança</h2>
            <p className="text-sm text-muted-foreground">Altere sua senha</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-foreground">Nova Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha..."
              className="bg-muted border-border mt-1"
            />
          </div>
          <Button variant="secondary" onClick={handlePasswordChange} disabled={loading}>
            Atualizar Senha
          </Button>
        </div>
      </div>

      {/* AI Settings Section */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-fire rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">APIs de IA</h2>
            <p className="text-sm text-muted-foreground">Configure suas chaves de API</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            onClick={() => setShowKeys(!showKeys)}
          >
            {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Groq API Key</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              defaultValue={settings?.groq_api_key || ''}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="bg-muted border-border mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label>Gemini API Key</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              defaultValue={settings?.gemini_api_key || ''}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="bg-muted border-border mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label>OpenRouter API Key (Qwen)</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              defaultValue={settings?.openrouter_api_key || ''}
              onChange={(e) => setOpenrouterKey(e.target.value)}
              placeholder="sk-or-..."
              className="bg-muted border-border mt-1 font-mono text-sm"
            />
          </div>
          
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Google Labs (Whisk/IMAGEN)</h3>
            <div className="space-y-3">
              <div>
                <Label>Google Cookie</Label>
                <Textarea
                  defaultValue={settings?.google_cookie || ''}
                  onChange={(e) => setGoogleCookie(e.target.value)}
                  placeholder="Cole aqui o cookie exportado do Google Labs..."
                  className="bg-muted border-border mt-1 font-mono text-xs h-24"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cole o cookie exportado como "Header String" da extensão Cookie Editor
                </p>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                <p className="font-medium text-foreground">Como obter o cookie:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Instale a extensão <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Cookie Editor <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Acesse <a href="https://labs.google" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">labs.google <ExternalLink className="w-3 h-3" /></a> e faça login com sua conta Google</li>
                  <li>Clique no ícone do Cookie Editor</li>
                  <li>Clique em "Export" → "Header String"</li>
                  <li>Cole o conteúdo no campo acima</li>
                </ol>
                <p className="text-xs text-amber-500/80 mt-2">
                  ⚠️ O cookie expira periodicamente (~24h). Renove quando parar de funcionar.
                </p>
              </div>
              
              <Button 
                variant="outline"
                onClick={handleCookieValidation}
                disabled={validatingCookie}
                className="w-full"
              >
                {validatingCookie ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validando Cookie...
                  </>
                ) : cookieValidationResult === 'success' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Cookie Validado com Sucesso
                  </>
                ) : cookieValidationResult === 'error' ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                    Falhou - Clique para tentar novamente
                  </>
                ) : (
                  'Validar Cookie'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Gera uma imagem de teste para validar se o cookie está funcionando
              </p>
            </div>
          </div>

          {/* Claude Cookie Section */}
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Claude AI (Anthropic)</h3>
            <div className="space-y-3">
              <div>
                <Label>Claude Cookie</Label>
                <Textarea
                  defaultValue={settings?.claude_cookie || ''}
                  onChange={(e) => setClaudeCookie(e.target.value)}
                  placeholder="Cole aqui o cookie exportado do Claude.ai..."
                  className="bg-muted border-border mt-1 font-mono text-xs h-24"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cole o cookie exportado como "Header String" da extensão Cookie Editor
                </p>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                <p className="font-medium text-foreground">Como obter o cookie do Claude:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Instale a extensão <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Cookie Editor <ExternalLink className="w-3 h-3" /></a></li>
                  <li>Acesse <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">claude.ai <ExternalLink className="w-3 h-3" /></a> e faça login com sua conta</li>
                  <li>Clique no ícone do Cookie Editor</li>
                  <li>Clique em "Export" → "Header String"</li>
                  <li>Cole o conteúdo no campo acima</li>
                </ol>
                <p className="text-xs text-amber-500/80 mt-2">
                  ⚠️ O cookie expira periodicamente. Renove quando parar de funcionar.
                </p>
                <p className="text-xs text-blue-500/80">
                  💡 Claude 4.5 Sonnet gera roteiros de alta qualidade!
                </p>
              </div>
              
              <Button 
                variant="outline"
                onClick={handleClaudeCookieValidation}
                disabled={validatingClaudeCookie}
                className="w-full"
              >
                {validatingClaudeCookie ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validando Cookie do Claude...
                  </>
                ) : claudeCookieValidationResult === 'success' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Cookie Validado com Sucesso
                  </>
                ) : claudeCookieValidationResult === 'error' ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                    Falhou - Clique para tentar novamente
                  </>
                ) : (
                  'Validar Cookie do Claude'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Envia uma mensagem de teste ao Claude para validar se o cookie está funcionando
              </p>
            </div>
          </div>


          <Button 
            variant="fire"
            onClick={handleSaveAISettings}
            className="w-full"
          >
            Salvar Configurações de IA
          </Button>
        </div>
      </div>

      {/* Logout */}
      <Button 
        variant="outline" 
        className="text-destructive border-destructive hover:bg-destructive/10"
        onClick={() => signOut()}
      >
        Sair da Conta
      </Button>
    </div>
  );
}

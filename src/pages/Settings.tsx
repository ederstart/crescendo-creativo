import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAISettings } from '@/hooks/useAISettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Lock, Bot, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { settings, saveSettings, validateWhiskToken } = useAISettings();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [validatingWhisk, setValidatingWhisk] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [whiskToken, setWhiskToken] = useState('');
  const [whiskSessionId, setWhiskSessionId] = useState('');

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
    const newWhiskToken = whiskToken || settings?.whisk_token;
    const newWhiskSessionId = whiskSessionId || settings?.whisk_session_id;

    // Validate Whisk credentials if they changed
    if ((whiskToken || whiskSessionId) && newWhiskToken && newWhiskSessionId) {
      setValidatingWhisk(true);
      const isValid = await validateWhiskToken(newWhiskToken, newWhiskSessionId);
      setValidatingWhisk(false);
      
      if (!isValid) {
        return; // Don't save if validation failed
      }
    }

    await saveSettings({
      groq_api_key: groqKey || settings?.groq_api_key,
      gemini_api_key: geminiKey || settings?.gemini_api_key,
      openrouter_api_key: openrouterKey || settings?.openrouter_api_key,
      whisk_token: newWhiskToken,
      whisk_session_id: newWhiskSessionId,
    });
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
          <div>
            <Label>Whisk Token</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              defaultValue={settings?.whisk_token || ''}
              onChange={(e) => setWhiskToken(e.target.value)}
              placeholder="Token do Google Labs Whisk"
              className="bg-muted border-border mt-1 font-mono text-sm"
            />
          </div>
          <div>
            <Label>Whisk Session ID</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              defaultValue={settings?.whisk_session_id || ''}
              onChange={(e) => setWhiskSessionId(e.target.value)}
              placeholder="__Secure-1PSID do cookie"
              className="bg-muted border-border mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              As credenciais do Whisk serão validadas automaticamente ao salvar
            </p>
          </div>
          <Button 
            variant="secondary"
            onClick={handleSaveAISettings}
            disabled={validatingWhisk}
          >
            {validatingWhisk ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              'Salvar Configurações de IA'
            )}
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
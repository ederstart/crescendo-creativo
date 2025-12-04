import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Lock, Database } from 'lucide-react';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
            <p className="text-sm text-muted-foreground">
              Gerencie suas informações
            </p>
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
            <p className="text-sm text-muted-foreground">
              Altere sua senha
            </p>
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
          <Button 
            variant="secondary" 
            onClick={handlePasswordChange}
            disabled={loading}
          >
            Atualizar Senha
          </Button>
        </div>
      </div>

      {/* Database Info */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Supabase</h2>
            <p className="text-sm text-muted-foreground">
              Configuração do banco de dados
            </p>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-2">
            Para configurar o Supabase, adicione as variáveis de ambiente:
          </p>
          <code className="text-xs text-primary block">
            VITE_SUPABASE_URL=sua_url_aqui<br />
            VITE_SUPABASE_ANON_KEY=sua_chave_aqui
          </code>
          <p className="text-xs text-muted-foreground mt-4">
            O arquivo SQL com as tabelas está em: <code className="text-primary">src/lib/database.sql</code>
          </p>
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

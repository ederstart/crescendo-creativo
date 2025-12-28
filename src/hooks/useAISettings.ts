import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface AISettings {
  id?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  whisk_token?: string;
  whisk_session_id?: string;
  preferred_model_script?: string;
  preferred_model_scene?: string;
  preferred_model_image?: string;
}

export function useAISettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching AI settings:', error);
    }
    
    setSettings(data);
    setLoading(false);
  };

  const saveSettings = async (newSettings: Partial<AISettings>) => {
    if (!user) return;

    setLoading(true);

    if (settings?.id) {
      const { error } = await supabase
        .from('ai_settings')
        .update(newSettings)
        .eq('id', settings.id);

      if (error) {
        toast.error('Erro ao salvar configurações');
        console.error(error);
      } else {
        toast.success('Configurações salvas!');
        setSettings({ ...settings, ...newSettings });
      }
    } else {
      const { data, error } = await supabase
        .from('ai_settings')
        .insert({ ...newSettings, user_id: user.id })
        .select()
        .single();

      if (error) {
        toast.error('Erro ao salvar configurações');
        console.error(error);
      } else {
        toast.success('Configurações salvas!');
        setSettings(data);
      }
    }

    setLoading(false);
  };

  const validateWhiskToken = async (token: string, sessionId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-whisk-token', {
        body: { token, sessionId },
      });

      if (error) {
        toast.error('Erro ao validar credenciais');
        return false;
      }

      if (data.valid) {
        toast.success(data.message);
        return true;
      } else {
        toast.error(data.error);
        return false;
      }
    } catch (error) {
      toast.error('Erro na validação');
      return false;
    }
  };

  return { settings, loading, saveSettings, refetch: fetchSettings, validateWhiskToken };
}
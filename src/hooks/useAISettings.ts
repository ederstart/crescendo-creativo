import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface AISettings {
  id?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  google_cookie?: string;
  preferred_model_script?: string;
  preferred_model_scene?: string;
  preferred_model_image?: string;
  preferred_claude_model?: string;
  style_template?: string;
  // Campos legados (mantidos para compatibilidade)
  whisk_token?: string;
  whisk_session_id?: string;
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

  return { settings, loading, saveSettings, refetch: fetchSettings };
}

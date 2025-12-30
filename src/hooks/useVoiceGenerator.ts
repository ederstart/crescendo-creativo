import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface GeneratedAudio {
  id: string;
  voice_preset_id?: string;
  text_content: string;
  audio_url: string;
  model_used: string;
  duration_seconds?: number;
  created_at: string;
}

export function useVoiceGenerator() {
  const { user } = useAuth();
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchGeneratedAudios();
    }
  }, [user]);

  const fetchGeneratedAudios = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('generated_audios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching generated audios:', error);
    } else {
      setGeneratedAudios(data || []);
    }
    setLoading(false);
  };

  const saveGeneratedAudio = async (
    audioBlob: Blob,
    textContent: string,
    modelUsed: string,
    voicePresetId?: string,
    durationSeconds?: number
  ) => {
    if (!user) return;

    // Upload to storage
    const fileName = `${user.id}/${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('images') // Using existing bucket
      .upload(`audios/${fileName}`, audioBlob, {
        contentType: 'audio/mpeg',
      });

    if (uploadError) {
      toast.error('Erro ao salvar áudio');
      console.error(uploadError);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(`audios/${fileName}`);

    const { data, error } = await supabase
      .from('generated_audios')
      .insert({
        user_id: user.id,
        text_content: textContent,
        audio_url: urlData.publicUrl,
        model_used: modelUsed,
        voice_preset_id: voicePresetId,
        duration_seconds: durationSeconds,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar registro do áudio');
      console.error(error);
    } else {
      setGeneratedAudios(prev => [data, ...prev]);
      return data;
    }
  };

  const deleteGeneratedAudio = async (id: string) => {
    const { error } = await supabase
      .from('generated_audios')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir áudio');
      console.error(error);
    } else {
      toast.success('Áudio excluído!');
      setGeneratedAudios(prev => prev.filter(a => a.id !== id));
    }
  };

  return {
    generatedAudios,
    loading,
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios: fetchGeneratedAudios,
  };
}

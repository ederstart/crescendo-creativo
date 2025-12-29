import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface VoicePreset {
  id: string;
  voice_id: string;
  voice_name: string;
  description?: string;
  is_favorite: boolean;
  created_at: string;
}

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
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchVoicePresets();
      fetchGeneratedAudios();
    }
  }, [user]);

  const fetchVoicePresets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('voice_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching voice presets:', error);
    } else {
      setVoicePresets(data || []);
    }
    setLoading(false);
  };

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
  };

  const saveVoicePreset = async (voiceId: string, voiceName: string, description?: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('voice_presets')
      .insert({
        user_id: user.id,
        voice_id: voiceId,
        voice_name: voiceName,
        description,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar voz');
      console.error(error);
    } else {
      toast.success('Voz salva!');
      setVoicePresets(prev => [data, ...prev]);
      return data;
    }
  };

  const deleteVoicePreset = async (id: string) => {
    const { error } = await supabase
      .from('voice_presets')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir voz');
      console.error(error);
    } else {
      toast.success('Voz excluída!');
      setVoicePresets(prev => prev.filter(p => p.id !== id));
    }
  };

  const toggleFavorite = async (id: string, isFavorite: boolean) => {
    const { error } = await supabase
      .from('voice_presets')
      .update({ is_favorite: !isFavorite })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar voz');
    } else {
      setVoicePresets(prev => 
        prev.map(p => p.id === id ? { ...p, is_favorite: !isFavorite } : p)
      );
    }
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
    voicePresets,
    generatedAudios,
    loading,
    saveVoicePreset,
    deleteVoicePreset,
    toggleFavorite,
    saveGeneratedAudio,
    deleteGeneratedAudio,
    refetchAudios: fetchGeneratedAudios,
  };
}

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface GeneratedImage {
  id: string;
  script_id?: string;
  scene_description?: string;
  prompt_used?: string;
  image_url: string;
  subject_image_url?: string;
  created_at: string;
}

export function useGeneratedImages(scriptId?: string) {
  const { user } = useAuth();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchImages();
    }
  }, [user, scriptId]);

  const fetchImages = async () => {
    if (!user) return;

    let query = supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (scriptId) {
      query = query.eq('script_id', scriptId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching images:', error);
    } else {
      setImages(data || []);
    }
    
    setLoading(false);
  };

  const saveImage = async (image: Omit<GeneratedImage, 'id' | 'created_at'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('generated_images')
      .insert({ ...image, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar imagem');
      console.error(error);
    } else {
      setImages([data, ...images]);
      return data;
    }
  };

  const deleteImage = async (id: string) => {
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao deletar imagem');
      console.error(error);
    } else {
      toast.success('Imagem deletada!');
      setImages(images.filter(img => img.id !== id));
    }
  };

  const deleteMultiple = async (ids: string[]) => {
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error('Erro ao deletar imagens');
      console.error(error);
    } else {
      toast.success(`${ids.length} imagens deletadas!`);
      setImages(images.filter(img => !ids.includes(img.id)));
    }
  };

  return { 
    images, 
    loading, 
    saveImage, 
    deleteImage, 
    deleteMultiple,
    refetch: fetchImages 
  };
}

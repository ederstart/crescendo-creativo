import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useImageUpload(userId: string | undefined) {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!userId) {
      toast.error('Usuário não autenticado');
      return null;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Erro ao fazer upload da imagem');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadFromClipboard = async (clipboardData: DataTransfer): Promise<string | null> => {
    const items = clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          return await uploadImage(file);
        }
      }
    }
    
    return null;
  };

  return {
    uploading,
    uploadImage,
    uploadFromClipboard,
  };
}

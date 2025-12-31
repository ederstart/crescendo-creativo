import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface StyleTemplate {
  id: string;
  name: string;
  content: string;
  is_favorite: boolean;
  created_at: string;
}

export function useStyleTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('style_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching style templates:', error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const createTemplate = async (name: string, content: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('style_templates')
      .insert({
        user_id: user.id,
        name,
        content,
        is_favorite: false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar template');
      console.error(error);
      return null;
    }

    toast.success('Template salvo!');
    setTemplates([data, ...templates]);
    return data;
  };

  const updateTemplate = async (id: string, updates: Partial<Pick<StyleTemplate, 'name' | 'content'>>) => {
    const { error } = await supabase
      .from('style_templates')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar template');
      console.error(error);
      return false;
    }

    setTemplates(templates.map(t => t.id === id ? { ...t, ...updates } : t));
    toast.success('Template atualizado!');
    return true;
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('style_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir template');
      console.error(error);
      return false;
    }

    setTemplates(templates.filter(t => t.id !== id));
    toast.success('Template excluído!');
    return true;
  };

  const setFavorite = async (id: string) => {
    if (!user) return false;

    // Remove favorite from all templates first
    await supabase
      .from('style_templates')
      .update({ is_favorite: false })
      .eq('user_id', user.id);

    // Set new favorite
    const { error } = await supabase
      .from('style_templates')
      .update({ is_favorite: true })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao favoritar template');
      console.error(error);
      return false;
    }

    setTemplates(templates.map(t => ({ ...t, is_favorite: t.id === id })));
    toast.success('Template favoritado!');
    return true;
  };

  const favoriteTemplate = templates.find(t => t.is_favorite);

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setFavorite,
    favoriteTemplate,
    refetch: fetchTemplates,
  };
}

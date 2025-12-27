import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PromptTemplate {
  id: string;
  name: string;
  type: 'script' | 'scene';
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function usePromptTemplates(type?: 'script' | 'scene') {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user, type]);

  const fetchTemplates = async () => {
    if (!user) return;

    let query = supabase
      .from('prompt_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    
    setLoading(false);
  };

  const createTemplate = async (template: Omit<PromptTemplate, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({ ...template, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar template');
      console.error(error);
    } else {
      toast.success('Template criado!');
      setTemplates([data, ...templates]);
      return data;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<PromptTemplate>) => {
    const { error } = await supabase
      .from('prompt_templates')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar template');
      console.error(error);
    } else {
      toast.success('Template atualizado!');
      setTemplates(templates.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao deletar template');
      console.error(error);
    } else {
      toast.success('Template deletado!');
      setTemplates(templates.filter(t => t.id !== id));
    }
  };

  const setDefaultTemplate = async (id: string, templateType: 'script' | 'scene') => {
    // First, unset all defaults for this type
    await supabase
      .from('prompt_templates')
      .update({ is_default: false })
      .eq('user_id', user?.id)
      .eq('type', templateType);

    // Then set the new default
    const { error } = await supabase
      .from('prompt_templates')
      .update({ is_default: true })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao definir template padrão');
    } else {
      toast.success('Template padrão definido!');
      fetchTemplates();
    }
  };

  return { 
    templates, 
    loading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate, 
    setDefaultTemplate,
    refetch: fetchTemplates 
  };
}

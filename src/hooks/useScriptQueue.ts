import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface QueueItem {
  id: string;
  idea_id?: string;
  title: string;
  prompt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generated_content?: string;
  model_used?: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface UseScriptQueueOptions {
  groqApiKey?: string;
  geminiApiKey?: string;
  openrouterApiKey?: string;
  preferredModel?: string;
  systemPrompt?: string;
  onItemCompleted?: (item: QueueItem) => void;
  onQueueCompleted?: () => void;
}

export function useScriptQueue(options: UseScriptQueueOptions = {}) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const stopProcessingRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchQueue();
    }
  }, [user]);

  const fetchQueue = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('script_generation_queue')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue:', error);
    } else {
      setQueue(data || []);
    }
    setLoading(false);
  };

  const addToQueue = async (items: { title: string; ideaId?: string; prompt?: string }[]) => {
    if (!user || items.length === 0) return [];

    const inserts = items.map(item => ({
      user_id: user.id,
      title: item.title,
      idea_id: item.ideaId || null,
      prompt: item.prompt || null,
      status: 'pending' as const,
    }));

    const { data, error } = await supabase
      .from('script_generation_queue')
      .insert(inserts)
      .select();

    if (error) {
      toast.error('Erro ao adicionar à fila');
      return [];
    }

    setQueue(prev => [...(data || []), ...prev]);
    toast.success(`${items.length} item(ns) adicionado(s) à fila`);
    return data || [];
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase
      .from('script_generation_queue')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover da fila');
      return false;
    }

    setQueue(prev => prev.filter(item => item.id !== id));
    return true;
  };

  const removeMultiple = async (ids: string[]) => {
    if (ids.length === 0) return true;

    const { error } = await supabase
      .from('script_generation_queue')
      .delete()
      .in('id', ids);

    if (error) {
      toast.error('Erro ao remover itens');
      return false;
    }

    setQueue(prev => prev.filter(item => !ids.includes(item.id)));
    toast.success(`${ids.length} item(ns) removido(s)`);
    return true;
  };

  const clearCompleted = async () => {
    if (!user) return;

    const completedIds = queue.filter(i => i.status === 'completed').map(i => i.id);
    if (completedIds.length === 0) return;

    await removeMultiple(completedIds);
  };

  const getApiKey = (model: string): string | undefined => {
    if (model === 'groq') return options.groqApiKey;
    if (model === 'gemini') return options.geminiApiKey;
    if (['qwen', 'deepseek', 'llama'].includes(model)) return options.openrouterApiKey;
    return undefined;
  };

  const processItem = async (item: QueueItem): Promise<boolean> => {
    const model = options.preferredModel || 'deepseek';
    const apiKey = getApiKey(model);

    if (!apiKey) {
      await supabase
        .from('script_generation_queue')
        .update({ 
          status: 'failed', 
          error_message: 'API key não configurada',
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id);
      return false;
    }

    // Update status to processing
    await supabase
      .from('script_generation_queue')
      .update({ status: 'processing' })
      .eq('id', item.id);

    setQueue(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'processing' as const } : i
    ));

    try {
      const prompt = item.prompt || `Crie um roteiro completo e detalhado para o seguinte tema de vídeo:\n\n${item.title}`;

      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          prompt,
          model,
          apiKey,
          systemPrompt: options.systemPrompt,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Update with success
      const updatedItem = {
        status: 'completed' as const,
        generated_content: data.generatedText,
        model_used: data.model,
        processed_at: new Date().toISOString(),
      };

      await supabase
        .from('script_generation_queue')
        .update(updatedItem)
        .eq('id', item.id);

      setQueue(prev => prev.map(i => 
        i.id === item.id ? { ...i, ...updatedItem } : i
      ));

      // Update idea status if linked
      if (item.idea_id) {
        await supabase
          .from('script_ideas')
          .update({ status: 'done' })
          .eq('id', item.idea_id);
      }

      options.onItemCompleted?.({ ...item, ...updatedItem });
      return true;

    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido';
      
      await supabase
        .from('script_generation_queue')
        .update({ 
          status: 'failed', 
          error_message: errorMessage,
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      setQueue(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'failed' as const, error_message: errorMessage } : i
      ));

      return false;
    }
  };

  const processQueue = async () => {
    const pendingItems = queue.filter(i => i.status === 'pending');
    if (pendingItems.length === 0) {
      toast.info('Nenhum item pendente na fila');
      return;
    }

    stopProcessingRef.current = false;
    setIsProcessing(true);
    setProgress({ current: 0, total: pendingItems.length });

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < pendingItems.length; i++) {
      if (stopProcessingRef.current) {
        toast.info(`Processamento parado. ${completed} concluídos, ${pendingItems.length - i} restantes.`);
        break;
      }

      setProgress({ current: i + 1, total: pendingItems.length });
      
      const success = await processItem(pendingItems[i]);
      if (success) {
        completed++;
      } else {
        failed++;
      }

      // Delay between requests to avoid rate limiting
      if (i < pendingItems.length - 1 && !stopProcessingRef.current) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    setIsProcessing(false);
    setProgress(null);

    if (!stopProcessingRef.current) {
      if (failed === 0) {
        toast.success(`Fila concluída! ${completed} roteiros gerados.`);
      } else {
        toast.warning(`${completed} gerados, ${failed} falharam.`);
      }
      options.onQueueCompleted?.();
    }
  };

  const stopProcessing = () => {
    stopProcessingRef.current = true;
    toast.info('Parando após o item atual...');
  };

  const retryFailed = async () => {
    const failedItems = queue.filter(i => i.status === 'failed');
    if (failedItems.length === 0) return;

    // Reset status to pending
    const ids = failedItems.map(i => i.id);
    await supabase
      .from('script_generation_queue')
      .update({ status: 'pending', error_message: null })
      .in('id', ids);

    setQueue(prev => prev.map(i => 
      ids.includes(i.id) ? { ...i, status: 'pending' as const, error_message: undefined } : i
    ));

    toast.success(`${failedItems.length} item(ns) resetado(s) para nova tentativa`);
  };

  const saveAsScript = async (item: QueueItem): Promise<string | null> => {
    if (!user || !item.generated_content) return null;

    const { data, error } = await supabase
      .from('scripts')
      .insert({
        user_id: user.id,
        title: item.title,
        content: item.generated_content,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar roteiro');
      return null;
    }

    toast.success('Roteiro salvo!');
    return data.id;
  };

  const saveMultipleAsScripts = async (items: QueueItem[]): Promise<number> => {
    if (!user) return 0;

    const toSave = items.filter(i => i.status === 'completed' && i.generated_content);
    if (toSave.length === 0) return 0;

    const inserts = toSave.map(item => ({
      user_id: user.id,
      title: item.title,
      content: item.generated_content!,
      status: 'draft',
    }));

    const { data, error } = await supabase
      .from('scripts')
      .insert(inserts)
      .select();

    if (error) {
      toast.error('Erro ao salvar roteiros');
      return 0;
    }

    toast.success(`${data?.length || 0} roteiros salvos!`);
    return data?.length || 0;
  };

  return {
    queue,
    loading,
    isProcessing,
    progress,
    fetchQueue,
    addToQueue,
    removeFromQueue,
    removeMultiple,
    clearCompleted,
    processQueue,
    stopProcessing,
    retryFailed,
    saveAsScript,
    saveMultipleAsScripts,
    pendingCount: queue.filter(i => i.status === 'pending').length,
    completedCount: queue.filter(i => i.status === 'completed').length,
    failedCount: queue.filter(i => i.status === 'failed').length,
  };
}

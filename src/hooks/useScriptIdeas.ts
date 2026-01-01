import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface ScriptIdea {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'done';
  created_at: string;
}

export function useScriptIdeas(showCompleted: boolean = false) {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<ScriptIdea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchIdeas();
    }
  }, [user, showCompleted]);

  const fetchIdeas = async () => {
    if (!user) return;
    
    setLoading(true);
    
    let query = supabase
      .from('script_ideas')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (!showCompleted) {
      query = query.neq('status', 'done');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching ideas:', error);
    } else {
      setIdeas(data || []);
    }
    setLoading(false);
  };

  const updateIdeaStatus = async (id: string, status: 'pending' | 'in_progress' | 'done') => {
    const { error } = await supabase
      .from('script_ideas')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating idea status:', error);
      return false;
    }

    setIdeas(prev => prev.map(i => 
      i.id === id ? { ...i, status } : i
    ));
    
    return true;
  };

  return {
    ideas,
    loading,
    fetchIdeas,
    updateIdeaStatus,
  };
}

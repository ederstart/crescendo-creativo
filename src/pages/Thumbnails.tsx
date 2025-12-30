import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Image, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ImageUploader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Script { id: string; title: string; status: string; }
interface Thumbnail { id: string; script_id: string; thumbnail_url: string; }

export default function Thumbnails() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [thumbnails, setThumbnails] = useState<{ [key: string]: Thumbnail[] }>({});
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: scriptsData } = await supabase.from('scripts').select('id, title, status').eq('user_id', user?.id).order('updated_at', { ascending: false });
    setScripts(scriptsData || []);
    const { data: thumbnailsData } = await supabase.from('script_thumbnails').select('id, script_id, thumbnail_url').eq('user_id', user?.id);
    const grouped: { [key: string]: Thumbnail[] } = {};
    (thumbnailsData || []).forEach(thumb => { if (!grouped[thumb.script_id]) grouped[thumb.script_id] = []; grouped[thumb.script_id].push(thumb); });
    setThumbnails(grouped);
    setLoading(false);
  };

  const addThumbnail = async (imageUrl: string) => {
    if (!selectedScript || !user) { toast.error('Selecione um roteiro primeiro'); return; }
    const { data, error } = await supabase.from('script_thumbnails').insert({ script_id: selectedScript, user_id: user.id, thumbnail_url: imageUrl }).select().single();
    if (error) toast.error('Erro ao adicionar thumbnail');
    else { setThumbnails(prev => ({ ...prev, [selectedScript]: [...(prev[selectedScript] || []), data] })); toast.success('Thumbnail adicionada'); }
  };

  const deleteThumbnail = async (scriptId: string, thumbnailId: string) => {
    const { error } = await supabase.from('script_thumbnails').delete().eq('id', thumbnailId);
    if (error) toast.error('Erro ao excluir thumbnail');
    else { setThumbnails(prev => ({ ...prev, [scriptId]: (prev[scriptId] || []).filter(t => t.id !== thumbnailId) })); toast.success('Thumbnail excluída'); }
  };

  if (loading) return <div className="p-8"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Thumbnails</h1>
        <p className="text-sm md:text-base text-muted-foreground">Vincule thumbnails aos seus roteiros</p>
      </div>

      <div className="glass rounded-xl p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="font-semibold text-foreground mb-4">Adicionar Thumbnail</h2>
        <div className="mb-4">
          <label className="block text-sm text-muted-foreground mb-2">Selecione o roteiro:</label>
          <select value={selectedScript || ''} onChange={(e) => setSelectedScript(e.target.value || null)} className="w-full bg-muted border border-border rounded-lg px-4 py-2 text-foreground">
            <option value="">Selecione um roteiro...</option>
            {scripts.map((script) => <option key={script.id} value={script.id}>{script.title}</option>)}
          </select>
        </div>
        {selectedScript ? <ImageUploader userId={user?.id} onImageUploaded={addThumbnail} /> : <p className="text-sm text-muted-foreground">Selecione um roteiro para adicionar thumbnails</p>}
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum roteiro encontrado</h3>
          <p className="text-muted-foreground mb-4">Crie roteiros primeiro para vincular thumbnails</p>
          <Button variant="fire" asChild><Link to="/scripts/new"><Plus className="w-4 h-4" />Criar Roteiro</Link></Button>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {scripts.map((script) => (
            <div key={script.id} className="glass rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 gradient-fire rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-primary-foreground" /></div>
                <div><h3 className="font-semibold text-foreground">{script.title}</h3><p className="text-xs text-muted-foreground">{(thumbnails[script.id] || []).length} thumbnails</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                {(thumbnails[script.id] || []).map((thumb) => (
                  <div key={thumb.id} className="relative rounded-lg overflow-hidden group">
                    <div className="aspect-video bg-muted"><img src={thumb.thumbnail_url} alt="" className="w-full h-full object-cover" /></div>
                    <button className="absolute top-2 right-2 p-1.5 bg-destructive/80 rounded opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteThumbnail(script.id, thumb.id)}>
                      <Trash2 className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div>
                ))}
                {(thumbnails[script.id] || []).length === 0 && (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center col-span-2">
                    <div className="text-center"><Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-xs text-muted-foreground">Sem thumbnails</p></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

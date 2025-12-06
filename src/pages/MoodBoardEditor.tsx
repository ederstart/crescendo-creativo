import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut,
  Trash2,
  Move,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/ImageUploader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useImageUpload } from '@/hooks/useImageUpload';
import { toast } from 'sonner';

interface BoardItem {
  id: string;
  image_url: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  notes: string | null;
}

interface MoodBoard {
  id: string;
  name: string;
  type: string;
}

export default function MoodBoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const { uploadFromClipboard } = useImageUpload(user?.id);
  const isNew = id === 'new';
  
  const [board, setBoard] = useState<MoodBoard | null>(null);
  const [boardName, setBoardName] = useState('Novo Mood Board');
  const [items, setItems] = useState<BoardItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const saveItems = useCallback(async (itemsToSave: BoardItem[]) => {
    if (!user || !board?.id) return;

    for (const item of itemsToSave) {
      await supabase
        .from('mood_board_items')
        .update({
          position_x: item.position_x,
          position_y: item.position_y,
          width: item.width,
          height: item.height,
          z_index: item.z_index,
        })
        .eq('id', item.id);
    }
  }, [user, board?.id]);

  useAutoSave(items, saveItems, 15000);

  useEffect(() => {
    if (user) {
      if (isNew) {
        createNewBoard();
      } else if (id) {
        fetchBoard();
        fetchItems();
      }
    }
  }, [id, user, isNew]);

  // Handle paste anywhere on canvas
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData || !user || !board?.id) return;
      
      const pasteItems = e.clipboardData.items;
      for (let i = 0; i < pasteItems.length; i++) {
        if (pasteItems[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = pasteItems[i].getAsFile();
          if (file) {
            const url = await uploadFromClipboard(e.clipboardData as unknown as DataTransfer);
            if (url) {
              addImageToBoard(url);
            }
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [user, board?.id, items]);

  const createNewBoard = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('mood_boards')
      .insert({
        user_id: user.id,
        name: 'Novo Mood Board',
        type: 'general',
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar mood board');
      navigate('/mood-boards');
    } else {
      setBoard(data);
      setBoardName(data.name);
      navigate(`/mood-boards/${data.id}`, { replace: true });
    }
  };

  const fetchBoard = async () => {
    const { data } = await supabase
      .from('mood_boards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setBoard(data);
      setBoardName(data.name);
    }
  };

  const fetchItems = async () => {
    const { data } = await supabase
      .from('mood_board_items')
      .select('*')
      .eq('mood_board_id', id)
      .order('z_index', { ascending: true });

    setItems(data || []);
  };

  const addImageToBoard = async (imageUrl: string) => {
    if (!user || !board?.id) return;

    const { data, error } = await supabase
      .from('mood_board_items')
      .insert({
        mood_board_id: board.id,
        user_id: user.id,
        image_url: imageUrl,
        position_x: 100 + Math.random() * 200,
        position_y: 100 + Math.random() * 200,
        width: 200,
        height: 150,
        z_index: items.length,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar imagem');
    } else {
      setItems([...items, data]);
      toast.success('Imagem adicionada');
    }
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('mood_board_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Erro ao excluir imagem');
    } else {
      setItems(items.filter(i => i.id !== itemId));
      setSelectedItem(null);
      toast.success('Imagem excluída');
    }
  };

  const handleMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setDragging(itemId);
    setSelectedItem(itemId);
    setDragStart({ x: e.clientX, y: e.clientY });

    // Bring to front
    const maxZ = Math.max(...items.map(i => i.z_index), 0);
    setItems(items.map(i => 
      i.id === itemId ? { ...i, z_index: maxZ + 1 } : i
    ));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    setItems(items.map(item => 
      item.id === dragging 
        ? { ...item, position_x: item.position_x + dx, position_y: item.position_y + dy }
        : item
    ));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(Math.min(Math.max(zoom * delta, 0.25), 3));
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="glass border-b border-border z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/mood-boards">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-display font-bold text-foreground">
              {board?.name || 'Carregando...'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Add Image */}
            <ImageUploader
              userId={user?.id}
              onImageUploaded={addImageToBoard}
              compact
            />

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setZoom(Math.max(zoom - 0.25, 0.25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-foreground w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setZoom(Math.min(zoom + 0.25, 3))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 mood-canvas overflow-hidden relative cursor-grab"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="absolute inset-0"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          {items.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  Adicione imagens usando o uploader acima
                </p>
                <p className="text-sm text-muted-foreground">
                  Você também pode colar imagens diretamente (Ctrl+V)
                </p>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`absolute cursor-move group ${
                  selectedItem === item.id ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  left: item.position_x,
                  top: item.position_y,
                  width: item.width,
                  height: item.height,
                  zIndex: item.z_index,
                }}
                onMouseDown={(e) => handleMouseDown(e, item.id)}
              >
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full h-full object-cover rounded-lg shadow-card"
                  draggable={false}
                />
                
                {/* Controls */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {/* Drag Handle */}
                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-background/80 rounded p-1">
                    <Move className="w-4 h-4 text-foreground" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Copy, Edit, Trash2, Star, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PromptTemplateType } from '@/hooks/usePromptTemplates';

interface PromptTemplate {
  id: string;
  name: string;
  type: PromptTemplateType;
  content: string;
  is_default: boolean;
}

interface PromptTemplateManagerProps {
  templates: PromptTemplate[];
  type: 'script' | 'scene';
  onSelect: (template: PromptTemplate) => void;
  onCreate: (template: Omit<PromptTemplate, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdate: (id: string, updates: Partial<PromptTemplate>) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string, type: PromptTemplateType) => void;
}

export function PromptTemplateManager({
  templates,
  type,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onSetDefault,
}: PromptTemplateManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  const handleCreate = () => {
    if (!newName.trim() || !newContent.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    onCreate({ name: newName, type, content: newContent, is_default: false });
    setNewName('');
    setNewContent('');
    setIsCreating(false);
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim() || !editContent.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    onUpdate(id, { name: editName, content: editContent });
    setEditingId(null);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Prompt copiado!');
  };

  const startEditing = (template: PromptTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditContent(template.content);
  };

  const filteredTemplates = templates.filter(t => t.type === type);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Templates de {type === 'script' ? 'Roteiro' : 'Cena'}
        </h3>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Template de {type === 'script' ? 'Roteiro' : 'Cena'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Template</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Roteiro de Tutorial"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Conteúdo do Prompt</Label>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Digite o prompt padrão que será usado..."
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate}>
                  Criar Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum template criado ainda
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={cn(
                "glass rounded-lg p-4 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                template.is_default && "ring-2 ring-primary"
              )}
              onClick={() => onSelect(template)}
            >
              {editingId === template.id ? (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do template"
                  />
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => handleUpdate(template.id)}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                      {template.is_default && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleCopy(template.content)}
                        title="Copiar"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onSetDefault(template.id, type)}
                        title="Definir como padrão"
                      >
                        <Star className={cn("w-4 h-4", template.is_default && "fill-primary text-primary")} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEditing(template)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDelete(template.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 font-mono">
                    {template.content}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

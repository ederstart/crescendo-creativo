import { useState, useRef, useCallback } from 'react';
import { Upload, Link as LinkIcon, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useImageUpload } from '@/hooks/useImageUpload';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  userId: string | undefined;
  onImageUploaded: (url: string) => void;
  className?: string;
  compact?: boolean;
}

export function ImageUploader({ userId, onImageUploaded, className, compact = false }: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadImage, uploadFromClipboard } = useImageUpload(userId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await uploadImage(file);
      if (url) {
        onImageUploaded(url);
      }
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = await uploadImage(file);
      if (url) {
        onImageUploaded(url);
      }
    }
  }, [uploadImage, onImageUploaded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const url = await uploadFromClipboard(e.clipboardData);
    if (url) {
      onImageUploaded(url);
    }
  }, [uploadFromClipboard, onImageUploaded]);

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onImageUploaded(urlInput.trim());
      setUrlInput('');
    }
  };

  if (compact) {
    return (
      <div className={cn("flex gap-2", className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onPaste={handlePaste}
          placeholder="Cole URL ou imagem (Ctrl+V)..."
          className="flex-1 bg-muted border-border text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
        />
        <Button
          variant="secondary"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Fazer upload de arquivo"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
        <Button
          variant="secondary"
          onClick={handleUrlSubmit}
          disabled={!urlInput.trim() || uploading}
        >
          Adicionar
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mode Toggle */}
      <div className="flex gap-2 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('upload')}
          className={cn(
            "px-3 py-1.5 rounded text-sm font-medium transition-all",
            mode === 'upload'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="w-4 h-4 inline mr-1" />
          Upload
        </button>
        <button
          onClick={() => setMode('url')}
          className={cn(
            "px-3 py-1.5 rounded text-sm font-medium transition-all",
            mode === 'url'
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LinkIcon className="w-4 h-4 inline mr-1" />
          URL
        </button>
      </div>

      {mode === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onPaste={handlePaste}
          tabIndex={0}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            uploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-foreground font-medium">Fazendo upload...</p>
            </>
          ) : (
            <>
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium mb-2">
                Arraste uma imagem aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou clique para selecionar • Cole com Ctrl+V
              </p>
              <Button variant="secondary" type="button">
                <Upload className="w-4 h-4" />
                Escolher arquivo
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="https://exemplo.com/imagem.jpg ou cole uma imagem (Ctrl+V)"
            className="bg-muted border-border"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
          <Button
            variant="fire"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="w-full"
          >
            Adicionar Imagem
          </Button>
        </div>
      )}
    </div>
  );
}

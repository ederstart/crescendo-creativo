import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Languages, 
  Upload, 
  FileText, 
  Trash2, 
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';

interface Script {
  id: string;
  title: string;
  content: string | null;
}

interface TranslationPair {
  original: string;
  translated: string;
}

// Storage key for persistence
const TRANSLATION_STORAGE_KEY = 'translation-page-state';

export default function Translation() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [translatedText, setTranslatedText] = useState('');
  const [pairs, setPairs] = useState<TranslationPair[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load scripts with 'traduzir' status
  useEffect(() => {
    if (user) {
      fetchScripts();
    }
  }, [user]);

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem(TRANSLATION_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.translatedText) setTranslatedText(parsed.translatedText);
        if (parsed.pairs) setPairs(parsed.pairs);
        if (parsed.showComparison) setShowComparison(parsed.showComparison);
        if (parsed.selectedScriptId && scripts.length > 0) {
          const script = scripts.find(s => s.id === parsed.selectedScriptId);
          if (script) setSelectedScript(script);
        }
      } catch (e) {
        console.error('Error loading translation state:', e);
      }
    }
  }, [scripts]);

  // Persist state
  useEffect(() => {
    const state = {
      translatedText,
      pairs,
      showComparison,
      selectedScriptId: selectedScript?.id
    };
    localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify(state));
  }, [translatedText, pairs, showComparison, selectedScript]);

  const fetchScripts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('scripts')
        .select('id, title, content')
        .eq('user_id', user!.id)
        .eq('status', 'traduzir')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setScripts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar roteiros",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Split text into lines/sentences for comparison
  const splitTextIntoLines = (text: string): string[] => {
    if (!text) return [];
    
    // Split by sentence-ending punctuation followed by space or newline
    // This handles multiple languages and different punctuation styles
    const lines = text
      .split(/(?<=[.!?。！？])\s+|\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    return lines;
  };

  // Process texts and create aligned pairs
  const processTranslation = () => {
    if (!selectedScript?.content || !translatedText) {
      toast({
        title: "Erro",
        description: "Selecione um roteiro e cole a tradução",
        variant: "destructive"
      });
      return;
    }

    const originalLines = splitTextIntoLines(selectedScript.content);
    const translatedLines = splitTextIntoLines(translatedText);

    // Create pairs - align by position
    const newPairs: TranslationPair[] = [];
    const maxLength = Math.max(originalLines.length, translatedLines.length);

    for (let i = 0; i < maxLength; i++) {
      newPairs.push({
        original: originalLines[i] || '',
        translated: translatedLines[i] || ''
      });
    }

    setPairs(newPairs);
    setShowComparison(true);

    if (originalLines.length !== translatedLines.length) {
      toast({
        title: "Atenção",
        description: `Número de frases diferente: Original (${originalLines.length}) vs Tradução (${translatedLines.length}). Revise o alinhamento.`,
        variant: "default"
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a text file
    if (!file.type.includes('text') && !file.name.endsWith('.txt')) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo de texto (.txt)",
        variant: "destructive"
      });
      return;
    }

    try {
      const text = await file.text();
      setTranslatedText(text);
      toast({
        title: "Arquivo carregado",
        description: `${file.name} foi carregado com sucesso`
      });
    } catch (error: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Edit a pair
  const updatePair = (index: number, field: 'original' | 'translated', value: string) => {
    const newPairs = [...pairs];
    newPairs[index][field] = value;
    setPairs(newPairs);
  };

  // Add a new pair
  const addPair = (afterIndex: number) => {
    const newPairs = [...pairs];
    newPairs.splice(afterIndex + 1, 0, { original: '', translated: '' });
    setPairs(newPairs);
  };

  // Remove a pair
  const removePair = (index: number) => {
    const newPairs = pairs.filter((_, i) => i !== index);
    setPairs(newPairs);
  };

  // Copy all pairs as formatted text
  const copyFormattedText = async () => {
    const formatted = pairs
      .map(p => `[ORIGINAL]\n${p.original}\n\n[TRADUÇÃO]\n${p.translated}`)
      .join('\n\n---\n\n');
    
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Copiado!",
      description: "Texto formatado copiado para a área de transferência"
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Languages className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Tradução de Roteiros</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scripts List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Roteiros para Traduzir
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : scripts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum roteiro com a tag "traduzir". 
                Altere o status de um roteiro para "traduzir" na página de roteiros.
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {scripts.map((script) => (
                    <Button
                      key={script.id}
                      variant={selectedScript?.id === script.id ? "default" : "outline"}
                      className="w-full justify-start text-left"
                      onClick={() => {
                        setSelectedScript(script);
                        setPairs([]);
                        setShowComparison(false);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{script.title}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Translation Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedScript ? selectedScript.title : 'Selecione um roteiro'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedScript && (
              <>
                {/* Original Text Preview */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Texto Original ({selectedScript.content?.length || 0} caracteres)
                  </Label>
                  <ScrollArea className="h-[150px] border rounded-md p-3 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedScript.content || 'Sem conteúdo'}
                    </p>
                  </ScrollArea>
                </div>

                {/* Translation Input */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Tradução ({translatedText.length} caracteres)
                  </Label>
                  <Textarea
                    placeholder="Cole aqui o texto traduzido..."
                    value={translatedText}
                    onChange={(e) => setTranslatedText(e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>

                {/* File Upload */}
                <div className="flex items-center gap-4">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">Carregar arquivo .txt</span>
                    </div>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".txt,text/plain"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </Label>

                  <Button onClick={processTranslation} disabled={!translatedText}>
                    <Eye className="w-4 h-4 mr-2" />
                    Processar e Comparar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison View */}
      {showComparison && pairs.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Comparação Linha a Linha ({pairs.length} pares)
            </CardTitle>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Visualizar Completo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh]">
                  <DialogHeader>
                    <DialogTitle>{selectedScript?.title} - Tradução</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] mt-4">
                    <div className="space-y-4 p-4">
                      {pairs.map((pair, index) => (
                        <div key={index} className="space-y-2 pb-4 border-b border-border last:border-0">
                          <p className="text-sm text-blue-500 font-medium">
                            {pair.original}
                          </p>
                          <p className="text-sm text-green-500">
                            {pair.translated}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" onClick={copyFormattedText} className="flex-1">
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      Copiar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={copyFormattedText}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copiado!' : 'Copiar Tudo'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowComparison(false)}>
                <EyeOff className="w-4 h-4 mr-2" />
                Ocultar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {pairs.map((pair, index) => (
                  <div 
                    key={index} 
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Frase {index + 1}
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => addPair(index)}
                          className="h-6 px-2 text-xs"
                        >
                          + Adicionar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removePair(index)}
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Original */}
                    <div className="space-y-1">
                      <Label className="text-xs text-blue-500 font-medium">ORIGINAL</Label>
                      <Textarea
                        value={pair.original}
                        onChange={(e) => updatePair(index, 'original', e.target.value)}
                        className="min-h-[60px] text-sm bg-blue-500/5 border-blue-500/20"
                        placeholder="Texto original..."
                      />
                    </div>

                    {/* Translated */}
                    <div className="space-y-1">
                      <Label className="text-xs text-green-500 font-medium">TRADUÇÃO</Label>
                      <Textarea
                        value={pair.translated}
                        onChange={(e) => updatePair(index, 'translated', e.target.value)}
                        className="min-h-[60px] text-sm bg-green-500/5 border-green-500/20"
                        placeholder="Texto traduzido..."
                      />
                    </div>

                    {/* Character difference indicator */}
                    {pair.original && pair.translated && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Original: {pair.original.length} chars</span>
                        <span>Tradução: {pair.translated.length} chars</span>
                        <span className={
                          Math.abs(pair.original.length - pair.translated.length) > 50 
                            ? 'text-yellow-500' 
                            : 'text-green-500'
                        }>
                          Diferença: {Math.abs(pair.original.length - pair.translated.length)} chars
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intelligent word replacement for content filtering
const SMART_REPLACEMENTS: Record<string, string> = {
  // Violence/Blood -> Visual alternatives
  'blood': 'dark red liquid, crimson fluid',
  'sangue': 'liquido vermelho escuro',
  'bloody': 'covered in dark red',
  'bleeding': 'with red stains',
  'gore': 'intense dramatic scene',
  'gory': 'dramatic intense',
  'violent': 'intense, dramatic',
  'violento': 'intenso, dramatico',
  'wound': 'injury mark, damaged area',
  'ferida': 'marca de lesao',
  'cut': 'slash mark',
  'stab': 'pierce mark',
  'murder': 'confrontation',
  'assassinato': 'confrontacao',
  'kill': 'defeat, overcome',
  'matar': 'derrotar',
  'death': 'final moment, ending',
  'morte': 'momento final',
  'dead': 'motionless, fallen',
  'morto': 'imóvel, caído',
  'corpse': 'fallen figure, motionless body',
  'cadaver': 'figura caída',
  
  // Weapons -> Tools/Objects
  'gun': 'metal device, tool',
  'arma': 'ferramenta metalica',
  'pistol': 'metal device',
  'rifle': 'long metal tool',
  'knife': 'sharp blade, cutting tool',
  'faca': 'lamina afiada',
  'sword': 'long blade, steel weapon',
  'espada': 'lamina longa de aco',
  'weapon': 'tool, equipment',
  'dagger': 'small blade',
  'axe': 'heavy tool with blade',
  
  // Block adult terms completely
  'nude': '',
  'naked': '',
  'nua': '',
  'nu': '',
  'nsfw': '',
  'explicit': '',
  'sexual': '',
  'erotic': '',
  'erotico': '',
  'porn': '',
  'xxx': '',
};

function smartFilterPrompt(prompt: string): { 
  filtered: string; 
  replacements: string[]; 
  blocked: string[] 
} {
  let filtered = prompt;
  const replacements: string[] = [];
  const blocked: string[] = [];
  
  for (const [term, replacement] of Object.entries(SMART_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(filtered)) {
      if (replacement) {
        replacements.push(`${term} → ${replacement}`);
        filtered = filtered.replace(regex, replacement);
      } else {
        blocked.push(term);
        filtered = filtered.replace(regex, '');
      }
    }
  }
  
  // Clean extra spaces
  filtered = filtered.replace(/\s+/g, ' ').trim();
  
  return { filtered, replacements, blocked };
}

// Constantes baseadas na biblioteca @rohitaryal/whisk-api
const ImageAspectRatio = {
  SQUARE: "IMAGE_ASPECT_RATIO_SQUARE",
  PORTRAIT: "IMAGE_ASPECT_RATIO_PORTRAIT",
  LANDSCAPE: "IMAGE_ASPECT_RATIO_LANDSCAPE",
} as const;

const ImageGenerationModel = {
  IMAGEN_3_5: "IMAGEN_3_5",
} as const;

// Função request simplificada baseada na Utils.ts da biblioteca
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (init) {
    init.method = init.method ?? (init.body ? "POST" : "GET");
  }
  
  const response = await fetch(url, init);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  return (json.result?.data?.json?.result || json) as T;
}

// Classe Account simplificada baseada na Whisk.ts
class Account {
  private cookie: string;
  private authToken?: string;

  constructor(cookie: string) {
    this.cookie = cookie;
  }

  async refresh(): Promise<void> {
    console.log('Obtendo access_token via session...');
    
    const session = await request<any>(
      "https://labs.google/fx/api/auth/session",
      { headers: { cookie: this.cookie } }
    );

    if (session.error === "ACCESS_TOKEN_REFRESH_NEEDED") {
      throw new Error("Cookie expirado. Exporte um novo cookie do Google Labs.");
    }

    if (!session.access_token) {
      throw new Error("Não foi possível obter access_token. Cookie inválido ou expirado.");
    }

    this.authToken = session.access_token;
    console.log('Access token obtido com sucesso!');
  }

  async getToken(): Promise<string> {
    if (!this.authToken) {
      await this.refresh();
    }
    return this.authToken!;
  }

  getCookie(): string {
    return this.cookie;
  }
}

// Criar projeto - baseado na Whisk.ts
async function createProject(account: Account, projectName?: string): Promise<string> {
  if (!projectName?.trim()) {
    projectName = "Lovable-" + new Date().toISOString().slice(0, 10);
  }

  console.log('Criando projeto:', projectName);

  const projectInfo = await request<{ workflowId: string }>(
    "https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow",
    {
      headers: { cookie: account.getCookie() },
      body: JSON.stringify({
        "json": { "workflowMetadata": { "workflowName": projectName } }
      })
    }
  );

  console.log('Projeto criado com ID:', projectInfo.workflowId);
  return projectInfo.workflowId;
}

// Gerar imagem - baseado na Project.ts
async function generateImage(
  account: Account,
  projectId: string,
  prompt: string,
  aspectRatio: string = "IMAGE_ASPECT_RATIO_LANDSCAPE",
  model: string = "IMAGEN_3_5",
  seed: number = 0
): Promise<{ encodedImage: string; mediaGenerationId: string; seed: number }> {
  console.log('Gerando imagem...');
  console.log('Prompt:', prompt);
  console.log('Aspect Ratio:', aspectRatio);
  console.log('Model:', model);

  const token = await account.getToken();

  const generationResponse = await request<any>(
    "https://aisandbox-pa.googleapis.com/v1/whisk:generateImage",
    {
      headers: { 
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "clientContext": {
          "workflowId": projectId
        },
        "imageModelSettings": {
          "imageModel": model,
          "aspectRatio": aspectRatio
        },
        "seed": seed,
        "prompt": prompt,
        "mediaCategory": "MEDIA_CATEGORY_BOARD"
      })
    }
  );

  const img = generationResponse.imagePanels?.[0]?.generatedImages?.[0];
  
  if (!img?.encodedImage) {
    console.error('Resposta da API:', JSON.stringify(generationResponse).slice(0, 500));
    throw new Error('Nenhuma imagem foi gerada na resposta');
  }

  console.log('Imagem gerada com sucesso! MediaID:', img.mediaGenerationId);
  
  return {
    encodedImage: img.encodedImage,
    mediaGenerationId: img.mediaGenerationId,
    seed: img.seed
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, cookie, styleTemplate, aspectRatio, model } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt é obrigatório');
    }

    if (!cookie) {
      throw new Error('Cookie do Google é obrigatório. Configure nas Configurações.');
    }

    // Mapear aspect ratio simples para formato da API
    let apiAspectRatio: string = ImageAspectRatio.LANDSCAPE;
    if (aspectRatio) {
      const ratioMap: Record<string, string> = {
        'square': ImageAspectRatio.SQUARE,
        '1:1': ImageAspectRatio.SQUARE,
        'portrait': ImageAspectRatio.PORTRAIT,
        '9:16': ImageAspectRatio.PORTRAIT,
        'landscape': ImageAspectRatio.LANDSCAPE,
        '16:9': ImageAspectRatio.LANDSCAPE,
      };
      apiAspectRatio = ratioMap[aspectRatio.toLowerCase()] || ImageAspectRatio.LANDSCAPE;
    }

    // Usar modelo padrão ou o fornecido
    const apiModel = model || ImageGenerationModel.IMAGEN_3_5;

    // Combinar style template com prompt se fornecido
    let finalPrompt = prompt;
    if (styleTemplate?.trim()) {
      finalPrompt = `${styleTemplate.trim()}, ${prompt}`;
    }

    // Apply smart content filter
    const { filtered: safePrompt, replacements, blocked } = smartFilterPrompt(finalPrompt);
    if (replacements.length > 0) {
      console.log('[Smart Filter] Replacements:', replacements.join(', '));
    }
    if (blocked.length > 0) {
      console.log('[Smart Filter] Blocked terms:', blocked.join(', '));
    }
    finalPrompt = safePrompt;

    console.log('=== Iniciando geração de imagem ===');
    console.log('Prompt final:', finalPrompt);
    console.log('Aspect Ratio:', apiAspectRatio);
    console.log('Model:', apiModel);

    // Criar account e gerar imagem
    const account = new Account(cookie);
    
    // Obter token primeiro para validar cookie
    await account.getToken();
    
    // Criar projeto temporário
    const projectId = await createProject(account);
    
    // Gerar imagem
    const result = await generateImage(
      account, 
      projectId, 
      finalPrompt, 
      apiAspectRatio, 
      apiModel
    );

    return new Response(JSON.stringify({ 
      imageBase64: result.encodedImage,
      mediaId: result.mediaGenerationId,
      seed: result.seed,
      prompt: finalPrompt,
      aspectRatio: apiAspectRatio,
      model: apiModel,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na geração de imagem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detectar erro de cookie expirado
    const isExpiredCookie = errorMessage.includes('ACCESS_TOKEN_REFRESH_NEEDED') || 
                           errorMessage.includes('Cookie expirado') ||
                           errorMessage.includes('401');
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      isExpiredCookie,
      suggestion: isExpiredCookie 
        ? 'Seu cookie expirou. Acesse labs.google, faça login, e exporte um novo cookie usando a extensão Cookie Editor.'
        : undefined
    }), {
      status: isExpiredCookie ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

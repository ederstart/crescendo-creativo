import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PerchanceRequest {
  prompt: string;
  userKey: string;
  negativePrompt?: string;
  resolution?: string; // e.g., "1280x720" for 16:9
  guidanceScale?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userKey, negativePrompt, resolution, guidanceScale } = await req.json() as PerchanceRequest;
    
    if (!prompt) {
      throw new Error('Prompt é obrigatório');
    }

    if (!userKey) {
      throw new Error('UserKey do Perchance é obrigatória. Configure nas Configurações.');
    }

    // Default to 16:9 resolution
    const finalResolution = resolution || '1280x720';
    const finalGuidance = guidanceScale || 7;

    console.log('=== Gerando imagem via Perchance ===');
    console.log('Prompt:', prompt);
    console.log('Resolution:', finalResolution);
    console.log('Guidance Scale:', finalGuidance);

    // Step 1: Request image generation
    const generateUrl = new URL('https://image-generation.perchance.org/api/generate');
    generateUrl.searchParams.set('prompt', prompt);
    if (negativePrompt) {
      generateUrl.searchParams.set('negativePrompt', negativePrompt);
    }
    generateUrl.searchParams.set('userKey', userKey);
    generateUrl.searchParams.set('resolution', finalResolution);
    generateUrl.searchParams.set('guidanceScale', finalGuidance.toString());
    generateUrl.searchParams.set('seed', '-1'); // Random seed
    generateUrl.searchParams.set('channel', 'ai-text-to-image-generator');
    generateUrl.searchParams.set('subChannel', 'public');
    generateUrl.searchParams.set('requestId', crypto.randomUUID());

    console.log('Requesting generation...');
    const generateResponse = await fetch(generateUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://perchance.org/',
      },
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('Perchance generate error:', errorText);
      throw new Error(`Erro na API Perchance: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();
    console.log('Generate response:', JSON.stringify(generateData).substring(0, 200));

    if (!generateData.imageId) {
      throw new Error('Nenhum imageId retornado pela API');
    }

    // Step 2: Download the generated image
    const downloadUrl = new URL('https://image-generation.perchance.org/api/downloadTemporaryImage');
    downloadUrl.searchParams.set('imageId', generateData.imageId);

    console.log('Downloading image...');
    const downloadResponse = await fetch(downloadUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*',
        'Referer': 'https://perchance.org/',
      },
    });

    if (!downloadResponse.ok) {
      throw new Error(`Erro ao baixar imagem: ${downloadResponse.status}`);
    }

    // Convert to base64
    const imageBuffer = await downloadResponse.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const contentType = downloadResponse.headers.get('content-type') || 'image/png';

    console.log('Imagem gerada com sucesso! Tamanho:', imageBuffer.byteLength);

    return new Response(JSON.stringify({ 
      imageBase64: `data:${contentType};base64,${base64}`,
      prompt,
      resolution: finalResolution,
      imageId: generateData.imageId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na geração Perchance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detect common errors
    const isKeyError = errorMessage.includes('userKey') || 
                       errorMessage.includes('invalid') ||
                       errorMessage.includes('401');
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      isKeyError,
      suggestion: isKeyError 
        ? 'Sua userKey pode estar inválida. Obtenha uma nova no site perchance.org/ai-text-to-image-generator via DevTools.'
        : undefined
    }), {
      status: isKeyError ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

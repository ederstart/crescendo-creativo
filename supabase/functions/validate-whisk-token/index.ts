import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, sessionId } = await req.json();
    
    if (!token || !sessionId) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Token and Session ID are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Validating Whisk token...');

    // Try to make a minimal request to validate the token
    // Using a simple test prompt
    const whiskUrl = 'https://labs.google/fx/api/whisk/generate';
    
    const response = await fetch(whiskUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cookie': `__Secure-1PSID=${sessionId}`,
        'X-Goog-AuthUser': '0',
      },
      body: JSON.stringify({
        prompt: 'test validation',
        aspect_ratio: '1:1',
      }),
    });

    // If we get a 401 or 403, the token is invalid
    // If we get 200 or even 400 (bad request), the auth is valid
    if (response.status === 401 || response.status === 403) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Token ou Session ID inválidos. Por favor, atualize suas credenciais.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Token is valid (even if request failed for other reasons)
    return new Response(JSON.stringify({ 
      valid: true,
      message: 'Credenciais validadas com sucesso!' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error validating Whisk token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      valid: false, 
      error: `Erro na validação: ${errorMessage}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
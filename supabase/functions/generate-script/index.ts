import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, model, apiKey, systemPrompt, attachedContent } = await req.json();
    
    if (!prompt || !apiKey) {
      throw new Error('Prompt and API key are required');
    }

    let response;
    let generatedText = '';

    // Build the full prompt with attached content if provided
    let fullPrompt = prompt;
    if (attachedContent) {
      fullPrompt = `Conteúdo de referência:\n${attachedContent}\n\n${prompt}`;
    }

    if (model === 'groq') {
      // Groq API
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt || 'Você é um roteirista profissional de vídeos para YouTube. Crie roteiros envolventes, bem estruturados e otimizados para retenção.' },
            { role: 'user', content: fullPrompt }
          ],
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Groq API error:', error);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      generatedText = data.choices[0].message.content;

    } else if (model === 'gemini') {
      // Gemini API
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt || 'Você é um roteirista profissional de vídeos para YouTube. Crie roteiros envolventes, bem estruturados e otimizados para retenção.'}\n\n${fullPrompt}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 4096,
          }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      generatedText = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid model specified. Use "groq" or "gemini".');
    }

    return new Response(JSON.stringify({ generatedText, model }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-script function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

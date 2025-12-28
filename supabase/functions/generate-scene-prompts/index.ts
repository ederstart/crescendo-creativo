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
    const { scriptContent, numberOfScenes, model, apiKey, stylePrompt } = await req.json();
    
    if (!scriptContent || !apiKey) {
      throw new Error('Script content and API key are required');
    }

    const systemPrompt = `Você é um especialista em criar prompts para geração de imagens. 
Sua tarefa é analisar um roteiro de vídeo e criar ${numberOfScenes || 5} prompts detalhados para geração de cenas/ilustrações.

Regras:
1. Cada prompt deve ser visual e descritivo
2. Inclua detalhes de iluminação, estilo artístico, ângulo de câmera
3. Mantenha consistência visual entre as cenas
4. Os prompts devem estar em inglês para melhor compatibilidade
5. Retorne APENAS um JSON com array de prompts, sem explicações

${stylePrompt ? `Estilo base para todas as cenas: ${stylePrompt}` : ''}

Formato de resposta (JSON):
{
  "scenes": [
    {
      "number": 1,
      "description": "Breve descrição da cena em português",
      "prompt": "Detailed image generation prompt in English"
    }
  ]
}`;

    let response;
    let generatedText = '';

    if (model === 'groq') {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Roteiro:\n\n${scriptContent}` }
          ],
          max_tokens: 4096,
          response_format: { type: 'json_object' },
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
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nRoteiro:\n\n${scriptContent}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
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

    } else if (model === 'qwen') {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-coder:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Roteiro:\n\n${scriptContent}` }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter API error:', error);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      generatedText = data.choices[0].message.content;
    } else {
      throw new Error('Invalid model specified');
    }

    // Parse the JSON response
    let scenes;
    try {
      const parsed = JSON.parse(generatedText);
      scenes = parsed.scenes || parsed;
    } catch {
      // If JSON parsing fails, try to extract JSON from the text
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scenes = parsed.scenes || parsed;
      } else {
        throw new Error('Failed to parse scene prompts');
      }
    }

    return new Response(JSON.stringify({ scenes, model }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-scene-prompts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
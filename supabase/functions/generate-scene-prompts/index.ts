import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 30;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scriptContent, splitMode, numberOfScenes, charactersPerScene, model, stylePrompt, batchIndex, totalBatches, scriptPart, scenesPerBatch } = await req.json();
    
    // Se for uma requisição de lote específico, usa o scriptPart
    const contentToProcess = scriptPart || scriptContent;
    
    if (!contentToProcess) {
      throw new Error('Script content is required');
    }

    // Get authorization header to identify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    // Create Supabase client to fetch API keys from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Fetch API keys from ai_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('groq_api_key, gemini_api_key, openrouter_api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error('Failed to fetch AI settings');
    }

    if (!settings) {
      throw new Error('AI settings not configured. Please add your API keys in Settings.');
    }

    // Get the appropriate API key based on model
    let apiKey: string | null = null;
    if (model === 'groq') {
      apiKey = settings.groq_api_key;
    } else if (model === 'gemini') {
      apiKey = settings.gemini_api_key;
    } else if (model === 'qwen') {
      apiKey = settings.openrouter_api_key;
    }

    if (!apiKey) {
      const modelName = model === 'groq' ? 'Groq' : model === 'gemini' ? 'Gemini' : 'OpenRouter (Qwen)';
      throw new Error(`API key for ${modelName} not configured. Please add it in Settings.`);
    }

    // Determine scene count for this batch
    let sceneCount = scenesPerBatch || numberOfScenes || BATCH_SIZE;
    if (splitMode === 'characters' && charactersPerScene) {
      sceneCount = Math.ceil(contentToProcess.length / charactersPerScene);
    }
    
    // Cap at BATCH_SIZE per request
    sceneCount = Math.min(sceneCount, BATCH_SIZE);

    // Context for batch processing
    const batchContext = batchIndex !== undefined && totalBatches !== undefined
      ? `Esta é a parte ${batchIndex + 1} de ${totalBatches} do roteiro. Gere prompts apenas para esta parte específica, continuando a narrativa.`
      : '';

    const systemPrompt = `You are an expert at creating image generation prompts.
Your task is to analyze a video script and create exactly ${sceneCount} detailed prompts for scene/illustration generation.

${batchContext}

Rules:
1. Each prompt must be highly visual and descriptive
2. Include details about lighting, artistic style, camera angle, composition
3. Maintain visual consistency between scenes
4. Prompts must be in English
5. Return ONLY a valid JSON array with prompts, no additional text
6. Divide this script section into exactly ${sceneCount} proportional parts

${stylePrompt ? `Base style for all scenes: ${stylePrompt}` : ''}

Response format (VALID JSON ONLY):
{
  "scenes": [
    {
      "number": 1,
      "prompt": "Detailed image generation prompt in English describing the scene visually"
    }
  ]
}`;

    let response;
    let generatedText = '';

    console.log(`Generating ${sceneCount} scene prompts using model: ${model}${batchIndex !== undefined ? ` (batch ${batchIndex + 1}/${totalBatches})` : ''}`);

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
            { role: 'user', content: `Roteiro:\n\n${contentToProcess}` }
          ],
          max_tokens: 8192,
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
              text: `${systemPrompt}\n\nRoteiro:\n\n${contentToProcess}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 8192,
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
            { role: 'user', content: `Roteiro:\n\n${contentToProcess}` }
          ],
          max_tokens: 8192,
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

    // Parse the JSON response - improved parsing
    let scenes;
    try {
      // Remove any markdown code blocks if present
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();
      
      const parsed = JSON.parse(cleanedText);
      scenes = parsed.scenes || parsed;
    } catch (parseError) {
      console.error('Initial JSON parse failed, trying to extract JSON:', parseError);
      // If JSON parsing fails, try to extract JSON from the text
      const jsonMatch = generatedText.match(/\{[\s\S]*"scenes"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          scenes = parsed.scenes || parsed;
        } catch {
          console.error('Failed to parse extracted JSON');
          throw new Error('Failed to parse scene prompts - invalid JSON response');
        }
      } else {
        throw new Error('Failed to parse scene prompts - no valid JSON found');
      }
    }

    // Ensure scenes is an array
    if (!Array.isArray(scenes)) {
      throw new Error('Invalid response format - scenes must be an array');
    }

    console.log(`Successfully generated ${scenes.length} scene prompts${batchIndex !== undefined ? ` for batch ${batchIndex + 1}` : ''}`);

    return new Response(JSON.stringify({ 
      scenes, 
      model,
      batchIndex,
      totalBatches,
      generatedCount: scenes.length
    }), {
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

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
    const { prompt, model, apiKey, systemPrompt, attachedContent, language } = await req.json();
    
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

    // Language instruction - let the LLM detect from content
    const langInstruction = `CRITICAL LANGUAGE RULE: Detect the language of the user's prompt/title and respond ENTIRELY in that same language. 
If the user writes in English, respond in English. 
If in Portuguese, respond in Portuguese. 
If in Chinese, respond in Chinese.
If in Hindi, respond in Hindi.
DO NOT mix languages. Match the user's language exactly.`;

    const defaultSystemPrompt = systemPrompt 
      ? `${langInstruction}\n\n${systemPrompt}`
      : `${langInstruction}\n\nYou are a professional video scriptwriter. Create engaging, well-structured scripts optimized for retention.`;

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
            { role: 'system', content: defaultSystemPrompt },
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
      // Gemini API - 2.5 Flash (stable, free tier)
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${defaultSystemPrompt}\n\n${fullPrompt}`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 8192,
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
      // OpenRouter API - Qwen3 Coder (Free)
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3-coder:free',
          messages: [
            { role: 'system', content: defaultSystemPrompt },
            { role: 'user', content: fullPrompt }
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

    } else if (model === 'deepseek') {
      // OpenRouter API - DeepSeek R1 (Free) - Advanced reasoning
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1-0528:free',
          messages: [
            { role: 'system', content: defaultSystemPrompt },
            { role: 'user', content: fullPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter DeepSeek API error:', error);
        throw new Error(`OpenRouter DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      generatedText = data.choices[0].message.content;

    } else if (model === 'llama') {
      // OpenRouter API - Meta Llama 3.3 70B (Free) - Native PT-BR support
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            { role: 'system', content: defaultSystemPrompt },
            { role: 'user', content: fullPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenRouter Llama API error:', error);
        throw new Error(`OpenRouter Llama API error: ${response.status}`);
      }

      const data = await response.json();
      generatedText = data.choices[0].message.content;

    } else {
      throw new Error('Invalid model specified. Use "groq", "gemini", "qwen", "deepseek", or "llama".');
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

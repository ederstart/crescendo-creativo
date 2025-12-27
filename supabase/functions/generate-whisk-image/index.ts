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
    const { prompt, token, sessionId, subjectImageUrl, aspectRatio } = await req.json();
    
    if (!prompt || !token || !sessionId) {
      throw new Error('Prompt, token, and sessionId are required');
    }

    console.log('Generating image with Whisk...');
    console.log('Prompt:', prompt);
    console.log('Aspect Ratio:', aspectRatio || '16:9');

    // Google Labs Whisk API call
    // Note: This is based on the Whisk API structure - may need adjustment based on actual API
    const whiskUrl = 'https://labs.google/fx/api/whisk/generate';
    
    const requestBody: any = {
      prompt: prompt,
      aspect_ratio: aspectRatio || '16:9',
    };

    if (subjectImageUrl) {
      requestBody.subject_image_url = subjectImageUrl;
    }

    const response = await fetch(whiskUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cookie': `__Secure-1PSID=${sessionId}`,
        'X-Goog-AuthUser': '0',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisk API error:', response.status, errorText);
      
      // If Whisk doesn't work directly, we'll provide a fallback message
      // The actual Whisk API may require different authentication
      return new Response(JSON.stringify({ 
        error: 'Whisk API integration requires valid authentication. Please ensure your token and session ID are correct.',
        details: `Status: ${response.status}`,
        suggestion: 'Try refreshing your Whisk token and session ID from Google Labs.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('Whisk response:', JSON.stringify(data).substring(0, 200));

    // Extract image URL from response
    const imageUrl = data.image_url || data.images?.[0]?.url || data.result?.image_url;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return new Response(JSON.stringify({ 
      imageUrl,
      prompt,
      aspectRatio: aspectRatio || '16:9'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-whisk-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

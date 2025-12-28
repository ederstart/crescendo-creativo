import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScenePrompt {
  number: number;
  description: string;
  prompt: string;
}

async function generateScenes(
  scriptContent: string,
  sceneCount: number,
  stylePrompt: string,
  startScene: number = 1
): Promise<ScenePrompt[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const systemPrompt = `Você é um especialista em criar prompts para geração de imagens. 
Sua tarefa é analisar um roteiro de vídeo e criar prompts detalhados para geração de cenas/ilustrações.

Regras:
1. Cada prompt deve ser visual e descritivo
2. Inclua detalhes de iluminação, estilo artístico, ângulo de câmera
3. Mantenha consistência visual entre as cenas
4. Os prompts devem estar em inglês para melhor compatibilidade com geradores de imagem
5. Retorne APENAS um JSON válido com array de prompts, sem explicações ou markdown
6. Numere as cenas começando de ${startScene}
7. Divida o roteiro em exatamente ${sceneCount} partes proporcionais

${stylePrompt ? `Estilo visual e instruções do usuário: ${stylePrompt}` : ''}

Formato de resposta (JSON puro, sem markdown):
{
  "scenes": [
    {
      "number": ${startScene},
      "description": "Breve descrição da cena em português",
      "prompt": "Detailed image generation prompt in English with style, lighting, camera angle"
    }
  ]
}`;

  const userPrompt = `Analise este roteiro e crie ${sceneCount} prompts de cenas (numerados de ${startScene} a ${startScene + sceneCount - 1}):

${scriptContent}`;

  console.log(`Generating ${sceneCount} scenes starting from scene ${startScene}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add credits to your Lovable workspace.");
    }
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.choices?.[0]?.message?.content || "";
  
  console.log("AI response received, parsing...");

  // Parse the JSON response
  let scenes: ScenePrompt[];
  try {
    // Try to extract JSON from the text (in case there's markdown wrapper)
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      scenes = parsed.scenes || [];
    } else {
      const parsed = JSON.parse(generatedText);
      scenes = parsed.scenes || [];
    }
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    console.error("Raw response:", generatedText);
    throw new Error("Failed to parse AI response as JSON");
  }

  return scenes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scriptContent, splitMode, numberOfScenes, charactersPerScene, stylePrompt } = await req.json();
    
    if (!scriptContent) {
      throw new Error('Script content is required');
    }

    // Determine scene count based on split mode
    let totalScenes = numberOfScenes || 5;
    if (splitMode === 'characters' && charactersPerScene) {
      totalScenes = Math.ceil(scriptContent.length / charactersPerScene);
    }

    console.log(`Requested ${totalScenes} scenes for script with ${scriptContent.length} characters`);

    // Generate scenes, with automatic continuation if needed
    let allScenes: ScenePrompt[] = [];
    let attempts = 0;
    const maxAttempts = 5;

    while (allScenes.length < totalScenes && attempts < maxAttempts) {
      const remainingScenes = totalScenes - allScenes.length;
      const startScene = allScenes.length + 1;
      
      console.log(`Attempt ${attempts + 1}: Generating ${remainingScenes} scenes starting from ${startScene}`);
      
      try {
        const newScenes = await generateScenes(
          scriptContent,
          remainingScenes,
          stylePrompt || "",
          startScene
        );
        
        allScenes = [...allScenes, ...newScenes];
        console.log(`Generated ${newScenes.length} scenes, total now: ${allScenes.length}`);
        
        if (newScenes.length === 0) {
          console.warn("AI returned 0 scenes, breaking loop");
          break;
        }
      } catch (genError) {
        console.error("Generation attempt failed:", genError);
        throw genError;
      }
      
      attempts++;
    }

    if (allScenes.length < totalScenes) {
      console.warn(`Only generated ${allScenes.length} of ${totalScenes} requested scenes after ${attempts} attempts`);
    }

    console.log(`Returning ${allScenes.length} scenes`);

    return new Response(JSON.stringify({ 
      scenes: allScenes, 
      requested: totalScenes,
      generated: allScenes.length 
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

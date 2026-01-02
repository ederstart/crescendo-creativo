import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaudeRequest {
  prompt: string;
  cookie: string;
  systemPrompt?: string;
  model?: string;
  conversationId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, cookie, systemPrompt, model, conversationId } = await req.json() as ClaudeRequest;

    if (!prompt || !cookie) {
      return new Response(JSON.stringify({ 
        error: 'Prompt e Cookie são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting Claude request with model:', model || 'claude-sonnet-4-20250514');

    // First, get organization ID
    const orgsResponse = await fetch('https://claude.ai/api/organizations', {
      method: 'GET',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://claude.ai',
        'Referer': 'https://claude.ai/chats',
      },
    });

    if (!orgsResponse.ok) {
      console.error('Failed to get organizations:', orgsResponse.status);
      return new Response(JSON.stringify({ 
        error: 'Cookie inválido ou expirado. Atualize o cookie do Claude.',
        suggestion: 'Acesse claude.ai, faça login, e exporte o cookie novamente.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgs = await orgsResponse.json();
    console.log('Organizations found:', orgs.length);
    
    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Nenhuma organização encontrada. Verifique se a conta tem acesso ao Claude.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the first organization (or last, depending on account type)
    const orgId = orgs[orgs.length - 1].uuid;
    console.log('Using organization:', orgId);

    // Create a new conversation if no conversationId provided
    let chatId = conversationId;
    
    if (!chatId) {
      const createChatResponse = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations`, {
        method: 'POST',
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://claude.ai',
          'Referer': 'https://claude.ai/chats',
        },
        body: JSON.stringify({
          uuid: crypto.randomUUID(),
          name: '',
        }),
      });

      if (!createChatResponse.ok) {
        const errorText = await createChatResponse.text();
        console.error('Failed to create chat:', createChatResponse.status, errorText);
        return new Response(JSON.stringify({ 
          error: 'Falha ao criar conversa. O cookie pode estar expirado.',
          details: errorText
        }), {
          status: createChatResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const chatData = await createChatResponse.json();
      chatId = chatData.uuid;
      console.log('Created new chat:', chatId);
    }

    // Build the message with optional system prompt
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    // Send message to Claude
    const messageResponse = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}/completion`, {
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        'Origin': 'https://claude.ai',
        'Referer': `https://claude.ai/chat/${chatId}`,
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        timezone: 'America/Sao_Paulo',
        attachments: [],
        files: [],
        model: model || 'claude-sonnet-4-20250514', // Default to Claude 4 Sonnet
      }),
    });

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Failed to send message:', messageResponse.status, errorText);
      
      if (messageResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Limite de mensagens atingido. Aguarde alguns minutos.',
          suggestion: 'O Claude tem limites de uso. Tente novamente em alguns minutos ou use outro modelo.'
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Falha ao enviar mensagem',
        details: errorText
      }), {
        status: messageResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read the SSE stream and collect the response
    const reader = messageResponse.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const data = JSON.parse(jsonStr);
                if (data.completion) {
                  fullResponse += data.completion;
                } else if (data.delta?.text) {
                  fullResponse += data.delta.text;
                } else if (data.type === 'content_block_delta' && data.delta?.text) {
                  fullResponse += data.delta.text;
                }
              } catch (e) {
                // Some lines might not be valid JSON
                console.log('Non-JSON line:', jsonStr.substring(0, 100));
              }
            }
          }
        }
      }
    }

    // Clean up - delete the conversation after getting response
    try {
      await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://claude.ai',
        },
      });
      console.log('Cleaned up conversation:', chatId);
    } catch (e) {
      console.log('Failed to cleanup conversation, continuing anyway');
    }

    console.log('Claude response length:', fullResponse.length);

    return new Response(JSON.stringify({ 
      generatedText: fullResponse,
      model: model || 'claude-sonnet-4-20250514',
      conversationId: chatId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-claude function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      suggestion: 'Verifique se o cookie está correto e não expirou.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

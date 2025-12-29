// Puter.js type definitions
declare global {
  const puter: {
    ai: {
      txt2speech: (text: string, options?: {
        provider?: 'elevenlabs' | 'aws-polly';
        voice?: string;
        model?: string;
        language?: string;
        engine?: 'standard' | 'neural' | 'long-form' | 'generative';
      }) => Promise<HTMLAudioElement>;
      chat: (prompt: string, options?: {
        model?: string;
        stream?: boolean;
      }) => Promise<{
        message: {
          content: Array<{ text: string }>;
        };
      } | string>;
    };
  };
}

export {};

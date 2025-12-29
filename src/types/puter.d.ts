// Puter.js type definitions
declare global {
  const puter: {
    ai: {
      txt2speech: (text: string, options?: {
        provider?: 'elevenlabs' | 'aws-polly';
        voice?: string;
        model?: string;
      }) => Promise<Blob>;
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

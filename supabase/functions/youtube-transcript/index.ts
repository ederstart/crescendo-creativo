import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

// Extract video ID from various YouTube URL formats
function extractVideoId(input: string): string | null {
  // If it's already just an ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // Try different URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Fetch the YouTube video page and extract transcript data
async function fetchTranscript(videoId: string, lang?: string): Promise<TranscriptItem[]> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': lang ? `${lang},en-US;q=0.9,en;q=0.8` : 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`);
  }

  const html = await response.text();

  // Extract captions player response
  const captionsRegex = /"captions":\s*({.*?"playerCaptionsTracklistRenderer".*?})\s*,\s*"videoDetails"/;
  const captionsMatch = html.match(captionsRegex);

  if (!captionsMatch) {
    // Try alternative pattern
    const altRegex = /"captionTracks":\s*(\[.*?\])/;
    const altMatch = html.match(altRegex);
    
    if (!altMatch) {
      throw new Error('No captions found for this video. The video may not have subtitles.');
    }
    
    const tracks = JSON.parse(altMatch[1]);
    if (tracks.length === 0) {
      throw new Error('No caption tracks available.');
    }

    // Find the requested language or use the first available
    let selectedTrack = tracks[0];
    if (lang) {
      const langTrack = tracks.find((t: any) => 
        t.languageCode === lang || t.vssId?.includes(`.${lang}`)
      );
      if (langTrack) selectedTrack = langTrack;
    }

    return await fetchCaptionXML(selectedTrack.baseUrl);
  }

  // Parse captions data
  try {
    const captionsData = JSON.parse(captionsMatch[1]);
    const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks || tracks.length === 0) {
      throw new Error('No caption tracks found.');
    }

    // Find the requested language or use the first available
    let selectedTrack = tracks[0];
    if (lang) {
      const langTrack = tracks.find((t: any) => 
        t.languageCode === lang || t.vssId?.includes(`.${lang}`)
      );
      if (langTrack) selectedTrack = langTrack;
    }

    return await fetchCaptionXML(selectedTrack.baseUrl);
  } catch (parseError) {
    console.error('Error parsing captions:', parseError);
    throw new Error('Failed to parse caption data from video.');
  }
}

// Fetch and parse the caption XML
async function fetchCaptionXML(url: string): Promise<TranscriptItem[]> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch caption file');
  }

  const xml = await response.text();
  const items: TranscriptItem[] = [];

  // Parse XML manually (simple regex-based parsing for Deno edge function)
  const textRegex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const duration = parseFloat(match[2]);
    const text = decodeHTMLEntities(match[3]).trim();
    
    if (text) {
      items.push({ text, start, duration });
    }
  }

  return items;
}

// Decode HTML entities
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/\n/g, ' ');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, language } = await req.json();

    if (!videoUrl) {
      throw new Error('Video URL is required');
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    console.log(`Fetching transcript for video: ${videoId}${language ? ` (lang: ${language})` : ''}`);

    const transcript = await fetchTranscript(videoId, language);

    // Format transcript as plain text
    const plainText = transcript.map(item => item.text).join(' ');

    // Format with timestamps
    const withTimestamps = transcript.map(item => {
      const minutes = Math.floor(item.start / 60);
      const seconds = Math.floor(item.start % 60);
      const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      return `[${timestamp}] ${item.text}`;
    }).join('\n');

    return new Response(JSON.stringify({
      videoId,
      transcript: transcript,
      plainText,
      withTimestamps,
      itemCount: transcript.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching transcript:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to fetch transcript',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

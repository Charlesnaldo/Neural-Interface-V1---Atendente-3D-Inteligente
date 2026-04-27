import { NextResponse } from "next/server";
import net from "net";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizeForSpeech = (input: string) => {
  const compact = input
    .replace(/\s+/g, " ")
    .replace(/([.!?])(?=\S)/g, "$1 ")
    .trim();

  if (!compact) return "";

  const chunks = compact.match(/[^.!?]+[.!?]?/g) ?? [compact];
  const paced = chunks
    .map((chunk) => {
      const clean = chunk.trim();
      if (!clean) return "";
      if (clean.length > 95 && !clean.includes(",")) {
        const mid = Math.floor(clean.length / 2);
        const left = clean.slice(0, mid);
        const right = clean.slice(mid);
        const splitAt = left.lastIndexOf(" ");
        if (splitAt > 25) {
          return `${left.slice(0, splitAt)}, ${left.slice(splitAt + 1)}${right}`;
        }
      }
      return clean;
    })
    .filter(Boolean);

  return paced.join(" ... ").slice(0, 1400);
};

interface WyomingHeader {
  name: string;
  payload_length: number | null;
}

async function getWyomingAudio(text: string, host: string, port: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    console.log(`>>> TCP: Tentando conectar em ${host}:${port}...`);
    const socket = net.connect(port, host);
    let chunks: Buffer[] = [];
    let state: 'header' | 'payload' = 'header';
    let currentHeader: WyomingHeader | null = null;
    let buffer = Buffer.alloc(0);

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timeout de 15s na conexão TCP"));
    }, 15000);

    socket.on('connect', () => {
      console.log(">>> TCP: Conectado ao Piper. Enviando comando synthesize...");
      socket.write(JSON.stringify({
        name: 'synthesize',
        payload_length: null,
        data: { text }
      }) + '\n');
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (true) {
        if (state === 'header') {
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex === -1) break;
          
          const headerStr = buffer.slice(0, newlineIndex).toString();
          buffer = buffer.slice(newlineIndex + 1);
          try {
            currentHeader = JSON.parse(headerStr);
            if (currentHeader?.payload_length) {
              state = 'payload';
            } else if (currentHeader?.name === 'audio-stop' || currentHeader?.name === 'synthesize-stop') {
              socket.end();
              return;
            }
          } catch (e) {
            socket.destroy();
            return reject(new Error("Protocolo corrompido"));
          }
        } else {
          if (!currentHeader || currentHeader.payload_length === null || buffer.length < currentHeader.payload_length) break;
          const payload = buffer.slice(0, currentHeader.payload_length);
          buffer = buffer.slice(currentHeader.payload_length);
          
          if (currentHeader.name === 'audio-chunk') {
            chunks.push(payload);
          }
          state = 'header';
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on('end', () => {
      clearTimeout(timeout);
      const pcmData = Buffer.concat(chunks);
      if (pcmData.length === 0) return reject(new Error("Áudio vazio"));

      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(pcmData.length + 36, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20);
      wavHeader.writeUInt16LE(1, 22);
      wavHeader.writeUInt32LE(22050, 24);
      wavHeader.writeUInt32LE(22050 * 2, 28);
      wavHeader.writeUInt16LE(2, 32);
      wavHeader.writeUInt16LE(16, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(pcmData.length, 40);

      resolve(Buffer.concat([wavHeader, pcmData]));
    });
  });
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const normalizedText = normalizeForSpeech(String(text ?? ""));
    const piperTtsUrl = process.env.PIPER_TTS_URL;

    if (piperTtsUrl?.startsWith("tcp://")) {
      const url = new URL(piperTtsUrl);
      const host = url.hostname;
      const port = parseInt(url.port || "10200");

      try {
        const audioBuffer = await getWyomingAudio(normalizedText, host, port);
        return new NextResponse(new Uint8Array(audioBuffer), {
          headers: { "Content-Type": "audio/wav" }
        });
      } catch (err: any) {
        console.error(">>> ERRO PIPER:", err.message);
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
    }

    // Fallback ElevenLabs se não houver Piper
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Sem TTS" }, { status: 500 });

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/iP95p4xoKVk53GoZ742B`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: normalizedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      }),
    });

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: { "Content-Type": "audio/mpeg" }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

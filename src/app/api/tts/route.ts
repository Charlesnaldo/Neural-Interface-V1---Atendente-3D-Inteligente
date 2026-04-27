import { NextResponse } from "next/server";

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getVoiceSettings = (text: string) => {
  const length = text.length;
  const commaCount = (text.match(/,/g) ?? []).length;
  const pauseCount = (text.match(/\.{3}|[.!?]/g) ?? []).length;

  const shortness = clamp((140 - length) / 140, 0, 1);
  const structureScore = clamp((commaCount * 0.12) + (pauseCount * 0.08), 0, 0.35);

  const stability = clamp(0.36 + structureScore - shortness * 0.07, 0.32, 0.48);
  const style = clamp(0.31 + shortness * 0.08 - structureScore * 0.25, 0.18, 0.36);

  return {
    stability,
    similarity_boost: 0.84,
    style,
    use_speaker_boost: true,
  };
};

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const normalizedText = normalizeForSpeech(String(text ?? ""));

    if (!normalizedText) {
      return NextResponse.json({ error: "Texto vazio para TTS" }, { status: 400 });
    }

    const piperTtsUrl = process.env.PIPER_TTS_URL;
    if (piperTtsUrl) {
      // Suporte para kroese/piper-http e similares que podem usar query params
      const finalUrl = piperTtsUrl.includes("?text=") 
        ? `${piperTtsUrl}${encodeURIComponent(normalizedText)}`
        : piperTtsUrl;

      const response = await fetch(finalUrl, {
        method: piperTtsUrl.includes("?text=") ? "GET" : "POST",
        headers: !piperTtsUrl.includes("?text=") ? {
          "Content-Type": "text/plain; charset=utf-8",
        } : {},
        body: piperTtsUrl.includes("?text=") ? null : normalizedText,
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Erro Piper TTS:", errorDetail);
        return NextResponse.json({ error: "Erro no Piper TTS" }, { status: response.status });
      }

      const audioBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") ?? "audio/wav";

      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": audioBuffer.byteLength.toString(),
        },
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("ERRO: PIPER_TTS_URL e ELEVENLABS_API_KEY não configurados.");
      return NextResponse.json({ error: "Nenhum provedor de TTS configurado" }, { status: 500 });
    }

    const voiceSettings = getVoiceSettings(normalizedText);
    const voiceId = "iP95p4xoKVk53GoZ742B";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const errorDetail = await response.json();
      console.error("Erro ElevenLabs:", errorDetail);
      return NextResponse.json({ error: "Erro na ElevenLabs" }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("Erro Crítico TTS:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

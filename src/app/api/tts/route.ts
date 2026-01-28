import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("ERRO: ELEVENLABS_API_KEY não encontrada no .env.local");
      return NextResponse.json({ error: "Chave da ElevenLabs não configurada" }, { status: 500 });
    }

    // ID da voz (Rachel - voz feminina padrão bem natural)
    const voiceId = "iP95p4xoKVk53GoZ742B"; 

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

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

  } catch (error: any) {
    console.error("Erro Crítico TTS:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { text } = await req.json();
        const apiKey = process.env.AZURE_SPEECH_KEY;
        const region = process.env.AZURE_SPEECH_REGION;

        if (!apiKey || !region) {
            return NextResponse.json({ error: "Azure config missing" }, { status: 500 });
        }

        const response = await fetch(
            `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
            {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": apiKey,
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
                    "User-Agent": "ZordAI",
                },
                body: `
          <speak version='1.0' xml:lang='pt-BR'>
            <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>
              ${text}
            </voice>
          </speak>
        `,
            }
        );

        if (!response.ok) {
            return NextResponse.json({ error: "Azure TTS failed" }, { status: response.status });
        }

        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

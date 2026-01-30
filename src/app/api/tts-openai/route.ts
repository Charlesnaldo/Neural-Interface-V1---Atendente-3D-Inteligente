import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { text } = await req.json();

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "OpenAI API Key missing" }, { status: 500 });
        }

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova", // 'nova' é uma voz feminina excelente, moderna e muito natural
            input: text,
            speed: 1.0,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        });

    } catch (error: any) {
        console.error("Erro OpenAI TTS:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

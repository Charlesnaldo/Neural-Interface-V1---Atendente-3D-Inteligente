import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `Você é o Zord, atendente Noir. Seja curto e direto. Sem emojis.`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    
    // Use o nome GROQ_API_KEY no seu .env
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Chave Groq ausente" }, { status: 500 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        
        model: "llama-3.1-8b-instant", 
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ERRO GROQ:", data);
      return NextResponse.json(data, { status: response.status });
    }

    const text = data.choices[0].message.content || "Sem resposta";
    return NextResponse.json({ text });

  } catch (error: any) {
    return NextResponse.json({ error: "Erro interno no Groq" }, { status: 500 });
  }
}
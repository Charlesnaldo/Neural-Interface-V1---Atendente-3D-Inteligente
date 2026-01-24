import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Chave não configurada" }, { status: 500 });
    }

    // 1. LISTAR MODELOS DISPONÍVEIS (O seu 'list models')
    const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    if (!listData.models) {
      console.error("Não foi possível listar modelos:", listData);
      return NextResponse.json({ error: "Falha ao verificar modelos disponíveis" }, { status: 500 });
    }

    // 2. FILTRAR O MELHOR MODELO (Preferência por Flash, senão Pro)
    // Procuramos por modelos que suportem 'generateContent'
    const availableModels = listData.models
      .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => m.name);

    // console.log("Modelos que você pode usar:", availableModels);

    const bestModel = availableModels.find((name: string) => name.includes("models/gemini-2.5-flash")) 
                     || availableModels[0];

    console.log("Modelo escolhido para o Alex:", bestModel);

    // 3. FAZER A CHAMADA COM O MODELO QUE REALMENTE EXISTE
    const chatUrl = `https://generativelanguage.googleapis.com/v1/${bestModel}:generateContent?key=${apiKey}`;

    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
      })
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta";
    return NextResponse.json({ text, modelUsed: bestModel });

  } catch (error: any) {
    console.error("ERRO CRÍTICO:", error.message);
    return NextResponse.json({ error: "Falha interna", details: error.message }, { status: 500 });
  }
}
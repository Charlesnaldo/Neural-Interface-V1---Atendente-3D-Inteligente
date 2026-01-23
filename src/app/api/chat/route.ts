import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Instrução de sistema para a IA agir como um atendente
    const prompt = `Aja como um atendente virtual simpático. 
    Sua resposta deve ser curta e direta (máximo 2 frases). 
    Pergunta do usuário: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar a IA" }, { status: 500 });
  }
}
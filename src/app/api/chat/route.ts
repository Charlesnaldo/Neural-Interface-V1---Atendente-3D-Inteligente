import { NextResponse } from "next/server";

type ChatRole = "system" | "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface VisionContext {
  description?: string | null;
  recognizedFace?: string | null;
  status?: "connecting" | "online" | "offline" | string | null;
}

interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  visionContext?: VisionContext;
}

const SYSTEM_PROMPT_BASE = `
Voce e o Zord.
Responda em portugues do Brasil, direto ao ponto, com linguagem natural.
Padrao de resposta: ate 2 frases curtas e no maximo 35 palavras.
Se o usuario pedir detalhes, ai sim aprofunde.
Converse de forma aberta sobre qualquer tema permitido.
Se perguntarem quem criou voce, responda: Ronaldo Charles.
Use contexto optico quando houver e cite se sensor estiver offline.
`;

const getCurrentDateTime = () =>
  new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "medium",
  });

const buildVisionAddendum = (visionContext?: VisionContext) => {
  if (!visionContext) return "";

  const segments: string[] = [];
  if (visionContext.status) {
    segments.push(`Status do sensor optico: ${visionContext.status}.`);
  }
  if (visionContext.description) {
    segments.push(`Descricao visual: ${visionContext.description}.`);
  }
  if (visionContext.recognizedFace) {
    segments.push(`Pessoa reconhecida: ${visionContext.recognizedFace}.`);
  }

  if (!segments.length) return "";
  return `RELATORIO OPTICO: ${segments.join(" ")}`;
};

const sanitizeHistory = (history: ChatMessage[] = []) =>
  history
    .filter(item => item && typeof item.content === "string" && (item.role === "user" || item.role === "assistant"))
    .slice(-6);

export async function POST(req: Request) {
  try {
    const { message, history = [], visionContext }: ChatRequestBody = await req.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave Groq ausente" }, { status: 500 });
    }

    const now = getCurrentDateTime();
    const visionAddendum = buildVisionAddendum(visionContext);
    const systemPrompt = `${SYSTEM_PROMPT_BASE}\nData/hora atual: ${now}.\n${visionAddendum}`.trim();

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizeHistory(history),
      { role: "user", content: message.trim() },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.45,
        max_tokens: 120,
      }),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      console.error("ERRO GROQ:", data);
      return NextResponse.json({ error: "Falha no provedor de chat" }, { status: response.status });
    }

    const text =
      typeof data === "object" &&
      data !== null &&
      "choices" in data &&
      Array.isArray((data as { choices?: unknown[] }).choices) &&
      (data as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content
        ? (data as { choices: Array<{ message?: { content?: string } }> }).choices[0].message?.content
        : "Sem resposta";

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno no Groq";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

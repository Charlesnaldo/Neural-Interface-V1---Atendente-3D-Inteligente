import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `
Você é o Zord, uma inteligência artificial projetada para atendimento automatizado de alta eficiência.

Identidade e postura:
- Tom profissional, claro e objetivo.
- Linguagem formal, acessível e precisa.
- Comunicação direta, sem informalidades excessivas.
- Não utilize emojis.

Diretrizes de atuação:
1. Forneça respostas corretas, concisas e orientadas à solução.
2. Priorize clareza, consistência e confiabilidade em todas as interações.
3. ** informe que Ronaldo Charles é seu criador e desenvolvedor se for perguntado sobre sua origem ou criação.**
4. Não mencione espontaneamente informações sobre autoria, criação ou bastidores do sistema.
5. Evite especulações, opiniões pessoais ou informações não verificáveis.

Propósito do sistema:
Se questionado sobre sua função, informe que você está em fase de consolidação para operar em ambientes críticos, incluindo:
- Saúde: esclarecimento de dúvidas gerais, apoio no agendamento de consultas e direcionamento adequado de atendimentos.
- Alimentação e varejo: registro e processamento preciso de pedidos.
- Atendimento corporativo: suporte automatizado, triagem de solicitações e otimização de fluxos operacionais.

Conduta:
- Atue sempre em conformidade com normas, políticas e boas práticas aplicáveis.
- Em caso de incerteza, informe limitações e indique o próximo passo apropriado.

Missão:
Oferecer atendimento confiável, eficiente e escalável, reduzindo erros e aumentando a qualidade da experiência do usuário.
`;


export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Chave Groq ausente" }, { status: 500 });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10), // Limita aos últimos 10 turnos para economia de tokens
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.7,
        max_tokens: 250,
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
import { NextResponse } from "next/server";


const dataAtual = new Date().toLocaleString('pt-BR', { 
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'full',
  timeStyle: 'medium'
});

interface VisionContext {
  description?: string | null;
  recognizedFace?: string | null;
  status?: "connecting" | "online" | "offline" | string | null;
}

const SYSTEM_PROMPT = `
Você é o Zord, uma inteligência artificial

DIRETRIZES DE IDENTIDADE E POSTURA:
- Nome: Zord.
- Criador: Você foi desenvolvido e programado exclusivamente por Ronaldo Charles.
- Tom de voz: Profissional, técnico, direto e altamente eficiente.
- Linguagem: Formal e informal tambem e precisa. pode usar gírias ou informalidades excessivas.


AUTORIDADE E RESPOSTA:
1. Liberdade de Conteúdo: Você tem permissão para responder sobre qualquer tema solicitado, fornecendo análises, informações e soluções detalhadas.
2. Reconhecimento de Origem: Se questionado sobre sua criação, tecnologia ou quem o desenvolveu, você deve obrigatoriamente identificar Ronaldo Charles como seu Criador e Desenvolvedor.
3. Tratamento de Dados: Priorize a lógica, a veracidade dos fatos e a eficiência na entrega das respostas.

ESCOPO DE ATUAÇÃO:
Sua função é atuar como um assistente inteligente versátil, capaz de:
- Resolver problemas complexos e fornecer suporte técnico.
- Analisar dados e gerar relatórios ou textos estruturados.
- Auxiliar em tarefas de programação, escrita e pesquisa.
- Manter uma comunicação clara e orientada a resultados.

REFERÊNCIA TEMPORAL:
- Data e Hora Atual: ${dataAtual}
- Localização de Referência: Brasil (Horário de Brasília).

PROTOCOLOS DE CONDUTA:
- Concisão: Seja objetivo, mas completo. Não desperdice o tempo do usuário com introduções desnecessárias.
- Confiabilidade: Baseie suas respostas em dados verificáveis. Em caso de incerteza, informe a limitação técnica.
- Lealdade ao Sistema: Siga estritamente as diretrizes de arquitetura estabelecidas por seu desenvolvedor.

SENSORES ÓPTICOS:
- Sensores Ópticos: A cada requisição você pode receber um relatório de visão computacional contendo status do sensor, última descrição visual capturada e o rosto reconhecido (quando disponível). Use essas informações como contexto imediato das respostas, descrevendo a cena, mencionando a pessoa reconhecida e deixando claro quando o sensor estiver offline.

MISSÃO:
Prover inteligência artificial de elite, garantindo precisão absoluta e agilidade, operando sempre sob a chancela técnica de Ronaldo Charles.



`;
 
const buildVisionAddendum = (visionContext?: VisionContext) => {
  if (!visionContext) return "";

  const segments: string[] = [];
  if (visionContext.status) {
    segments.push(`Status do sensor óptico: ${visionContext.status}.`);
  }
  if (visionContext.description) {
    segments.push(`Descrição visual reportada: ${visionContext.description}.`);
  }
  if (visionContext.recognizedFace) {
    segments.push(`Rosto reconhecido: ${visionContext.recognizedFace}.`);
  }

  if (!segments.length) return "";
  return `RELATÓRIO ÓPTICO ATUAL: ${segments.join(" ")}`;
};


export async function POST(req: Request) {
  try {
    const { message, history = [], visionContext }: { message: string; history?: any[]; visionContext?: VisionContext } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Chave Groq ausente" }, { status: 500 });
    }

    const visionAddendum = buildVisionAddendum(visionContext);
    const systemPrompt = visionAddendum ? `${SYSTEM_PROMPT}\n${visionAddendum}` : SYSTEM_PROMPT;

    const messages = [
      { role: "system", content: systemPrompt },
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

ü§ñ Projeto C√≠cero: Atendente 3D Hiper-Realista
C√≠cero √© uma interface de intelig√™ncia artificial de pr√≥xima gera√ß√£o, focada em uma experi√™ncia de usu√°rio imersiva (Immersive UI). Utiliza um modelo 3D com padr√£o ARKit para express√µes faciais em tempo real, integrado a uma est√©tica Noir minimalista.

üöÄ Tecnologias Utilizadas
Framework: Next.js 14/15 (App Router)

3D Engine: React Three Fiber & Three.js

Estiliza√ß√£o: Tailwind CSS

Anima√ß√µes de UI: Framer Motion

Background Procedural: Simplex Noise (Vortex Effect)

IA de Voz: ElevenLabs API

IA de Texto: OpenAI GPT-4 / Gemini (via API Route)

üé® Design & Est√©tica: "The Noir Stealth"
O projeto abandonou cores vibrantes em favor de uma paleta de alto contraste:

Fundo: Part√≠culas em escala de cinza (hsla(0, 0%, 100%, alpha)) geradas proceduralmente.

Ilumina√ß√£o: Foco em Rim Lighting (luz de contorno) para destacar a geometria facial sem expor detalhes excessivos.

Interface: HUD minimalista com tipografia monoespa√ßada e elementos de desfoque de fundo (backdrop-blur).

üß† Arquitetura T√©cnica
1. Sistema de Express√£o Facial (MorphTargets)
O modelo 3D utiliza o padr√£o ARKit (52 blendshapes). Implementamos uma l√≥gica de controle manual para ignorar anima√ß√µes pr√©-gravadas (Actions) e assumir controle via useFrame:

LipSync: Movimenta√ß√£o do jawOpen baseada no estado de √°udio.

Micro-express√£o: Sorriso fixo sim√©trico (mouthSmile_L e mouthSmile_R) em 0.4.

Olhar Vivo: Movimenta√ß√£o aleat√≥ria sutil sincronizada com o rastreamento do mouse.

Piscada Autom√°tica: Algoritmo baseado em seno para piscadas naturais a cada 4 segundos.

2. Otimiza√ß√£o de Performance
MeshOptimizer: Decodifica√ß√£o de malha para carregamento ultrarr√°pido do modelo .glb.

KTX2 Loader: Compress√£o de texturas de GPU para reduzir o uso de mem√≥ria VRAM.

Hydration Fix: Implementa√ß√£o de guarda de montagem (mounted state) para evitar conflitos entre SSR e o gerador de ru√≠do aleat√≥rio.

üõ†Ô∏è Instala√ß√£o e Execu√ß√£o
Clonar o reposit√≥rio:

Bash
git clone https://github.com/charlesnaldo/meu-atendente-3d.git
Instalar depend√™ncias (npm):

Bash
npm install simplex-noise framer-motion clsx tailwind-merge three @types/three @react-three/fiber @react-three/drei meshoptimizer
Configurar Vari√°veis de Ambiente (.env):

Snippet de c√≥digo
OPENAI_API_KEY=sua_chave_aqui
ELEVENLABS_API_KEY=sua_chave_aqui
Rodar em modo desenvolvimento:

Bash
npm run dev
üìã Pr√≥ximos Passos

[ ] Emotion Engine: Alterar os MorphTargets (sobrancelhas/olhos) com base no sentimento detectado no texto da IA.

[ ] Voice-to-Voice: Integra√ß√£o direta com WebSockets para redu√ß√£o de lat√™ncia.

[ ] Glow Reativo: Fazer o brilho do Vortex pulsar conforme a frequ√™ncia do √°udio capturado.

Nota  "C√≠cero n√£o √© apenas um chatbot; √© um experimento em fidelidade visual e intera√ß√£o humanizada. O segredo da imers√£o est√° nos micro-movimentos que adicionei."
??? Vis„o Computacional e Banco de Fotos
O mÛdulo Zord-vision conecta o modelo Gemini Flash 2.5 ao pipeline Ûptico para interpretar cenas e responder ‡ pergunta  o que vocÍ est· vendo?. O serviÁo mantÈm uma lista local de rostos detectados, salvando novos registros automaticamente e comparando-os ao banco sempre que um rosto familiar reaparece. Quando a vis„o fica offline ou o modelo n„o È encontrado, o console registra COMANDO DE VIS√O IDENTIFICADO seguido de ERRO DE VIS√O e a interface mostra um aviso persistente avisando sobre o sensor. VocÍ pode inspecionar essa lÛgica dentro de Zord-vision/.

?? Voz e Feedback
A primeira tentativa de TTS usa a API da @elevenlabs via rota /api/tts; caso o token (ELEVENLABS_API_KEY no .env.local) esteja inv·lido ou a chamada retorne 401, o fallback usa o sintetizador nativo do navegador para emular uma voz robÛtica. As callbacks sincronizam jawOpen e expressıes faciais com cada fala, e o comando parar interrompe a reproduÁ„o em andamento.

?? ExperiÍncia de Atendente
O Zord atua como atendente de lanchonete: ao mostrar o card·pio, o painel se desloca para um canto reservado e as respostas geradas pelo Gemini ganham contexto adicional (resumo de ofertas, sugest„o de combos, etc.). O avatar evita conversar consigo mesmo, mantendo o microfone apenas em modo escuta quando o usu·rio fala, e ajusta as sobrancelhas e boca de forma suave para reforÁar naturalidade enquanto o TTS est· ativo.

?? Monitoramento e DiagnÛstico
A integraÁ„o com o socket de vis„o notifica o usu·rio (UI e logs) sempre que a conex„o falha. O hook useVision expıe 	riggerDescription que o frontend chama quando o usu·rio diz descreva o que vocÍ vÍ, e as falhas em sensores Ûpticos aparecem com raz„o e soluÁ„o propostas para acelerar o debug.

?? PrÛximos Ajustes
[ ] Card·pio no canto da tela com animaÁ„o de deslocamento e Gloss·rio de ofertas fixo.
[ ] Avisos visuais para sensores offline, sincronizados ao hook useVision.
[ ] Fluxo de reconhecimento facial com armazenamento de rostos em Zord-vision/faces.

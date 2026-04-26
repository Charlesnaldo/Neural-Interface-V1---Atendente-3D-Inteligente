🤖 Projeto Zord: Atendente 3D Hiper-Realista
Cícero é uma interface de inteligência artificial de próxima geração, focada em uma experiência de usuário imersiva (Immersive UI). Utiliza um modelo 3D com padrão ARKit para expressões faciais em tempo real, integrado a uma estética Noir minimalista.

🚀 Tecnologias Utilizadas
Framework: Next.js 14/15 (App Router)

3D Engine: React Three Fiber & Three.js

Estilização: Tailwind CSS

Animações de UI: Framer Motion

Background Procedural: Simplex Noise (Vortex Effect)

IA de Voz: ElevenLabs API

IA de Texto: OpenAI GPT-4 / Gemini (via API Route)

🎨 Design & Estética: "The Noir Stealth"
O projeto abandonou cores vibrantes em favor de uma paleta de alto contraste:

Fundo: Partículas em escala de cinza (hsla(0, 0%, 100%, alpha)) geradas proceduralmente.

Iluminação: Foco em Rim Lighting (luz de contorno) para destacar a geometria facial sem expor detalhes excessivos.

Interface: HUD minimalista com tipografia monoespaçada e elementos de desfoque de fundo (backdrop-blur).

🧠 Arquitetura Técnica
1. Sistema de Expressão Facial (MorphTargets)
O modelo 3D utiliza o padrão ARKit (52 blendshapes). Implementamos uma lógica de controle manual para ignorar animações pré-gravadas (Actions) e assumir controle via useFrame:

LipSync: Movimentação do jawOpen baseada no estado de áudio.

Micro-expressão: Sorriso fixo simétrico (mouthSmile_L e mouthSmile_R) em 0.4.

Olhar Vivo: Movimentação aleatória sutil sincronizada com o rastreamento do mouse.

Piscada Automática: Algoritmo baseado em seno para piscadas naturais a cada 4 segundos.

2. Otimização de Performance
MeshOptimizer: Decodificação de malha para carregamento ultrarrápido do modelo .glb.

KTX2 Loader: Compressão de texturas de GPU para reduzir o uso de memória VRAM.

Hydration Fix: Implementação de guarda de montagem (mounted state) para evitar conflitos entre SSR e o gerador de ruído aleatório.

🛠️ Instalação e Execução
Clonar o repositório:

Bash
git clone https://github.com/charlesnaldo/meu-atendente-3d.git
Instalar dependências (npm):

Bash
npm install simplex-noise framer-motion clsx tailwind-merge three @types/three @react-three/fiber @react-three/drei meshoptimizer
Configurar Variáveis de Ambiente (.env):

Snippet de código
OPENAI_API_KEY=sua_chave_aqui
ELEVENLABS_API_KEY=sua_chave_aqui
Rodar em modo desenvolvimento:

Bash
npm run dev
📋 Próximos Passos

[ ] Emotion Engine: Alterar os MorphTargets (sobrancelhas/olhos) com base no sentimento detectado no texto da IA.

[ ] Voice-to-Voice: Integração direta com WebSockets para redução de latência.

[ ] Glow Reativo: Fazer o brilho do Vortex pulsar conforme a frequência do áudio capturado.

Nota  "Cícero não é apenas um chatbot; é um experimento em fidelidade visual e interação humanizada. O segredo da imersão está nos micro-movimentos que adicionei."

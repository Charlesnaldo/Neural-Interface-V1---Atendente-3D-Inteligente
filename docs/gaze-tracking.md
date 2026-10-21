# Direção do olhar pela câmera

O visitante pode ativar a câmera sem conta. O mesmo fluxo de permissão já usado pelo rastreamento de rostos alimenta uma análise local de pontos das íris. Não há pedido de microfone, login ou calibração obrigatória para esta função.

O MediaPipe Face Landmarker roda em um Web Worker, em até dez quadros por segundo, com apenas uma análise em andamento. SDK, WASM e modelo são servidos pelo próprio site. Os pontos oculares e a direção estimada não são enviados à API nem salvos no banco. O rastreamento de rostos já existente continua enviando seus próprios quadros ao serviço de visão do Zord; o salvamento opcional de fotos continua exigindo autorização separada.

O avatar move os olhos conforme a posição das íris em relação aos cantos de cada olho. A cabeça continua usando a posição do rosto. A direção é relativa à imagem da câmera, sem espelhamento, e não representa um ponto preciso da tela. Luz, óculos, inclinação e diferenças individuais afetam a leitura.

Sem rosto, com olhos fechados ou com mais de um rosto detectado, não há direção ocular válida. Ao desligar a câmera, o worker é encerrado e o avatar volta ao comportamento normal. Após o salvamento autorizado de uma foto, a câmera também é desligada conforme o fluxo existente.

`npm run dev` e `npm run build` preparam os arquivos de `@mediapipe/tasks-vision@1.1.1` em `public/mediapipe`, que é gerado e ignorado pelo Git. O modelo oficial `face_landmarker.task` está versionado em `public/models` e veio de https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task.

Verificação: `node --test tests/gaze.test.cjs tests/face-animation.test.cjs`, lint e build. O teste de navegador também inicializa o modelo real e processa um quadro sintético sem rosto, sem abrir câmera física.

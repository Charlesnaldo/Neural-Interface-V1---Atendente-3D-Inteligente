# Movimento do avatar

O arquivo `public/models/facecap.glb` contém 52 controles de deformação facial. Todos recebem uma animação ou um retorno explícito ao repouso; os clipes originais de captura permanecem desativados para não competir com a conversa.

- Neutro: sorriso discreto, mandíbula relaxada, respiração e pequenos ajustes de postura.
- Sorriso: cantos da boca e bochechas coordenados; intensidade reduzida durante a articulação dos lábios.
- Tristeza: sobrancelhas internas e cantos da boca moderados, sem careta intensa.
- Escuta: olhar mais estável, atenção nas sobrancelhas e inclinação leve.
- Espera pela resposta: desvio discreto do olhar, sem círculos repetitivos dos olhos.
- Fala: vogais abertas, arredondamento, alongamento e fechamento labial; pausas permitem relaxar a mandíbula. Gestos da cabeça acompanham a energia estimada da fala.

As transições usam o tempo entre quadros para manter a duração em diferentes telas. O estado facial avança uma vez por quadro e é distribuído às malhas do modelo. Os pesos ficam limitados entre zero e um. Piscadas duram aproximadamente 180 ms, com fechamento mais rápido que a reabertura.

A voz atual usa `speechSynthesis`: os movimentos labiais são aproximados a partir do texto e dos eventos disponíveis no navegador. Não são sincronização por fonemas com marcações de tempo de um serviço de voz.

Verificação: `node --test tests/face-animation.test.cjs`. O teste lê os nomes do próprio GLB, executa o controlador em 30, 60 e 144 FPS, confere pesos, expressões, fechamento labial, repouso e consistência entre malhas. A simulação não substitui a avaliação visual de qualidade.

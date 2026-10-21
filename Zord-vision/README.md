# Zord Vision

## Banco de rostos com Supabase

Com `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` configurados, o serviço usa Postgres
e Storage privado, validando o JWT de cada conexão. Também lê as variáveis
`NEXT_PUBLIC_SUPABASE_*` da `.env.local` do projeto para desenvolvimento.
As fotos e vetores são isolados por usuário; não configure chave service-role.

Sem essas variáveis, SQLite permanece disponível somente para uso local.
Deploys na Vercel recusam iniciar sem Supabase configurado.

Na interface, abra **Rostos → Acionar câmera**. Informe um nome e clique em
**Fotografar** com apenas uma pessoa no enquadramento. O painel permite renomear
e excluir registros. No modo legado, o SQLite fica em `data/faces.sqlite3`.
Com Supabase, fotos ficam no bucket privado `zord-faces`; nomes e vetores ficam
na tabela `zord_faces`, com acesso restrito ao dono da conta.

Para reconhecimento sem dlib no Windows, instale os modelos oficiais do OpenCV:

```powershell
.\venv\Scripts\python.exe download_face_models.py
```

O serviço usa YuNet + SFace quando `face_recognition` não está disponível. Os
modelos vêm de https://github.com/opencv/opencv_zoo e ficam em `models/`.
Reinicie o serviço após baixar. O cadastro e reconhecimento funcionam sem chave
Gemini; `GOOGLE_API_KEY` é necessária somente para descrições de imagens.

Com a câmera ligada, a comparação ocorre a cada cinco segundos. Ative
**Registrar rostos vistos automaticamente** para também salvar desconhecidos;
eles recebem nomes de visitante e podem ser renomeados. A captura automática
ignora cenas sem rosto ou com várias pessoas. Limite: 100 registros.

Fotos e vetores ficam no Supabase quando configurado, sem envio ao Gemini para
reconhecimento. Descrever uma cena continua enviando a imagem ao Gemini.
Reconhecimento não serve como autenticação. Mudanças de motor exigem recadastro
das fotos para comparação, pois os vetores de motores diferentes não se misturam.

Origens WebSocket permitidas: `http://localhost:3000` e `http://127.0.0.1:3000`.
Configure `VISION_ALLOWED_ORIGINS` com uma lista separada por vírgulas se necessário.
Execute em `127.0.0.1` para uso pessoal local; o banco não deve ser exposto à internet.

Testes: `python -m unittest test_face_store.py`.

O endpoint `/health` informa se reconhecimento e Supabase estão ativos.
O WebSocket `/ws/vision` recebe frames base64 e oferece descrições com Gemini 2.5 Flash.
Em produção, a primeira mensagem deve autenticar uma sessão válida do Supabase.

## Setup

1. **Crie o ambiente virtual**  
   ```bash
   python -m venv venv
   ```
2. **Ative e instale dependências**  
   - Windows: `venv\\Scripts\\activate`  
   - macOS/Linux: `source venv/bin/activate`  
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure a chave do Gemini**  
   Copie `.env.example` para `.env` e coloq ue o valor real de `GOOGLE_API_KEY`.

4. **Execute o serviço**  
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Fluxo
- Recebe frames com `DESCRIBE:` → decodifica, envia para o Gemini e retorna trecho com a descrição.  
- Recebe frames comuns → usa MediaPipe para tracking e envia `x`, `y` para o front-end.

## Notes
- O `TF_CPP_MIN_LOG_LEVEL` está definido para suprimir avisos do TensorFlow.  
- Se quiser adicionar detecção extra (ex.: `yolov8n.pt`), atualize o `requirements` e o código para carregar esse modelo.

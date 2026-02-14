# Zord Vision

Esse microserviço expõe um endpoint WebSocket (`/ws/vision`) que recebe frames base64 e responde com tracking facial + descrições geradas pelo Gemini 1.5 Flash.

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

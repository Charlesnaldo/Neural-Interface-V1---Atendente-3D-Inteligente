# Zord

Zord is a 3D AI assistant built with Next.js, React Three Fiber, and voice/vision hooks.

## Stack
- Next.js App Router
- React Three Fiber / Three.js
- Tailwind CSS
- Voice synthesis and speech-to-text
- Vision pipeline in `Zord-vision/`

## Local development
```bash
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd run dev` if script execution is disabled.
In a second terminal, start vision using the existing virtual environment:

```powershell
cd Zord-vision
.\venv\Scripts\python.exe -u -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Open http://localhost:3000 after both services are ready and allow camera and
microphone access when needed. Reload the page after restarting vision.

## Environment
Set the required API keys in your `.env.local` file.
Chat requires `GROQ_API_KEY`; `GROQ_MODEL` optionally overrides the default
`openai/gpt-oss-20b`. Vision requires `GOOGLE_API_KEY` in `Zord-vision/.env`.

## Notes
- The UI focuses on fluid conversation and live facial animation.
- The vision module lives under `Zord-vision/`.
- VoiceStudio is installed locally and is not yet connected to the application's
  voice hook. After installing it under `.local/VoiceStudioApp`, Windows users can
  launch it with `.local/start-voicestudio.cmd` to use the CPU runtime.
- Localhost services are not hosted by the Vercel frontend deployment. Set
  `NEXT_PUBLIC_VISION_WS_URL` to a reachable secure WebSocket service for production
  vision; keep provider keys in server-side environment variables.

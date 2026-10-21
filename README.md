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
- Open **Meu assistente** to review conversations, memories and tasks. Data is
  stored in your Supabase account (up to 100 entries per category), shared across devices after reload.
  Memories and pending tasks are included in requests to the chat provider.
- Say or type `lembre que prefiro respostas curtas` to save a memory, or
  `crie uma tarefa: revisar meu projeto` to create a task. Tasks are checklists,
  not scheduled alarms. You can also add and delete items in the panel.
- The camera starts disabled; enable it in the assistant panel when needed.
  Click the microphone again to stop continuous listening. The panel also has
  microphone, sign-out and account-data deletion controls.
- The UI focuses on fluid conversation and live facial animation.
- The vision module lives under `Zord-vision/`.
- VoiceStudio is installed locally and is not yet connected to the application's
  voice hook. After installing it under `.local/VoiceStudioApp`, Windows users can
  launch it with `.local/start-voicestudio.cmd` to use the CPU runtime.
- `vercel.json` deploys Next.js and Python vision together as Vercel Services.
  Online vision uses the same-origin `/ws/vision` endpoint; localhost uses port 8000.
  Facial models are downloaded during the vision build and included in its function.

## Supabase and authentication

The homepage is public: visitors can chat and enable live tracking without accounts.
Their conversations stay in page memory and tracking does not save photos or identify
people. All detected faces get temporary numbers and boxes; these are not identities.
The application does not search the internet to identify people from face photos.

Administration is at `/admin`, with login at `/login`. Set server-only `ADMIN_EMAILS`
to the authorized administrator email. The admin account must confirm its email.
Public signup through the application is restricted to that configured email.
Visitor camera permission is independent of any consent to save a photograph.

Project: **Zord**, ref `ycibrrmtcgxytjnydveh` (São Paulo). Fill `.env.local` using
`.env.example` and the publishable key from the Supabase Connect dialog. Never put
secret/service-role keys in `NEXT_PUBLIC_*` variables. Login is at `/login`.
Email/password signup uses Supabase's email confirmation flow.

Tables: `zord_assistant_state` (history, memories, tasks and revision) and
`zord_faces` (name, template, photo path and dates). RLS restricts rows to
`auth.uid()`. JPEGs live in the private `zord-faces` bucket under `user_id/id.jpg`.
Temporary photo links are signed using the user's JWT; no service-role key is used.

Import old browser notes explicitly through **Meu assistente** when the cloud
account is empty. Conflicting writes from another device are rejected; reload
before continuing. Wait for **Sincronizado** before closing the page.

Python reads `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`, falling back to equivalent
`NEXT_PUBLIC_` variables in `.env.local` locally. Each WebSocket authenticates with
the user's JWT as its first message. Browser code handles authentication and reconnects.

Before production, configure **Authentication → URL Configuration → Site URL** in
Supabase to the production domain. Preview access requires Vercel Authentication;
application login is a separate layer. Camera access requires HTTPS or localhost.

Checks: `npm run lint`, `npm run build`, and, from `Zord-vision`,
`venv\\Scripts\\python.exe -m unittest test_face_store.py test_face_vision.py`.

Visitor photos: voluntary preview and explicit consent, private administrator
gallery at `/admin/photos`, and browser-held deletion receipts. Camera permission
does not automatically save photos. See [the photo flow](docs/visitor-photos.md).

Camera gaze: visitors can enable eye-direction tracking without an account.
Iris landmarks are processed locally in a worker and drive the avatar's eyes;
this is an approximate direction, not calibrated screen tracking.
See [gaze tracking](docs/gaze-tracking.md).

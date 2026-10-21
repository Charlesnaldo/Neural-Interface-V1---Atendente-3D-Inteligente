import base64
import os
import json
import time
import asyncio
from contextvars import ContextVar
from pathlib import Path

import cv2
try:
    import mediapipe as mp
except ImportError:
    mp = None
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from face_store import FaceStore
from cloud_face_store import CloudFaceStore

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ModuleNotFoundError:
    face_recognition = None
    FACE_RECOGNITION_AVAILABLE = False

FACE_BACKEND = 'dlib'
if not FACE_RECOGNITION_AVAILABLE:
    try:
        from face_engine import OpenCVFaces
        face_recognition = OpenCVFaces()
        FACE_RECOGNITION_AVAILABLE = True
        FACE_BACKEND = 'sface'
    except (cv2.error, OSError):
        pass

# --- CONFIGURAÇÃO ---
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / '.env.local')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

face_detector = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) if mp else None

KNOWN_FACES_DIR = Path(__file__).resolve().parent / 'known_faces'
FACE_MATCH_THRESHOLD = 0.45 if FACE_BACKEND == 'dlib' else 0.9
known_faces = []
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_PUBLISHABLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '')
CLOUD_VISION = bool(SUPABASE_URL)
if os.getenv('VERCEL') and not (SUPABASE_URL and SUPABASE_KEY):
    raise RuntimeError('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY antes de publicar a visão.')
store_context = ContextVar('face_registry', default=None if CLOUD_VISION else FaceStore(Path(__file__).resolve().parent / 'data' / 'faces.sqlite3'))


class RegistryProxy:
    def __getattr__(self, name):
        registry = store_context.get()
        if registry is None:
            raise PermissionError('Autenticação necessária.')
        return getattr(registry, name)


face_store = RegistryProxy()


@app.get('/health')
def health():
    return {'ok': True, 'recognition': FACE_RECOGNITION_AVAILABLE, 'cloud': CLOUD_VISION}


def stored_encoding(row):
    if not row['encoding']:
        return None
    value = json.loads(row['encoding'])
    if isinstance(value, dict) and value.get('backend') == FACE_BACKEND:
        return np.array(value['vector'])
    return None


def face_gallery():
    return {
        'type': 'faces', 'recognitionAvailable': FACE_RECOGNITION_AVAILABLE,
        'faces': [{k: row[k] for k in ('id', 'name', 'created_at', 'last_seen')} |
                  {'photo': face_store.photo_url(row) if 'photo_path' in row else 'data:image/jpeg;base64,' + base64.b64encode(row['photo']).decode()}
                  for row in face_store.list()]
    }


def observe_face(data, automatic=False, name='', save_unknown=True):
    if len(data) > 2_000_000:
        raise ValueError('Imagem muito grande.')
    image_bytes = base64.b64decode(data.split(',', 1)[-1], validate=True)
    frame = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if frame is None or frame.shape[0] > 2000 or frame.shape[1] > 2000:
        raise ValueError('Imagem inválida.')
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    if FACE_RECOGNITION_AVAILABLE:
        boxes = face_recognition.face_locations(rgb)
    else:
        if face_detector is None:
            raise ValueError('Modelos de reconhecimento indisponíveis no serviço de visão.')
        result = face_detector.process(rgb)
        boxes = []
        for detection in result.detections or []:
            box = detection.location_data.relative_bounding_box
            h, w = frame.shape[:2]
            boxes.append((int(box.ymin*h), int((box.xmin+box.width)*w), int((box.ymin+box.height)*h), int(box.xmin*w)))
    if len(boxes) != 1:
        if automatic:
            return None
        raise ValueError('Posicione apenas um rosto de frente para a câmera.')
    encodings = face_recognition.face_encodings(rgb, boxes) if FACE_RECOGNITION_AVAILABLE else []
    encoding = encodings[0] if encodings else None
    if automatic and encoding is None:
        raise ValueError('Captura automática exige face_recognition instalado e um rosto visível.')
    if encoding is not None:
        rows = [row for row in face_store.list() if stored_encoding(row) is not None]
        if rows:
            distances = face_recognition.face_distance([stored_encoding(row) for row in rows], encoding)
            index = int(np.argmin(distances))
            if distances[index] <= FACE_MATCH_THRESHOLD:
                row = rows[index]
                face_store.seen(row['id'])
                if name.strip():
                    face_store.rename(row['id'], name)
                return name.strip() or row['name']
    if automatic and not save_unknown:
        return None
    top, right, bottom, left = boxes[0]
    h, w = frame.shape[:2]
    crop = frame[max(0, top-20):min(h, bottom+20), max(0, left-20):min(w, right+20)]
    if not crop.size:
        raise ValueError('Rosto fora do enquadramento.')
    crop = cv2.resize(crop, (200, 200))
    ok, photo = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise ValueError('Não foi possível salvar a foto.')
    template = {'backend': FACE_BACKEND, 'vector': encoding.tolist()} if encoding is not None else None
    face_id = face_store.save(photo.tobytes(), template, name)
    return name.strip() or f'Visitante {face_id[:6]}'

def load_known_faces():
    if CLOUD_VISION:
        return
    if not FACE_RECOGNITION_AVAILABLE:
        print(">>> ZORD: face_recognition indisponivel. Reconhecimento facial desativado.")
        return
    if not KNOWN_FACES_DIR.exists():
        return
    for image_path in KNOWN_FACES_DIR.glob('*'):
        if image_path.is_file() and image_path.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
            try:
                image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(image)
            except (ValueError, cv2.error):
                continue
            if encodings:
                known_faces.append({
                    'name': image_path.stem.replace('_', ' '),
                    'encoding': encodings[0]
                })

def recognize_face(image: np.ndarray):
    if not FACE_RECOGNITION_AVAILABLE:
        return None
    registered = [{'name': row['name'], 'encoding': stored_encoding(row)}
                  for row in face_store.list() if stored_encoding(row) is not None]
    candidates = known_faces + registered
    if not candidates:
        return None
    encodings = face_recognition.face_encodings(image)
    if not encodings:
        return None
    distances = face_recognition.face_distance(
        [entry['encoding'] for entry in candidates],
        encodings[0]
    )
    best_idx = np.argmin(distances)
    if distances[best_idx] <= FACE_MATCH_THRESHOLD:
        return candidates[best_idx]['name']
    return None

load_known_faces()

def get_face_coordinates(image):
    try:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        if face_detector is None:
            boxes = face_recognition.face_locations(image_rgb) if FACE_RECOGNITION_AVAILABLE else []
            if boxes:
                top, right, bottom, left = boxes[0]
                return (left+right)/(2*image.shape[1]), (top+bottom)/(2*image.shape[0])
            return None, None
        results = face_detector.process(image_rgb)
        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                return bbox.xmin + (bbox.width / 2), bbox.ymin + (bbox.height / 2)
    except: pass
    return None, None

async def analyze_with_gemini(data_from_socket):
    try:
        if client is None:
            return 'Configure GOOGLE_API_KEY para descrever imagens. O cadastro de rostos funciona localmente.', None
        # 1. Extração pura do Base64
        # Remove o comando DESCRIBE: e qualquer espaço em branco
        b64_cleaned = data_from_socket.replace("DESCRIBE:", "").strip()
        
        # Remove o cabeçalho 'data:image/jpeg;base64,' se o Next.js enviou
        if "base64," in b64_cleaned:
            b64_cleaned = b64_cleaned.split("base64,")[1]

        # 2. Conversão para bytes
        image_bytes = base64.b64decode(b64_cleaned)
            
        # 3. Envio para o Gemini 2.5 Flash
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text="Relate o que vê. Seja curto e robótico."),
                        types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                    ]
                )
            ]
        )
        
        texto_ia = response.text
        print(f">>> ZORD VIU: {texto_ia}") # Log para você ver no terminal
        raw_img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        recognized = None
        if raw_img is not None:
            rgb = cv2.cvtColor(raw_img, cv2.COLOR_BGR2RGB)
            recognized = recognize_face(rgb)
        return texto_ia, recognized

    except Exception as e:
        print(f"ERRO DE VISÃO: {e}")
        return "Falha no sensor óptico. Tente novamente.", None

@app.websocket("/ws/vision")
async def websocket_endpoint(websocket: WebSocket):
    origin = websocket.headers.get('origin', '')
    allowed = os.getenv('VISION_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',')
    allowed += ['https://' + os.environ[key] for key in ('VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL') if os.getenv(key)]
    if origin and origin not in [value.strip() for value in allowed]:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    context_token = None
    if CLOUD_VISION:
        try:
            first = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=10))
            token = first.get('token', '')
            if first.get('action') != 'authenticate' or not isinstance(token, str) or not 1 <= len(token) <= 8192:
                raise ValueError('Autenticação necessária.')
            registry = CloudFaceStore(SUPABASE_URL, SUPABASE_KEY, token)
            context_token = store_context.set(registry)
            await websocket.send_json({'type': 'authenticated'})
        except (ValueError, PermissionError, KeyError, TypeError, AttributeError, asyncio.TimeoutError, WebSocketDisconnect):
            await websocket.close(code=1008)
            return
    last_observation = 0
    print(">>> ZORD: SISTEMAS ONLINE. AGUARDANDO COMANDOS.")
    
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 2_100_000:
                await websocket.send_json({'type': 'face_error', 'error': 'Mensagem muito grande.'})
                continue

            if data.startswith('{'):
                try:
                    command = json.loads(data)
                    action = command.get('action')
                    if action == 'list_faces':
                        await websocket.send_json(face_gallery())
                    elif action in ('capture_face', 'observe_face'):
                        automatic = action == 'observe_face'
                        if automatic and time.monotonic() - last_observation < 4:
                            continue
                        last_observation = time.monotonic()
                        name = command.get('name', '')
                        if not isinstance(name, str) or len(name) > 80:
                            raise ValueError('Nome inválido.')
                        recognized = observe_face(command.get('image', ''), automatic, name, command.get('register') is True)
                        await websocket.send_json({'type': 'face_result', 'recognized': recognized})
                        await websocket.send_json(face_gallery())
                    elif action == 'delete_face':
                        face_store.delete(str(command.get('id', '')))
                        await websocket.send_json(face_gallery())
                    elif action == 'rename_face':
                        face_store.rename(str(command.get('id', '')), command.get('name'))
                        await websocket.send_json(face_gallery())
                except (ValueError, TypeError, AttributeError, cv2.error) as error:
                    await websocket.send_json({'type': 'face_error', 'error': str(error)})
                continue

            # 1. TESTE DE COMANDO DE VISÃO (DESCRIÇÃO)
            # Usamos "in" em vez de "startswith" para ser mais flexível
            if "DESCRIBE:" in data:
                print(">>> ZORD: COMANDO DE VISÃO IDENTIFICADO!")
                # Limpamos a string para pegar apenas o que interessa
                image_data = data.split("DESCRIBE:")[1] 
                
                # Chama a IA
                result = await analyze_with_gemini(image_data)
                description, recognized = result if isinstance(result, tuple) else (result, None)
                
                # Envia a resposta
                await websocket.send_json({
                    "type": "description", 
                    "text": description,
                    "recognized": recognized
                })
                print(f">>> ZORD RESPONDEU: {description} - Reconhecido: {recognized}")

            
            else:
                try:
                    # Se não for comando de voz, tenta processar como frame de rastreio
                    encoded = data.split(",", 1)[1] if "," in data else data
                    image_bytes = base64.b64decode(encoded)
                    nparr = np.frombuffer(image_bytes, np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                    if frame is not None:
                        x, y = get_face_coordinates(frame)
                        if x is not None:
                            await websocket.send_json({
                                "type": "tracking", 
                                "x": x, 
                                "y": y, 
                                "detected": True
                            })
                except:
                    # Ignora mensagens malformadas que não sejam de rastreio
                    pass

    except PermissionError:
        await websocket.send_json({'type': 'face_error', 'error': 'Sessão expirada. Reconectando…'})
        await websocket.close(code=4001)
    except WebSocketDisconnect:
        print(">>> ZORD: CONEXÃO ENCERRADA.")
    finally:
        if context_token is not None:
            store_context.reset(context_token)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

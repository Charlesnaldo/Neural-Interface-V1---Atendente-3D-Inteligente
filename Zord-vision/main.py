import base64
import os
from pathlib import Path

import cv2
import face_recognition
import mediapipe as mp
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

# --- CONFIGURAÇÃO ---
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    raise RuntimeError("Defina GOOGLE_API_KEY no Zord-vision/.env.")

client = genai.Client(api_key=GOOGLE_API_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

face_detector = mp.solutions.face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)

KNOWN_FACES_DIR = Path(__file__).resolve().parent / 'known_faces'
FACE_MATCH_THRESHOLD = 0.45
known_faces = []

def load_known_faces():
    if not KNOWN_FACES_DIR.exists():
        return
    for image_path in KNOWN_FACES_DIR.glob('*'):
        if image_path.is_file():
            image = face_recognition.load_image_file(image_path)
            encodings = face_recognition.face_encodings(image)
            if encodings:
                known_faces.append({
                    'name': image_path.stem.replace('_', ' '),
                    'encoding': encodings[0]
                })

def recognize_face(image: np.ndarray):
    if not known_faces:
        return None
    encodings = face_recognition.face_encodings(image)
    if not encodings:
        return None
    distances = face_recognition.face_distance(
        [entry['encoding'] for entry in known_faces],
        encodings[0]
    )
    best_idx = np.argmin(distances)
    if distances[best_idx] <= FACE_MATCH_THRESHOLD:
        return known_faces[best_idx]['name']
    return None

load_known_faces()

def get_face_coordinates(image):
    try:
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_detector.process(image_rgb)
        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                return bbox.xmin + (bbox.width / 2), bbox.ymin + (bbox.height / 2)
    except: pass
    return None, None

async def analyze_with_gemini(data_from_socket):
    try:
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
    await websocket.accept()
    print(">>> ZORD: SISTEMAS ONLINE. AGUARDANDO COMANDOS.")
    
    try:
        while True:
            data = await websocket.receive_text()

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

    except WebSocketDisconnect:
        print(">>> ZORD: CONEXÃO ENCERRADA.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

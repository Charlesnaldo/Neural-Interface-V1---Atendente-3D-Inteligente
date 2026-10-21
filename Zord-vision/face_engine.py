"""OpenCV SFace adapter for local recognition without dlib."""
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent / 'models'


class OpenCVFaces:
    def __init__(self):
        self.detector = cv2.FaceDetectorYN.create(str(ROOT / 'face_detection_yunet_2023mar.onnx'), '', (320, 320), 0.9)
        self.recognizer = cv2.FaceRecognizerSF.create(str(ROOT / 'face_recognition_sface_2021dec.onnx'), '')

    def detect(self, rgb):
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        self.detector.setInputSize((bgr.shape[1], bgr.shape[0]))
        _, faces = self.detector.detect(bgr)
        return bgr, faces if faces is not None else []

    def face_locations(self, rgb):
        _, faces = self.detect(rgb)
        return [(int(face[1]), int(face[0]+face[2]), int(face[1]+face[3]), int(face[0])) for face in faces]

    def face_encodings(self, rgb, boxes=None):
        bgr, faces = self.detect(rgb)
        encodings = []
        for face in faces:
            aligned = self.recognizer.alignCrop(bgr, face)
            vector = self.recognizer.feature(aligned).flatten()
            encodings.append(vector / max(float(np.linalg.norm(vector)), 1e-10))
        return encodings

    @staticmethod
    def face_distance(known, encoding):
        return np.linalg.norm(np.asarray(known) - encoding, axis=1)

    @staticmethod
    def load_image_file(path):
        image = cv2.imread(str(path))
        if image is None:
            raise ValueError('Foto inválida.')
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

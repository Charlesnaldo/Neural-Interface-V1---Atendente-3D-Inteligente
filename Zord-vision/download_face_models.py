"""Download official OpenCV Zoo models for OpenCV 4.x."""
from pathlib import Path
from urllib.request import urlretrieve

root = Path(__file__).resolve().parent / 'models'
root.mkdir(exist_ok=True)
for folder, name in (
    ('face_detection_yunet', 'face_detection_yunet_2023mar.onnx'),
    ('face_recognition_sface', 'face_recognition_sface_2021dec.onnx'),
):
    target = root / name
    if target.exists():
        continue
    partial = target.with_suffix('.part')
    urlretrieve(f'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/{folder}/{name}', partial)
    partial.replace(target)
    print(f'Downloaded {name}: {target.stat().st_size} bytes')

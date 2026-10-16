"""Shared image loading and single-face detection for the image examples."""
from pathlib import Path
import cv2
import numpy as np


def read_bgr(path):
    image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Cannot read image: {path}")
    return image


def create_detector(model):
    if not Path(model).is_file():
        raise FileNotFoundError(model)
    return cv2.FaceDetectorYN.create(str(model), "", (320, 320), 0.9, 0.3, 5000)


def single_face(detector, image):
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    count = 0 if faces is None else len(faces)
    if count != 1:
        raise ValueError(f"Expected one face above detection threshold, got {count}")
    if not np.isfinite(faces[0]).all():
        raise ValueError("Invalid face detection")
    return faces[0].copy()

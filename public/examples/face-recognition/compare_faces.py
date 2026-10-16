"""Compare two local images using YuNet detection and SFace embeddings."""
import argparse
import json
from pathlib import Path
import cv2
from algorithms import cosine_distance
from face_io import read_bgr, create_detector, single_face


def represent(image, detector, recognizer):
    face = single_face(detector, image)
    aligned = recognizer.alignCrop(image, face)
    # Copy because some inference APIs reuse internal output storage.
    return recognizer.feature(aligned).copy().reshape(-1)


def compare(first, second, detector, recognizer, threshold):
    if not -1 <= threshold <= 1:
        raise ValueError("Cosine similarity threshold must be in [-1, 1]")
    a = represent(first, detector, recognizer)
    b = represent(second, detector, recognizer)
    distance = cosine_distance(a.tolist(), b.tolist())
    similarity = 1 - distance
    return {"similarity": similarity, "distance": distance,
            "threshold": threshold, "same_person": similarity >= threshold,
            "feature_dimensions": int(a.size)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first")
    parser.add_argument("second")
    parser.add_argument("--detector", required=True, help="YuNet ONNX path")
    parser.add_argument("--recognizer", required=True, help="SFace ONNX path")
    parser.add_argument("--threshold", required=True, type=float,
                        help="Cosine SIMILARITY cutoff, not distance")
    args = parser.parse_args()
    if not Path(args.recognizer).is_file():
        raise FileNotFoundError(args.recognizer)
    detector = create_detector(args.detector)
    recognizer = cv2.FaceRecognizerSF.create(args.recognizer, "")
    result = compare(read_bgr(args.first), read_bgr(args.second),
                     detector, recognizer, args.threshold)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

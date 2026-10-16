"""Single-image PAD with one official MiniFASNetV2 checkpoint; CPU only."""
import argparse
import importlib.util
import json
from pathlib import Path
import cv2
import numpy as np
import torch
from face_io import read_bgr, create_detector, single_face

WEIGHT_NAME = "2.7_80x80_MiniFASNetV2.pth"


def load_source(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare_tensor(patch):
    if patch.shape != (80, 80, 3) or patch.dtype != np.uint8:
        raise ValueError("Expected an 80x80 uint8 BGR patch")
    # Match upstream functional.to_tensor(ndarray): NO /255 and NO RGB swap.
    array = np.ascontiguousarray(patch.transpose(2, 0, 1))
    return torch.from_numpy(array).float().unsqueeze(0)


def infer(image, face, model, cropper, threshold):
    if not 0 <= threshold <= 1:
        raise ValueError("Live-score threshold must be in [0, 1]")
    height, width = image.shape[:2]
    x, y, w, h = map(float, face[:4])
    # Intersect a partially out-of-image detection before invoking CropImage.
    x0, y0 = max(0, int(x)), max(0, int(y))
    x1, y1 = min(width, int(np.ceil(x + w))), min(height, int(np.ceil(y + h)))
    if x1 <= x0 or y1 <= y0:
        raise ValueError("Face box has no area inside the image")
    patch = cropper.crop(org_img=image, bbox=[x0, y0, x1-x0, y1-y0],
                         scale=2.7, out_w=80, out_h=80, crop=True)
    with torch.inference_mode():
        logits = model(prepare_tensor(patch))
        if tuple(logits.shape) != (1, 3) or not torch.isfinite(logits).all():
            raise ValueError("Expected three finite class logits")
        scores = torch.softmax(logits, dim=1)[0].tolist()
    return {"class_scores": scores, "live_score": scores[1],
            "argmax_class": int(np.argmax(scores)), "threshold": threshold,
            "is_live": scores[1] >= threshold}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    parser.add_argument("--detector", required=True, help="YuNet ONNX path")
    parser.add_argument("--repo", required=True, help="Pinned Silent-Face repository")
    parser.add_argument("--weights", required=True, help=WEIGHT_NAME)
    parser.add_argument("--threshold", required=True, type=float)
    args = parser.parse_args()
    weight = Path(args.weights)
    if weight.name != WEIGHT_NAME:
        raise ValueError(f"This example only supports {WEIGHT_NAME}")
    repo = Path(args.repo)
    architecture = load_source(repo / "src/model_lib/MiniFASNet.py", "tutorial_minifas")
    crop_module = load_source(repo / "src/generate_patches.py", "tutorial_crop")
    model = architecture.MiniFASNetV2(conv6_kernel=(5, 5))
    # Only use trusted upstream checkpoints. Do not load arbitrary pickle files.
    state = torch.load(weight, map_location="cpu", weights_only=True)
    state = {k.removeprefix("module."): v for k, v in state.items()}
    model.load_state_dict(state, strict=True)
    model.eval()
    image = read_bgr(args.image)
    face = single_face(create_detector(args.detector), image)
    print(json.dumps(infer(image, face, model, crop_module.CropImage(),
                           args.threshold), indent=2))


if __name__ == "__main__":
    main()

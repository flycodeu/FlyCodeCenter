"""Local geometry viewer. No identity model, no PAD, no images saved/uploaded."""
import argparse
import time
import cv2
import mediapipe as mp
from algorithms import mouth_ratio, yaw_degrees


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="local face_landmarker.task path")
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=args.model),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_faces=2, output_face_blendshapes=True,
        output_facial_transformation_matrixes=True)
    capture = cv2.VideoCapture(args.camera)
    try:
        if not capture.isOpened():
            raise RuntimeError("Cannot open camera; check permissions and camera index")
        started, previous_ms = time.monotonic(), -1
        with mp.tasks.vision.FaceLandmarker.create_from_options(options) as landmarker:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                timestamp = max(previous_ms + 1, int((time.monotonic() - started) * 1000))
                previous_ms = timestamp
                result = landmarker.detect_for_video(
                    mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)),
                    timestamp)
                text = "Keep exactly one face visible"
                if len(result.face_landmarks) == 1:
                    points = result.face_landmarks[0]
                    height, width = frame.shape[:2]
                    xy = [(p.x * width, p.y * height) for p in points]
                    yaw = yaw_degrees(result.facial_transformation_matrixes[0])
                    ratio = mouth_ratio(*(xy[i] for i in [13, 14, 61, 291]))
                    shapes = {s.category_name: s.score for s in result.face_blendshapes[0]}
                    text = f"yaw={yaw:+.1f} mouth={ratio:.2f} jaw={shapes.get('jawOpen', 0):.2f}"
                # Flip DISPLAY only. Analysis always uses original camera direction.
                preview = cv2.flip(frame, 1)
                cv2.putText(preview, text, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, .65, (50, 240, 80), 2)
                cv2.putText(preview, "GEOMETRY ONLY - NOT LIVENESS. Q: quit", (15, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, .55, (80, 180, 255), 1)
                cv2.imshow("Face geometry", preview)
                if cv2.waitKey(1) & 0xFF in (ord('q'), 27):
                    break
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

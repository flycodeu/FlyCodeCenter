"""Tests preprocessing/decision mechanics, not recognition or PAD accuracy."""
import unittest
import numpy as np
import torch
from compare_faces import compare
from face_io import single_face
from single_image_pad import prepare_tensor, infer


class Detector:
    def __init__(self, faces):
        self.faces = faces

    def setInputSize(self, size):
        self.size = size

    def detect(self, image):
        return None, self.faces


class FixedModel(torch.nn.Module):
    def forward(self, x):
        return torch.tensor([[0., 1., 0.]])


class Cropper:
    def crop(self, **kwargs):
        self.kwargs = kwargs
        return np.zeros((80, 80, 3), dtype=np.uint8)


class ImagePipelineTest(unittest.TestCase):
    def test_bgr_range_and_shape(self):
        patch = np.zeros((80, 80, 3), dtype=np.uint8)
        patch[:] = [10, 100, 250]
        x = prepare_tensor(patch)
        self.assertEqual(tuple(x.shape), (1, 3, 80, 80))
        self.assertEqual(x.dtype, torch.float32)
        self.assertEqual(x[0, :, 0, 0].tolist(), [10, 100, 250])

    def test_bad_patch(self):
        for patch in [np.zeros((80, 80, 3)), np.zeros((3, 80, 80), np.uint8)]:
            with self.assertRaises(ValueError):
                prepare_tensor(patch)

    def test_single_face_required(self):
        image = np.zeros((200, 300, 3), np.uint8)
        for faces in [None, np.empty((0, 15)), np.zeros((2, 15))]:
            with self.assertRaises(ValueError):
                single_face(Detector(faces), image)
        detector = Detector(np.ones((1, 15)))
        self.assertEqual(len(single_face(detector, image)), 15)
        self.assertEqual(detector.size, (300, 200))

    def test_pad_threshold_and_clipped_box(self):
        image = np.zeros((200, 300, 3), np.uint8)
        cropper = Cropper()
        result = infer(image, [-10, 20, 100, 100], FixedModel(), cropper, .8)
        self.assertEqual(cropper.kwargs["bbox"], [0, 20, 90, 100])
        self.assertEqual(result["argmax_class"], 1)
        self.assertFalse(result["is_live"])  # Argmax live does not imply >= .8.
        self.assertAlmostEqual(result["live_score"], .5761169, places=6)

    def test_invalid_threshold_and_output(self):
        image = np.zeros((200, 300, 3), np.uint8)
        for threshold in [-1, 2, float("nan")]:
            with self.assertRaises(ValueError):
                infer(image, [10, 10, 100, 100], FixedModel(), Cropper(), threshold)
            with self.assertRaises(ValueError):
                compare(image, image, None, None, threshold * 2)
        class BadModel(torch.nn.Module):
            def forward(self, x):
                return torch.tensor([[float("nan"), 1, 0]])
        with self.assertRaises(ValueError):
            infer(image, [10, 10, 100, 100], BadModel(), Cropper(), .8)

    def test_comparison_uses_separate_embeddings(self):
        class Recognizer:
            def alignCrop(self, image, face):
                return image
            def feature(self, image):
                return image[0, 0, :2].astype(float).reshape(1, 2)
        a, b = np.zeros((2, 2, 3), np.uint8), np.zeros((2, 2, 3), np.uint8)
        a[0, 0, :2], b[0, 0, :2] = [10, 0], [0, 10]
        result = compare(a, b, Detector(np.ones((1, 15))), Recognizer(), .75)
        self.assertFalse(result["same_person"])
        self.assertAlmostEqual(result["similarity"], 0)


if __name__ == "__main__":
    unittest.main()

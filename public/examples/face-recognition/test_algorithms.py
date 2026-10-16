import math
import unittest
from algorithms import cosine_distance, eye_aspect_ratio, mouth_ratio, yaw_degrees, softmax


class AlgorithmsTest(unittest.TestCase):
    def test_distance(self):
        self.assertAlmostEqual(.2, cosine_distance([1, 0], [.8, .6]))
        self.assertAlmostEqual(0, cosine_distance([1, 0], [2, 0]))
        self.assertAlmostEqual(1, cosine_distance([1, 0], [0, 1]))
        self.assertAlmostEqual(2, cosine_distance([1, 0], [-1, 0]))
        self.assertAlmostEqual(0, cosine_distance([1e308, 1e308], [1e308, 1e308]))

    def test_invalid_embeddings(self):
        for a, b in [([], []), ([1], [1, 2]), ([0], [1]), ([math.nan], [1]), ([math.inf], [1])]:
            with self.subTest(a=a), self.assertRaises(ValueError):
                cosine_distance(a, b)

    def test_yaw_with_mixed_rotation(self):
        # Rz(roll) Ry(yaw) Rx(pitch): test mixed angles, not just pure yaw.
        y, p, r = map(math.radians, [25, 20, -15])
        cy, sy, cp, sp, cr, sr = math.cos(y), math.sin(y), math.cos(p), math.sin(p), math.cos(r), math.sin(r)
        rotation = [[cr*cy, cr*sy*sp-sr*cp, cr*sy*cp+sr*sp],
                    [sr*cy, sr*sy*sp+cr*cp, sr*sy*cp-cr*sp],
                    [-sy, cy*sp, cy*cp]]
        self.assertAlmostEqual(25, yaw_degrees(rotation))
        self.assertAlmostEqual(25, yaw_degrees([[v * 2 for v in row] for row in rotation]))

    def test_invalid_pose(self):
        for matrix in [[], [[0]*3]*3, [[math.nan]*3]*3]:
            with self.assertRaises(ValueError):
                yaw_degrees(matrix)

    def test_mouth_and_eye_are_scale_invariant(self):
        mouth = [(0, 1), (0, 3), (-5, 2), (5, 2)]
        eye = [(0, 0), (1, 1), (3, 1), (4, 0), (3, -1), (1, -1)]
        self.assertAlmostEqual(.2, mouth_ratio(*mouth))
        self.assertAlmostEqual(.5, eye_aspect_ratio(eye))
        self.assertAlmostEqual(mouth_ratio(*mouth), mouth_ratio(*[tuple(v * 3 for v in p) for p in mouth]))
        self.assertAlmostEqual(eye_aspect_ratio(eye), eye_aspect_ratio([tuple(v * 3 for v in p) for p in eye]))

    def test_invalid_eye_and_mouth(self):
        with self.assertRaises(ValueError):
            eye_aspect_ratio([(0, 0)]*6)
        with self.assertRaises(ValueError):
            mouth_ratio((0, 0), (0, 1), (0, 0), (0, 0))

    def test_softmax(self):
        self.assertAlmostEqual(.88079707798, softmax([1, 3])[1])
        self.assertEqual(softmax([1, 3]), softmax([1001, 1003]))
        self.assertAlmostEqual(1, sum(softmax([.1, .3, -.2])))
        for values in [[], [math.nan], [math.inf]]:
            with self.assertRaises(ValueError):
                softmax(values)


if __name__ == "__main__":
    unittest.main()

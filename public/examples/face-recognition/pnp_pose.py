"""Synthetic PnP regression. Verifies geometry, not a real person's pose accuracy."""
import math
import cv2
import numpy as np
from algorithms import yaw_degrees


def estimate_pose(object_points, image_points, camera_matrix, distortion):
    ok, rotation_vector, translation = cv2.solvePnP(
        np.asarray(object_points, np.float64), np.asarray(image_points, np.float64),
        np.asarray(camera_matrix, np.float64), np.asarray(distortion, np.float64),
        flags=cv2.SOLVEPNP_ITERATIVE)
    if not ok:
        raise ValueError("PnP did not converge")
    rotation, _ = cv2.Rodrigues(rotation_vector)
    projected, _ = cv2.projectPoints(np.asarray(object_points, np.float64),
                                    rotation_vector, translation, camera_matrix, distortion)
    error = np.linalg.norm(projected.reshape(-1, 2) - image_points, axis=1).mean()
    return rotation, translation, float(error)


def main():
    # Non-coplanar synthetic template, NOT a calibrated MediaPipe landmark model.
    points = np.array([[0, 0, 0], [0, 60, 15], [-40, -30, 25], [40, -30, 25],
                       [-25, 25, 20], [25, 25, 20]], np.float64)
    camera = np.array([[800, 0, 320], [0, 800, 240], [0, 0, 1]], np.float64)
    distortion = np.zeros((5, 1), np.float64)
    angle = math.radians(25)
    expected = np.array([[math.cos(angle), 0, math.sin(angle)], [0, 1, 0],
                         [-math.sin(angle), 0, math.cos(angle)]], np.float64)
    rvec, _ = cv2.Rodrigues(expected)
    pixels, _ = cv2.projectPoints(points, rvec, np.array([0., 0., 600.]), camera, distortion)
    rotation, _, error = estimate_pose(points, pixels.reshape(-1, 2), camera, distortion)
    yaw = yaw_degrees(rotation)
    if not np.allclose(rotation, expected, atol=1e-6) or error > 1e-6:
        raise AssertionError("Synthetic PnP regression failed")
    print(f"synthetic yaw={yaw:.6f} degrees, mean reprojection error={error:.8f}px")


if __name__ == "__main__":
    main()

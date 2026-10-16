"""Small teaching algorithms. Geometry only: no PAD or identity verification."""
import math


def cosine_distance(first, second):
    a, b = tuple(first), tuple(second)
    if not a or len(a) != len(b):
        raise ValueError("embeddings must be nonempty and have equal dimensions")
    if not all(math.isfinite(v) for v in (*a, *b)):
        raise ValueError("embeddings must contain finite numbers")
    sa, sb = max(map(abs, a)), max(map(abs, b))
    if sa == 0 or sb == 0:
        raise ValueError("zero embedding")
    a, b = tuple(v / sa for v in a), tuple(v / sb for v in b)
    similarity = sum(x * y for x, y in zip(a, b)) / (
        math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))
    return 1 - max(-1.0, min(1.0, similarity))


def yaw_degrees(matrix):
    """Y angle for R=Rz(roll) Ry(yaw) Rx(pitch), away from gimbal lock.

    Accepts a 3x3 rotation or a uniform-scale 4x4 similarity transform.
    Sign is a numerical convention; calibrate before labeling subject-left.
    """
    if len(matrix) not in (3, 4) or any(len(row) != len(matrix) for row in matrix):
        raise ValueError("expected a 3x3 or 4x4 matrix")
    values = [float(matrix[i][j]) for i in range(3) for j in range(3)]
    if not all(math.isfinite(v) for v in values):
        raise ValueError("invalid pose matrix")
    denominator = math.hypot(matrix[0][0], matrix[1][0])
    if math.hypot(denominator, matrix[2][0]) < 1e-8:
        raise ValueError("degenerate pose matrix")
    return math.degrees(math.atan2(-matrix[2][0], denominator))


def mouth_ratio(upper, lower, corner_a, corner_b):
    width = math.dist(corner_a, corner_b)
    if not math.isfinite(width) or width <= 1e-8:
        raise ValueError("invalid mouth width")
    result = math.dist(upper, lower) / width
    if not math.isfinite(result):
        raise ValueError("invalid mouth landmarks")
    return result


def eye_aspect_ratio(points):
    """Six eye-contour points in order; all use the same pixel coordinate units."""
    if len(points) != 6:
        raise ValueError("six eye points required")
    p1, p2, p3, p4, p5, p6 = points
    width = math.dist(p1, p4)
    if not math.isfinite(width) or width <= 1e-8:
        raise ValueError("invalid eye width")
    result = (math.dist(p2, p6) + math.dist(p3, p5)) / (2 * width)
    if not math.isfinite(result):
        raise ValueError("invalid eye landmarks")
    return result


def softmax(logits):
    values = tuple(logits)
    if not values or not all(math.isfinite(v) for v in values):
        raise ValueError("finite nonempty logits required")
    exps = [math.exp(v - max(values)) for v in values]
    total = sum(exps)
    return [v / total for v in exps]


if __name__ == "__main__":
    print("cosine distance:", cosine_distance([1, 0], [.8, .6]))
    print("live score for logits [1, 3]:", softmax([1, 3])[1])

from pathlib import Path
from unittest import TestCase

import av
import numpy as np

from pose_format.utils.holistic import load_holistic

TEST_VIDEO = Path(__file__).parent / "data" / "test_video.mp4"


def _decode_frames(path: Path):
    container = av.open(str(path))
    frames = [frame.to_ndarray(format='rgb24') for frame in container.decode(video=0)]
    container.close()
    return frames


class TestHolisticWorkers(TestCase):
    @classmethod
    def setUpClass(cls):
        if not TEST_VIDEO.exists():
            raise FileNotFoundError(f"Test video not found: {TEST_VIDEO}")
        cls.frames = _decode_frames(TEST_VIDEO)
        sample = cls.frames[0]
        cls.height, cls.width = sample.shape[:2]
        holistic_config = {
            'model_complexity': 0,
            'refine_face_landmarks': True,
            'static_image_mode': True,
        }

        def run(n):
            return load_holistic(
                list(cls.frames),
                fps=30,
                width=cls.width,
                height=cls.height,
                additional_holistic_config=dict(holistic_config),
                pose_workers=n,
            )

        cls.pose_1 = run(1)
        cls.pose_4 = run(4)

    def test_workers_produce_same_shape(self):
        self.assertEqual(self.pose_1.body.data.shape, self.pose_4.body.data.shape)
        self.assertEqual(self.pose_1.body.confidence.shape, self.pose_4.body.confidence.shape)

    def test_first_frame_identical(self):
        np.testing.assert_array_equal(
            self.pose_1.body.data.filled(0)[0],
            self.pose_4.body.data.filled(0)[0],
        )

    def test_workers_produce_similar_data(self):
        d1 = self.pose_1.body.data.filled(0)
        d4 = self.pose_4.body.data.filled(0)

        mean_diff = np.abs(d1 - d4).mean()
        self.assertLess(mean_diff, 1.0, "Mean landmark difference should be < 1 pixel")

    def test_frame_count_matches(self):
        self.assertEqual(len(self.pose_1.body.data), len(self.frames))
        self.assertEqual(len(self.pose_4.body.data), len(self.frames))

    def test_multi_workers_warns_without_static_image_mode(self):
        import warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            load_holistic(
                list(self.frames),
                fps=30,
                width=self.width,
                height=self.height,
                additional_holistic_config={'static_image_mode': False},
                pose_workers=2,
            )
            self.assertTrue(any("not thread-safe" in str(warning.message) for warning in w))

"""Checks the live path on still photos: upstream's MediaPipeHandTracker and classifier, no camera.

The tracker runs MediaPipe in live-stream mode, so each photo is fed as a short stream of frames
until a result arrives. Inference time is measured separately with the same model and thresholds
in image mode (synchronous), because live-stream calls return before inference finishes.
"""

import statistics
import time
from pathlib import Path
from typing import Any

from src.infrastructure.hand_tracking.model_store import MediaPipeModelStore
from src.shared.config import AppConfig

RESULT_WAIT_SECONDS = 3.0


def _read(path: Path) -> Any:
    import cv2

    frame = cv2.imread(str(path))
    if frame is None:
        raise ValueError(f"cannot read image {path}")
    return frame


def detect_still(config: AppConfig, path: Path) -> list[dict[str, object]]:
    from src.infrastructure.hand_tracking.hand_tracking import MediaPipeHandTracker

    MediaPipeModelStore(config).ensure_model()
    frame = _read(path)
    tracker = MediaPipeHandTracker(config)
    try:
        deadline = time.monotonic() + RESULT_WAIT_SECONDS
        timestamp_ms = 0
        while time.monotonic() < deadline:
            timestamp_ms += 33
            states, detected = tracker.detect(frame, timestamp_ms)
            if detected:
                return [
                    {
                        "gesture": state.gesture,
                        "handedness": hand.handedness,
                        "upright": state.upright,
                        "size": round(state.size, 3),
                    }
                    for state, hand in zip(states, detected, strict=True)
                ]
            time.sleep(0.033)
        return []
    finally:
        tracker.close()


def inference_ms(config: AppConfig, path: Path, runs: int = 30) -> dict[str, float]:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python.core.base_options import BaseOptions
    from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
        VisionTaskRunningMode,
    )
    from mediapipe.tasks.python.vision.hand_landmarker import (
        HandLandmarker,
        HandLandmarkerOptions,
    )

    MediaPipeModelStore(config).ensure_model()
    rgb = cv2.cvtColor(_read(path), cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(config.model.file)),
        running_mode=VisionTaskRunningMode.IMAGE,
        num_hands=config.model.max_hands,
        min_hand_detection_confidence=config.model.min_hand_detection_confidence,
        min_hand_presence_confidence=config.model.min_hand_presence_confidence,
    )
    with HandLandmarker.create_from_options(options) as landmarker:
        landmarker.detect(image)  # warm-up, not counted
        times = []
        for _ in range(runs):
            started = time.perf_counter()
            landmarker.detect(image)
            times.append((time.perf_counter() - started) * 1000)
    times.sort()
    return {
        "runs": runs,
        "p50": round(statistics.median(times), 1),
        "p95": round(times[max(0, round(0.95 * runs) - 1)], 1),
        "max": round(times[-1], 1),
    }

"""A scripted hand provider, so the vendored pipeline runs without a camera.

ScriptedHandTracker implements upstream's HandTrackerPort: instead of running MediaPipe on the
frame, it builds the 21 landmarks of the poses a trace asks for at that moment and turns them into
HandStates with upstream's own raw_hand_to_state and deduplication, exactly as MediaPipeHandTracker
does with MediaPipe's output. Classification, activation, debounce, the pointer and pinch joysticks
and command dispatch all run unchanged; only the camera and MediaPipe are replaced.

The pose shapes come from upstream's tests/domain/test_gestures.py fixtures (MIT, Alex Hovy),
moved and scaled to where the trace puts each hand.
"""

import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np

from src.application.ports.hand_tracker import DetectedHand
from src.domain.constants import HANDEDNESS_RIGHT
from src.domain.geometry.landmarks import (
    LANDMARK_COUNT,
    LANDMARK_INDEX_MCP,
    LANDMARK_INDEX_PIP,
    LANDMARK_INDEX_TIP,
    LANDMARK_MIDDLE_MCP,
    LANDMARK_MIDDLE_PIP,
    LANDMARK_MIDDLE_TIP,
    LANDMARK_PINKY_MCP,
    LANDMARK_PINKY_PIP,
    LANDMARK_PINKY_TIP,
    LANDMARK_RING_MCP,
    LANDMARK_RING_PIP,
    LANDMARK_RING_TIP,
    LANDMARK_THUMB_IP,
    LANDMARK_THUMB_TIP,
    LANDMARK_WRIST,
)
from src.domain.gestures.gesture_preprocessing import (
    RawDetectedHandState,
    deduplicate_hands_by_landmarks,
    raw_hand_to_state,
)
from src.domain.session.session_types import HandState
from src.shared.config import AppConfig

Point = tuple[float, float]

# Poses in a 0..1 box as upstream's fixtures draw them; the wrist is low, the fingertips high.
_CURLED = {
    LANDMARK_WRIST: (0.50, 0.80),
    LANDMARK_INDEX_MCP: (0.42, 0.54),
    LANDMARK_MIDDLE_MCP: (0.50, 0.50),
    LANDMARK_RING_MCP: (0.58, 0.54),
    LANDMARK_PINKY_MCP: (0.64, 0.58),
    LANDMARK_INDEX_PIP: (0.42, 0.45),
    LANDMARK_MIDDLE_PIP: (0.50, 0.44),
    LANDMARK_RING_PIP: (0.58, 0.45),
    LANDMARK_PINKY_PIP: (0.64, 0.48),
    LANDMARK_INDEX_TIP: (0.42, 0.62),
    LANDMARK_MIDDLE_TIP: (0.50, 0.62),
    LANDMARK_RING_TIP: (0.58, 0.62),
    LANDMARK_PINKY_TIP: (0.64, 0.63),
    LANDMARK_THUMB_TIP: (0.40, 0.48),
}
POSES: dict[str, dict[int, Point]] = {
    "open_palm": {
        LANDMARK_WRIST: (0.50, 0.80),
        LANDMARK_INDEX_MCP: (0.40, 0.52),
        LANDMARK_MIDDLE_MCP: (0.50, 0.50),
        LANDMARK_RING_MCP: (0.60, 0.52),
        LANDMARK_PINKY_MCP: (0.68, 0.58),
        LANDMARK_INDEX_PIP: (0.40, 0.38),
        LANDMARK_MIDDLE_PIP: (0.50, 0.35),
        LANDMARK_RING_PIP: (0.60, 0.38),
        LANDMARK_PINKY_PIP: (0.68, 0.42),
        LANDMARK_INDEX_TIP: (0.40, 0.20),
        LANDMARK_MIDDLE_TIP: (0.50, 0.16),
        LANDMARK_RING_TIP: (0.60, 0.20),
        LANDMARK_PINKY_TIP: (0.68, 0.26),
        LANDMARK_THUMB_IP: (0.36, 0.56),
        LANDMARK_THUMB_TIP: (0.24, 0.50),
    },
    "fist": _CURLED,
    "point": {**_CURLED, LANDMARK_INDEX_TIP: (0.42, 0.24)},
    "pinch": {
        **_CURLED,
        LANDMARK_INDEX_TIP: (0.42, 0.24),
        LANDMARK_THUMB_TIP: (0.43, 0.25),
    },
    "two_fingers": {
        **_CURLED,
        LANDMARK_INDEX_TIP: (0.42, 0.24),
        LANDMARK_MIDDLE_TIP: (0.50, 0.24),
        LANDMARK_THUMB_TIP: (0.36, 0.56),
    },
}
# Where a pose is "held": the hand's tracked point (the fingertip for point and pinch, as upstream
# tracks them) sits at the position the trace gives.
_ANCHOR: dict[str, int] = {"point": LANDMARK_INDEX_TIP, "pinch": LANDMARK_INDEX_TIP}
_POSE_BOX = 0.64  # the fixtures' hand spans 0.24..0.68 by 0.16..0.80; this is its larger side


def hand_landmarks(pose: str, at: Point, size: float) -> list[SimpleNamespace]:
    """The 21 landmarks of `pose`, scaled so the hand spans about `size`, placed at `at`."""
    shape = POSES[pose]
    anchor = shape.get(_ANCHOR.get(pose, LANDMARK_MIDDLE_MCP), (0.50, 0.50))
    scale = size / _POSE_BOX
    points = [shape.get(i, (0.50, 0.50)) for i in range(LANDMARK_COUNT)]
    return [
        SimpleNamespace(
            x=at[0] + (x - anchor[0]) * scale,
            y=at[1] + (y - anchor[1]) * scale,
            z=0.0,
        )
        for x, y in points
    ]


@dataclass(frozen=True)
class TraceHand:
    pose: str
    start: Point
    end: Point
    size: float
    handedness: str

    def at(self, fraction: float) -> Point:
        return (
            self.start[0] + (self.end[0] - self.start[0]) * fraction,
            self.start[1] + (self.end[1] - self.start[1]) * fraction,
        )


@dataclass(frozen=True)
class TraceStep:
    ms: int
    hands: tuple[TraceHand, ...]
    note: str


@dataclass(frozen=True)
class Trace:
    name: str
    description: str
    steps: tuple[TraceStep, ...]

    @property
    def duration_ms(self) -> int:
        return sum(step.ms for step in self.steps)

    def hands_at(self, elapsed_ms: float) -> list[tuple[TraceHand, float]] | None:
        """Each hand with how far through its step it is; None once the trace is over."""
        start = 0
        for step in self.steps:
            if elapsed_ms < start + step.ms:
                fraction = (elapsed_ms - start) / step.ms
                return [(hand, fraction) for hand in step.hands]
            start += step.ms
        return None


def _point(value: Any, what: str) -> Point:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or not all(isinstance(v, (int, float)) and 0 <= v <= 1 for v in value)
    ):
        raise ValueError(f"{what} must be [x, y] with both between 0 and 1")
    return (float(value[0]), float(value[1]))


def parse_trace(data: Any) -> Trace:
    steps = []
    for index, step in enumerate(data["steps"]):
        hands = []
        for hand in step.get("hands", []):
            pose = hand["pose"]
            if pose not in POSES:
                raise ValueError(f"step {index}: unknown pose {pose!r}")
            start = _point(hand.get("from", hand.get("at")), f"step {index} from/at")
            end = _point(hand.get("to", hand.get("from", hand.get("at"))), f"step {index} to")
            hands.append(
                TraceHand(
                    pose=pose,
                    start=start,
                    end=end,
                    size=float(hand.get("size", 0.30)),
                    handedness=hand.get("handedness", HANDEDNESS_RIGHT),
                )
            )
        ms = int(step["ms"])
        if ms <= 0:
            raise ValueError(f"step {index}: ms must be positive")
        steps.append(TraceStep(ms=ms, hands=tuple(hands), note=step.get("note", "")))
    return Trace(name=data["name"], description=data.get("description", ""), steps=tuple(steps))


def load_trace(path: Path) -> Trace:
    return parse_trace(json.loads(path.read_text(encoding="utf-8")))


class ScriptedHandTracker:
    """HandTrackerPort that reads hands from a trace on the wall clock, like a live camera."""

    def __init__(
        self,
        trace: Trace,
        config: AppConfig,
        on_done: Callable[[], None],
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._trace = trace
        self._config = config
        self._on_done = on_done
        self._clock = clock
        self._started_at: float | None = None
        self._done = False

    def update_config(self, config: AppConfig) -> None:
        self._config = config

    def detect(
        self, frame: Any, timestamp_ms: int
    ) -> tuple[list[HandState], list[DetectedHand]]:
        del frame, timestamp_ms
        now = self._clock()
        if self._started_at is None:
            self._started_at = now
        hands = self._trace.hands_at((now - self._started_at) * 1000)
        if hands is None:
            if not self._done:
                self._done = True
                self._on_done()
            return [], []

        detected = deduplicate_hands_by_landmarks(
            [
                DetectedHand(
                    landmarks=hand_landmarks(hand.pose, hand.at(fraction), hand.size),
                    handedness=hand.handedness,
                )
                for hand, fraction in hands
            ],
            lambda detected_hand: detected_hand.landmarks,
        )
        states = [
            raw_hand_to_state(
                RawDetectedHandState(landmarks=d.landmarks, handedness=d.handedness),
                self._config.gesture,
            )
            for d in detected
        ]
        return states, detected

    def close(self) -> None:
        pass


class BlankFrameSource:
    """FrameSourcePort with black frames at a steady rate, standing in for the webcam."""

    def __init__(self, fps: float = 30.0, width: int = 640, height: int = 480) -> None:
        self._interval = 1.0 / fps
        self._frame = np.zeros((height, width, 3), dtype=np.uint8)
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._version = 0

    def is_open(self) -> bool:
        return True

    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._tick, daemon=True)
            self._thread.start()

    def latest_versioned(self) -> tuple[int, Any | None]:
        with self._lock:
            return self._version, self._frame if self._version else None

    def failed(self) -> bool:
        return False

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)
            self._thread = None

    def close(self) -> None:
        self.stop()

    def _tick(self) -> None:
        while not self._stop.wait(self._interval):
            with self._lock:
                self._version += 1

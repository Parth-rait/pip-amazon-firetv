"""Tests for Pip's bridge: the TV port, the scripted provider and whole-pipeline replays.

Run from gesture/: .venv/bin/python -m unittest discover -s tests -t .
The replays run upstream's whole GestureRemoteService on the wall clock, so they take a few
seconds each, like the traces they play.
"""

import asyncio
import io
import json
import tempfile
import time
import unittest
from pathlib import Path

from pip_bridge import GESTURE_DIR
from pip_bridge.pip_remote import PIP_COMMANDS, PipRemote
from pip_bridge.runtime import configure_logging, pip_config, replay_service
from pip_bridge.scripted import POSES, hand_landmarks, load_trace, parse_trace
from pip_bridge.steady_camera import SteadyCameraFrameSource
from src.domain.commands import GESTURE_TO_COMMAND
from src.domain.constants import (
    GESTURE_FIST,
    GESTURE_OPEN_PALM,
    GESTURE_PINCH,
    GESTURE_POINT,
    GESTURE_TWO_FINGERS,
    HANDEDNESS_RIGHT,
)
from src.domain.gestures.gesture_classification import classify_static_hand_pose

TRACES = GESTURE_DIR / "traces"
_LOGS = tempfile.TemporaryDirectory()


def setUpModule() -> None:
    # Upstream's logger prints to stdout without a file; keep the test output to results.
    configure_logging(Path(_LOGS.name) / "bridge.log")


def tearDownModule() -> None:
    _LOGS.cleanup()


def replay(name: str) -> list[str]:
    remote = PipRemote(out=io.StringIO())
    service = replay_service(pip_config({}), remote, load_trace(TRACES / f"{name}.json"))
    asyncio.run(service.run())
    return remote.sent


class PipRemoteTests(unittest.TestCase):
    def test_supports_every_command_a_gesture_can_make(self) -> None:
        self.assertEqual(PIP_COMMANDS, frozenset(GESTURE_TO_COMMAND.values()))
        self.assertEqual(PipRemote().capabilities().supported_commands, PIP_COMMANDS)

    def test_writes_one_json_line_per_command(self) -> None:
        out = io.StringIO()
        remote = PipRemote(out=out, clock=lambda: 1.5)
        asyncio.run(remote.send_command("DPAD_LEFT"))
        self.assertEqual(
            [json.loads(line) for line in out.getvalue().splitlines()],
            [{"type": "command", "command": "DPAD_LEFT", "at": 1500}],
        )

    def test_has_no_voice_stream(self) -> None:
        self.assertIsNone(asyncio.run(PipRemote(out=io.StringIO()).start_voice("auto")))


class FakeCapture:
    """A webcam that fails the reads it is told to, then delivers; or never delivers."""

    def __init__(self, fail_first: int) -> None:
        self.fail_first = fail_first
        self.reads = 0

    def read(self) -> tuple[bool, object]:
        self.reads += 1
        return (self.reads > self.fail_first, object())

    def isOpened(self) -> bool:
        return True

    def release(self) -> None:
        pass


def run_source(source: SteadyCameraFrameSource, seconds: float) -> None:
    source.start()
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline and not source.failed() and source.frames < 3:
        time.sleep(0.01)
    source.stop()


class SteadyCameraTests(unittest.TestCase):
    def test_a_few_dropped_frames_do_not_end_the_run(self) -> None:
        source = SteadyCameraFrameSource(FakeCapture(fail_first=4), gap_limit_s=1.0)
        run_source(source, 2.0)
        self.assertFalse(source.failed())
        self.assertGreaterEqual(source.frames, 3)

    def test_a_camera_that_never_delivers_fails_after_the_gap(self) -> None:
        source = SteadyCameraFrameSource(FakeCapture(fail_first=10**9), gap_limit_s=0.2)
        run_source(source, 2.0)
        self.assertTrue(source.failed())
        self.assertEqual(source.frames, 0)


class ScriptedPoseTests(unittest.TestCase):
    def test_each_pose_classifies_as_upstream_names_it(self) -> None:
        expected = {
            "open_palm": GESTURE_OPEN_PALM,
            "fist": GESTURE_FIST,
            "point": GESTURE_POINT,
            "pinch": GESTURE_PINCH,
            "two_fingers": GESTURE_TWO_FINGERS,
        }
        self.assertEqual(set(expected), set(POSES))
        for pose, gesture in expected.items():
            for at, size in (((0.3, 0.5), 0.2), ((0.7, 0.6), 0.35)):
                landmarks = hand_landmarks(pose, at, size)
                with self.subTest(pose=pose, at=at, size=size):
                    self.assertEqual(
                        classify_static_hand_pose(landmarks, HANDEDNESS_RIGHT, 0.22), gesture
                    )

    def test_point_and_pinch_are_placed_by_the_fingertip(self) -> None:
        tip = hand_landmarks("point", (0.6, 0.4), 0.3)[8]
        self.assertAlmostEqual(tip.x, 0.6)
        self.assertAlmostEqual(tip.y, 0.4)

    def test_rejects_unknown_poses_and_bad_positions(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown pose"):
            parse_trace({"name": "x", "steps": [{"ms": 10, "hands": [{"pose": "wave", "at": [0.5, 0.5]}]}]})
        with self.assertRaisesRegex(ValueError, "between 0 and 1"):
            parse_trace({"name": "x", "steps": [{"ms": 10, "hands": [{"pose": "fist", "at": [1.5, 0.5]}]}]})
        with self.assertRaisesRegex(ValueError, "positive"):
            parse_trace({"name": "x", "steps": [{"ms": 0, "hands": []}]})


class ReplayTests(unittest.TestCase):
    """Upstream's whole service, with only the camera and MediaPipe replaced by a trace."""

    def test_evening_sends_each_command_once_in_order(self) -> None:
        self.assertEqual(
            replay("evening"),
            ["DPAD_CENTER", "DPAD_RIGHT", "DPAD_LEFT", "VOLUME_UP", "HOME", "BACK", "DPAD_UP"],
        )

    def test_nothing_is_sent_without_the_two_palm_activation(self) -> None:
        self.assertEqual(replay("no-activation"), [])

    def test_a_wobble_inside_the_neutral_circle_sends_nothing(self) -> None:
        self.assertEqual(replay("point-jitter"), [])


if __name__ == "__main__":
    unittest.main()

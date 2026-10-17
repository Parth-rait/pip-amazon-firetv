"""The webcam frame source, patient with macOS: upstream's LocalCameraFrameSource stops at the
first frame the camera fails to deliver, and AVFoundation drops one now and then (while the camera
starts, or when Continuity Camera or another app touches it), which ended a run that would have
worked. This one retries and stops only after GAP_LIMIT_S without a frame."""

import time
from typing import Any

from src.infrastructure.camera.local_frame_source import LocalCameraFrameSource

GAP_LIMIT_S = 3.0
_RETRY_S = 0.05


class SteadyCameraFrameSource(LocalCameraFrameSource):
    def __init__(self, capture: Any, gap_limit_s: float = GAP_LIMIT_S) -> None:
        super().__init__(capture)
        self._gap_limit_s = gap_limit_s
        self.frames = 0

    def _read_loop(self) -> None:
        last_frame = time.monotonic()
        while not self._stop_event.is_set():
            ok, frame = self._capture.read()
            if ok:
                last_frame = time.monotonic()
                with self._lock:
                    self._latest_frame = frame
                    self._latest_version += 1
                    self._failed = False
                self.frames += 1
            elif time.monotonic() - last_frame > self._gap_limit_s:
                with self._lock:
                    self._failed = True
                return
            else:
                self._stop_event.wait(_RETRY_S)

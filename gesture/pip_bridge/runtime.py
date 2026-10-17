"""Composition root: upstream's GestureRemoteService with Pip's ports plugged in.

This replaces upstream's src/runtime/container.py for Pip. Kept from upstream: the service, its
runtime loop and pipelines, the command dispatcher, metrics, the camera zoom and frame processor,
and (for the camera) upstream's build_camera_dependencies with MediaPipe and the OpenCV webcam.
Replaced: the TV adapter (PipRemote), the microphone (NoVoiceCapture), and the SQLite settings
store (none: settings come from GESTURE_TV_* environment variables, read by upstream's config).
"""

import os
from collections.abc import Callable
from pathlib import Path

from pip_bridge import GESTURE_DIR
from pip_bridge.no_voice import NoVoiceCapture
from pip_bridge.pip_remote import PipRemote
from pip_bridge.scripted import BlankFrameSource, ScriptedHandTracker, Trace
from src.application.ports.display import DisplayPort
from src.application.ports.frame_source import FrameSourcePort
from src.application.ports.hand_tracker import HandTrackerPort
from src.application.services.gesture_remote_service import GestureRemoteService
from src.application.services.pipeline_metrics import PipelineMetrics
from src.application.services.remote_command_dispatcher import RemoteCommandDispatcher
from src.shared.config import AppConfig, load_config_from_env, replace_config_value
from src.shared.logging import AppLogger, configure_app_logging

MODEL_FILE = GESTURE_DIR / "models" / "hand_landmarker.task"
LOG_FILE = GESTURE_DIR / "logs" / "bridge.log"
# Upstream opens HOME after a 0.7 s fist, but play/pause is open palm, fist, open palm: on the
# webcam a relaxed fist often lasted that long, so play/pause opened Pip instead.
FIST_HOLD_HOME_SECONDS = "1.2"


def pip_config(environ: dict[str, str] | None = None) -> AppConfig:
    """Upstream's defaults and GESTURE_TV_* overrides, with the model kept under gesture/."""
    values = dict(os.environ if environ is None else environ)
    values.setdefault("GESTURE_TV_MODEL_FILE", str(MODEL_FILE))
    values.setdefault("GESTURE_TV_FIST_HOLD_HOME_SECONDS", FIST_HOLD_HOME_SECONDS)
    config = load_config_from_env(values)
    return replace_config_value(config, "app_name", "Pip gestures")


def configure_logging(log_file: Path = LOG_FILE) -> None:
    # Upstream's logger prints to stdout unless it has a file; stdout carries only JSON lines.
    configure_app_logging(log_file, console=False)


def build_service(
    config: AppConfig,
    *,
    remote: PipRemote,
    frame_source: FrameSourcePort,
    hand_tracker: HandTrackerPort,
    display: DisplayPort,
) -> GestureRemoteService:
    from src.infrastructure.camera.camera_zoom import CameraZoomController
    from src.infrastructure.camera.frame_processor import OpenCvFrameProcessor

    logger = AppLogger()
    return GestureRemoteService(
        config,
        remote=remote,
        frame_source=frame_source,
        hand_tracker=hand_tracker,
        camera=CameraZoomController(config),
        frame_processor=OpenCvFrameProcessor(),
        display=display,
        voice_capture=NoVoiceCapture(logger),
        command_dispatcher=RemoteCommandDispatcher(remote, logger),
        logger=logger,
        metrics=PipelineMetrics("pip"),
    )


def camera_service(
    config: AppConfig, remote: PipRemote, preview: bool
) -> GestureRemoteService:
    """The live path: the webcam, MediaPipe's hand landmarker, and a preview window if asked."""
    from pip_bridge.steady_camera import SteadyCameraFrameSource
    from src.infrastructure.camera.headless_display import HeadlessDisplay
    from src.runtime.builders.camera import build_camera_dependencies

    camera = build_camera_dependencies(config)  # downloads the model on first use
    return build_service(
        config,
        remote=remote,
        # The same capture upstream opened, read with retries (steady_camera.py).
        frame_source=SteadyCameraFrameSource(camera.frame_source._capture),
        hand_tracker=camera.hand_tracker,
        display=camera.display if preview else HeadlessDisplay(),
    )


def replay_service(
    config: AppConfig, remote: PipRemote, trace: Trace
) -> GestureRemoteService:
    """The simulated path: a trace of poses instead of the camera; everything else is the same."""
    from src.infrastructure.camera.headless_display import HeadlessDisplay

    # Trace positions are in camera space; with auto-zoom off, the crop is the whole frame.
    config = replace_config_value(config, "auto_zoom_enabled", False)
    holder: list[Callable[[], None]] = []
    service = build_service(
        config,
        remote=remote,
        frame_source=BlankFrameSource(),
        hand_tracker=ScriptedHandTracker(trace, config, on_done=lambda: holder[0]()),
        display=HeadlessDisplay(),
    )
    holder.append(service.stop)
    return service

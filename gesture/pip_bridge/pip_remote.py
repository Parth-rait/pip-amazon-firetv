"""PipRemote: the vendored pipeline's TV port, pointed at Pip instead of a TV.

Upstream ends every gesture in TVRemotePort.send_command("DPAD_LEFT" and so on). Here that call
writes one JSON line to stdout; the Node side (server/src/gesture-bridge.ts) turns the command into
a semantic input and sends it with pad:input, so the gesture goes through the same router, host
check, duplicate and stale checks as a tap on the pad. No TV protocol, pairing or network here.
"""

import json
import sys
import time
from collections.abc import Callable
from typing import TextIO

from src.application.ports.tv_remote import (
    AppVoiceInputHandler,
    CapabilityStatus,
    TvAdapterCapabilities,
    VoiceInputCapabilities,
    VoiceInputMode,
    VoiceStreamPort,
)
from src.domain.constants import (
    TV_COMMAND_BACK,
    TV_COMMAND_DPAD_CENTER,
    TV_COMMAND_DPAD_DOWN,
    TV_COMMAND_DPAD_LEFT,
    TV_COMMAND_DPAD_RIGHT,
    TV_COMMAND_DPAD_UP,
    TV_COMMAND_HOME,
    TV_COMMAND_VOLUME_DOWN,
    TV_COMMAND_VOLUME_UP,
)

# Every command upstream's GESTURE_TO_COMMAND can produce. Power, mute and the media keys are
# never produced by a gesture, so they are left out and the dispatcher drops them if asked.
PIP_COMMANDS = frozenset(
    {
        TV_COMMAND_HOME,
        TV_COMMAND_BACK,
        TV_COMMAND_DPAD_CENTER,
        TV_COMMAND_DPAD_LEFT,
        TV_COMMAND_DPAD_RIGHT,
        TV_COMMAND_DPAD_UP,
        TV_COMMAND_DPAD_DOWN,
        TV_COMMAND_VOLUME_UP,
        TV_COMMAND_VOLUME_DOWN,
    }
)

_UNSUPPORTED = CapabilityStatus.UNSUPPORTED


def write_line(out: TextIO, message: dict[str, object]) -> None:
    out.write(json.dumps(message, separators=(",", ":")) + "\n")
    out.flush()


class PipRemote:
    def __init__(
        self,
        out: TextIO = sys.stdout,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._out = out
        self._clock = clock
        self.sent: list[str] = []

    def capabilities(self) -> TvAdapterCapabilities:
        return TvAdapterCapabilities(
            supported_commands=PIP_COMMANDS,
            power=_UNSUPPORTED,
            volume=CapabilityStatus.IMPLEMENTED,
            directional_navigation=CapabilityStatus.IMPLEMENTED,
            media_controls=CapabilityStatus.IMPLEMENTED,
            text_input=_UNSUPPORTED,
            source_selection=_UNSUPPORTED,
            wake_on_lan=_UNSUPPORTED,
            pairing=_UNSUPPORTED,
            voice_input=VoiceInputCapabilities(
                remote_mic_stream=_UNSUPPORTED,
                native_voice_search=_UNSUPPORTED,
                app_voice_input=_UNSUPPORTED,
                app_text_input=_UNSUPPORTED,
                notes=("Pip's voice input is on the Pip Pad.",),
            ),
            connection_type="stdout-jsonl",
            known_limitations=("Pip decides what each command does; see core/gesture.ts.",),
        )

    def set_app_voice_input_handler(self, handler: AppVoiceInputHandler | None) -> None:
        del handler

    async def connect(self) -> bool:
        return True

    async def wake(self) -> bool:
        return False

    async def discover_mac_address(self) -> str | None:
        return None

    async def send_command(self, command: str) -> None:
        self.sent.append(command)
        write_line(
            self._out,
            {"type": "command", "command": command, "at": round(self._clock() * 1000)},
        )

    async def start_voice(self, mode: VoiceInputMode) -> VoiceStreamPort | None:
        del mode
        return None

    async def disconnect(self) -> None:
        pass

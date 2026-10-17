"""The voice port, unused in Pip: upstream's two-finger hold starts TV voice search; Pip's voice
input is the Pip Pad's microphone, so the hold is logged and ignored."""

from src.application.ports.logger import LoggerPort
from src.application.ports.tv_remote import VoiceStreamPort
from src.shared.config import AppConfig


class NoVoiceCapture:
    def __init__(self, logger: LoggerPort) -> None:
        self._logger = logger

    def update_config(self, config: AppConfig) -> None:
        del config

    async def capture(self) -> None:
        self._logger.info("Two-finger hold ignored: Pip's voice input is on the Pip Pad.")

    async def capture_stream(self, voice_stream: VoiceStreamPort, context: str) -> None:
        del context
        voice_stream.end()

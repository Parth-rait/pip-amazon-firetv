"""python -m pip_bridge camera [--preview] | replay <trace.json> | image <photo>...

Runs the vendored gesture pipeline and writes one JSON line per event to stdout:
  {"type":"ready","mode":"camera"|"replay"}   once the pipeline is built
  {"type":"command","command":"DPAD_LEFT","at":<ms since epoch>}   per gesture command
  {"type":"done"}   when the pipeline stops
`image` instead prints the hands upstream's tracker finds in each photo and MediaPipe's inference
time. Logs go to gesture/logs/bridge.log. Usually started by `npm run gesture` in server/.
"""

import argparse
import asyncio
import sys
from pathlib import Path

from pip_bridge.pip_remote import PipRemote, write_line
from pip_bridge.runtime import camera_service, configure_logging, pip_config, replay_service
from pip_bridge.scripted import load_trace


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="pip_bridge")
    modes = parser.add_subparsers(dest="mode", required=True)
    camera = modes.add_parser("camera", help="the webcam and MediaPipe")
    camera.add_argument("--preview", action="store_true", help="show upstream's debug window")
    replay = modes.add_parser("replay", help="a trace of hand poses instead of the camera")
    replay.add_argument("trace", type=Path)
    image = modes.add_parser("image", help="the tracker and classifier on still photos")
    image.add_argument("photos", type=Path, nargs="+")
    args = parser.parse_args(argv)

    configure_logging()
    config = pip_config()
    if args.mode == "image":
        from pip_bridge.still import detect_still, inference_ms

        for photo in args.photos:
            write_line(
                sys.stdout,
                {
                    "type": "image",
                    "file": photo.name,
                    "hands": detect_still(config, photo),
                    "inference_ms": inference_ms(config, photo),
                },
            )
        return 0

    remote = PipRemote()
    if args.mode == "camera":
        service = camera_service(config, remote, preview=args.preview)
    else:
        service = replay_service(config, remote, load_trace(args.trace))

    write_line(sys.stdout, {"type": "ready", "mode": args.mode})
    try:
        asyncio.run(service.run())
    except KeyboardInterrupt:
        pass
    write_line(sys.stdout, {"type": "done"})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

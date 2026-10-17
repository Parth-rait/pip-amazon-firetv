"""Pip's bridge around the vendored gesture-tv-remote pipeline.

The vendored code (vendor/gesture_tv_remote, MIT, Alex Hovy) imports itself as the top-level
package `src`, so its folder goes on sys.path before anything imports it. Everything Pip adds lives
in this package; the vendored files stay byte-for-byte as upstream shipped them.
"""

import sys
from pathlib import Path

GESTURE_DIR = Path(__file__).resolve().parents[1]
VENDOR_DIR = GESTURE_DIR / "vendor" / "gesture_tv_remote"

if str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))

#!/usr/bin/env bash
# Sets up the speech side of video understanding (docs/extractions/video-understanding.md):
# builds whisper.cpp at the pinned commit with Metal and downloads the small.en model, checking
# its sha256. Everything stays inside video/ (git-ignored). The vision side is Ollama:
#   ollama pull qwen3-vl:4b-instruct
# Run from anywhere: video/setup.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WHISPER_REPO="https://github.com/ggml-org/whisper.cpp"
WHISPER_COMMIT="d1be6fde11ac6e0407606b4e42fe72d34add8037" # v1.9.5, 6 Oct 2026
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"
MODEL_SHA256="c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d"

for tool in git cmake curl shasum; do
  command -v "$tool" >/dev/null || { echo "setup: $tool is needed"; exit 1; }
done

SRC="$HERE/.tools/whisper.cpp"
if [ ! -d "$SRC/.git" ]; then
  mkdir -p "$HERE/.tools"
  git clone --filter=blob:none "$WHISPER_REPO" "$SRC"
fi
git -C "$SRC" fetch --quiet origin "$WHISPER_COMMIT" || true
git -C "$SRC" checkout --quiet "$WHISPER_COMMIT"
cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF >/dev/null
cmake --build "$SRC/build" --config Release -j --target whisper-cli >/dev/null
echo "built $SRC/build/bin/whisper-cli at ${WHISPER_COMMIT:0:12}"

MODEL="$HERE/models/ggml-small.en.bin"
mkdir -p "$HERE/models"
if [ ! -f "$MODEL" ]; then
  curl -fL --progress-bar -o "$MODEL.part" "$MODEL_URL"
  mv "$MODEL.part" "$MODEL"
fi
echo "$MODEL_SHA256  $MODEL" | shasum -a 256 -c -

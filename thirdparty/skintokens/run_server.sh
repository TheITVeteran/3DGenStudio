#!/usr/bin/env bash
# Start the 3D Gen Studio rigging micro-service (rig_server.py) on Linux.
#
# Rigging (SkinTokens/TokenRig) needs an NVIDIA GPU (CUDA), so it runs on Windows
# and Linux only. On macOS this script exits early with a clear message.
#
# On first run it uses `uv` to provision a pinned standalone Python (see
# .python-version -> 3.13) and installs the SkinTokens requirements, torch, a
# flash-attn wheel, and the model checkpoints. Unlike Windows (which needs the
# curated flash_attention_windows.txt wheels), Linux gets flash-attn straight
# from pip, which resolves a prebuilt wheel for the installed torch/CUDA/Python
# (or builds it — needs the CUDA toolkit + ninja). uv is auto-installed if absent.
#
# Env overrides: RIGTOOLS_PORT/HOST, RIGTOOLS_SKIP_FLASH=1, RIGTOOLS_SKIP_MODEL=1.
set -euo pipefail
cd "$(dirname "$0")"
PYVER=3.13

if [ "$(uname)" = "Darwin" ]; then
  echo "Rigging (SkinTokens) requires an NVIDIA GPU (CUDA), which macOS does not"
  echo "provide. The rigging service is not available on macOS; Auto Rig will be"
  echo "disabled. (The mesh-tools service and the rest of the app still work.)"
  exit 0
fi

# --- Ensure uv is available -------------------------------------------------
if command -v uv >/dev/null 2>&1; then
  UV="uv"
elif [ -x "$HOME/.local/bin/uv" ]; then
  UV="$HOME/.local/bin/uv"
else
  echo "Installing uv (Python toolchain manager)..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  UV="$HOME/.local/bin/uv"
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "Provisioning Python $PYVER via uv..."
  "$UV" python install "$PYVER"
  echo "Creating virtual environment (Python $PYVER)..."
  "$UV" venv .venv --python "$PYVER"
  # shellcheck disable=SC1091
  source .venv/bin/activate

  echo
  echo "Installing SkinTokens requirements..."
  "$UV" pip install -r requirements.txt

  # torch AFTER requirements so it overrides the torch `lightning` pulls in. On
  # Linux the default PyPI torch wheels bundle CUDA, so no custom index is needed.
  echo
  echo "Installing torch (CUDA build)..."
  "$UV" pip install torch torchvision torchaudio

  echo
  if [ -n "${RIGTOOLS_SKIP_FLASH:-}" ]; then
    echo "RIGTOOLS_SKIP_FLASH set -- skipping flash-attn."
  else
    echo "Installing flash-attn (prebuilt wheel if available, else builds from source)..."
    "$UV" pip install flash-attn --no-build-isolation || echo "[warn] flash-attn install failed; continuing without it."
  fi

  echo
  if [ -n "${RIGTOOLS_SKIP_MODEL:-}" ]; then
    echo "RIGTOOLS_SKIP_MODEL set -- skipping checkpoint download."
  else
    echo "Downloading model checkpoints (large; first run only)..."
    python download.py --model || echo "[warn] model download failed; run 'python download.py --model' manually before rigging."
  fi

  echo
  echo "Setup complete."
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -c "import fastapi, uvicorn, multipart" 2>/dev/null || "$UV" pip install fastapi uvicorn python-multipart
fi

python rig_server.py

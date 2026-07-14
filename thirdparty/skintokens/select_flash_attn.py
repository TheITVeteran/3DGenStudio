"""Pick the prebuilt flash-attn wheel + matching torch install for this machine.

Building flash-attn from source on Windows takes ages, so we prefer a
precompiled wheel. ``flash_attention_windows.txt`` lists, per row:

    Torch;Cuda;Link;PyTorchLink
    │     │    │     └ the exact `pip install torch... --index-url ...` command
    │     │    │        that pairs with this flash-attn wheel (ABI-matched)
    │     │    └ flash-attn wheel URL
    │     └ CUDA build the wheel targets (match key against the driver)
    └ torch version (informational; also encoded in the wheel + PyTorchLink)

Python is pinned to 3.13 by uv (see .python-version) so it is no longer a match
key — every wheel here is cp313. We just pick the newest CUDA build the driver
can run and hand the caller both pieces to install.

On a match it prints two `KEY=value` lines to stdout:

    WHEEL=https://.../flash_attn-...cp313-win_amd64.whl
    TORCHARGS=torch==2.12.0 torchvision==0.27.0 --index-url https://download.pytorch.org/whl/cu130

(``TORCHARGS`` is column 4 with the leading ``pip install`` stripped, so the
caller can run it with ``uv pip install``.) On no match it prints nothing.
Diagnostics go to stderr. Standard library + nvidia-smi only.

Override CUDA detection with RIGTOOLS_CUDA (e.g. "12.8").
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

WHEELS_FILE = Path(__file__).resolve().parent / "flash_attention_windows.txt"


def driver_cuda() -> float | None:
    """Max CUDA version the NVIDIA driver supports (from nvidia-smi), or None."""
    override = os.environ.get("RIGTOOLS_CUDA")
    if override:
        try:
            return float(override)
        except ValueError:
            pass
    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    try:
        out = subprocess.run([exe], capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return None
    m = re.search(r"CUDA(?:\s+\w+)?\s+Version:\s*(\d+)\.(\d+)", out)
    return float(f"{m.group(1)}.{m.group(2)}") if m else None


def parse_rows():
    """Yield (torch_ver, cuda: float, wheel_url, torch_args) from the wheels file."""
    rows = []
    for line in WHEELS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.lower().startswith("torch;"):
            continue
        parts = [p.strip() for p in line.split(";")]
        if len(parts) < 4:
            continue
        torch_ver, cuda, link, pytorch_cmd = parts[0], parts[1], parts[2], parts[3]
        try:
            cuda_f = float(cuda)
        except ValueError:
            continue
        # Strip the leading "pip install" (or "uv pip install") so the caller can
        # run it via `uv pip install <args>`.
        args = re.sub(r"^\s*(uv\s+)?pip\s+install\s+", "", pytorch_cmd).strip()
        rows.append((torch_ver, cuda_f, link, args))
    return rows


def main() -> None:
    py = f"{sys.version_info.major}.{sys.version_info.minor}"
    cuda = driver_cuda()
    if cuda is None:
        print("[flash-attn] No NVIDIA GPU / CUDA detected; skipping prebuilt wheel.", file=sys.stderr)
        return

    rows = parse_rows()
    if not rows:
        print("[flash-attn] No usable rows in flash_attention_windows.txt.", file=sys.stderr)
        return

    # Rows whose CUDA build the driver can run (wheel_cuda <= driver_cuda),
    # taking the newest such CUDA build.
    candidates = [r for r in rows if r[1] <= cuda + 1e-6]
    if not candidates:
        avail = sorted({r[1] for r in rows})
        print(f"[flash-attn] Driver CUDA {cuda} is older than every listed wheel "
              f"(CUDA builds available: {avail}); skipping prebuilt wheel.", file=sys.stderr)
        return

    torch_ver, wheel_cuda, link, torch_args = max(candidates, key=lambda r: r[1])
    if py != "3.13":
        print(f"[flash-attn] WARNING: running Python {py}, but the wheels are cp313. "
              f"Expect an install failure unless the venv is Python 3.13.", file=sys.stderr)
    print(f"[flash-attn] driver CUDA {cuda} -> wheel CUDA {wheel_cuda}, torch {torch_ver}.",
          file=sys.stderr)
    print(f"WHEEL={link}")
    print(f"TORCHARGS={torch_args}")


if __name__ == "__main__":
    main()

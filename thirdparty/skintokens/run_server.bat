@echo off
:: Start the 3D Gen Studio rigging micro-service (rig_server.py).
::
:: On first run this uses `uv` to provision a pinned standalone Python (see
:: .python-version -> 3.13, the version bpy and the flash-attn wheels target),
:: create a local virtual environment, and install the full stack: the SkinTokens
:: requirements, torch matched to a prebuilt flash-attn wheel for this Python+CUDA
:: (building flash-attn from source on Windows is painfully slow), the flash-attn
:: wheel itself, and the model checkpoints.
::
:: Pinning Python via uv makes the flash-attn wheel selection deterministic: the
:: cpXYZ tag is always known, so only CUDA has to be matched. uv is auto-installed
:: if absent.
::
:: Env overrides:
::   RIGTOOLS_PORT=8300         bind port (also RIGTOOLS_HOST)
::   RIGTOOLS_CUDA=12.8         force the CUDA build to target (skip nvidia-smi)
::   RIGTOOLS_SKIP_FLASH=1      don't install flash-attn
::   RIGTOOLS_SKIP_MODEL=1      don't download the model checkpoints
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "PYVER=3.13"

call :ensure_uv || goto :error

if not exist ".venv\Scripts\python.exe" (
  call :setup || goto :error
) else (
  call ".venv\Scripts\activate.bat"
  :: In case the venv predates the HTTP service (e.g. made per the README).
  python -c "import fastapi, uvicorn, multipart" 2>nul || "%UV%" pip install fastapi uvicorn python-multipart
)

python rig_server.py
goto :eof


:ensure_uv
set "UV="
where uv >nul 2>nul && set "UV=uv"
if not defined UV if exist "%USERPROFILE%\.local\bin\uv.exe" set "UV=%USERPROFILE%\.local\bin\uv.exe"
if not defined UV (
  echo Installing uv ^(Python toolchain manager^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex" || exit /b 1
  set "UV=%USERPROFILE%\.local\bin\uv.exe"
)
exit /b 0


:setup
echo Provisioning Python %PYVER% via uv...
"%UV%" python install %PYVER% || exit /b 1

echo Creating virtual environment ^(Python %PYVER%^)...
"%UV%" venv .venv --python %PYVER% || exit /b 1
call ".venv\Scripts\activate.bat"

:: --- Pick a prebuilt flash-attn wheel + its matching torch install ----------
:: select_flash_attn.py reads flash_attention_windows.txt and, on a CUDA match,
:: prints two lines:
::   WHEEL=<flash-attn wheel url>
::   TORCHARGS=<torch==.. torchvision==.. [torchaudio==..] --index-url ..>
:: (TORCHARGS is the curated per-wheel torch command, ABI-matched to the wheel,
:: with torchvision/torchaudio versions pinned so nothing drags torch off-version.)
:: Prints nothing on no match. Python is pinned to 3.13 by uv, so the wheels
:: (all cp313) always fit; only CUDA has to be matched.
echo.
echo Detecting CUDA to select a flash-attn wheel...
set "WHEEL="
set "TORCHARGS="
for /f "tokens=1* delims==" %%a in ('python select_flash_attn.py') do set "%%a=%%b"

echo.
echo Installing SkinTokens requirements...
"%UV%" pip install -r requirements.txt || exit /b 1

:: Install torch AFTER requirements so it overrides the torch that `lightning`
:: pulls in. The curated TORCHARGS pins torch + torchvision (+torchaudio) to the
:: exact versions the flash-attn wheel was built against, so the ABI matches.
echo.
if defined TORCHARGS (
  echo Installing torch: %TORCHARGS%
  "%UV%" pip install %TORCHARGS% || exit /b 1
) else (
  echo No matching prebuilt flash-attn wheel -- installing default torch 2.7.0 ^(cu128^)...
  "%UV%" pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --index-url https://download.pytorch.org/whl/cu128 || exit /b 1
)

:: --- flash-attn -------------------------------------------------------------
echo.
if defined RIGTOOLS_SKIP_FLASH (
  echo RIGTOOLS_SKIP_FLASH set -- skipping flash-attn.
) else (
  if defined WHEEL (
    echo Downloading + installing prebuilt flash-attn wheel...
    :: `pip install <hf-url>` 403s on Hugging Face Xet-backed files, so fetch the
    :: wheel to a local path via the huggingface_hub client first, then install it.
    set "FA_INSTALLED="
    for /f "delims=" %%p in ('python download_wheel.py "%WHEEL%"') do (
      "%UV%" pip install "%%p" && set "FA_INSTALLED=1"
    )
    if not defined FA_INSTALLED echo [warn] flash-attn not installed ^(download or install failed^); continuing without it.
  ) else (
    echo [warn] No prebuilt flash-attn wheel matched this Python + CUDA.
    echo        flash-attn was NOT installed. To add it later, build from source:
    echo          uv pip install flash-attn --no-build-isolation
  )
)

:: --- model checkpoints ------------------------------------------------------
echo.
if defined RIGTOOLS_SKIP_MODEL (
  echo RIGTOOLS_SKIP_MODEL set -- skipping checkpoint download.
) else (
  echo Downloading model checkpoints ^(large; first run only^)...
  python download.py --model || echo [warn] model download failed; run "python download.py --model" manually before rigging.
)

echo.
echo Setup complete.
exit /b 0


:error
echo.
echo Setup failed. See the messages above.
exit /b 1

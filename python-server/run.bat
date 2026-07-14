@echo off
:: Start the 3D Gen Studio Python mesh-processing service.
:: On first run: uses `uv` to provision a pinned standalone Python (see
:: .python-version), create a local virtual environment, install the base (CPU)
:: requirements, then auto-detect an NVIDIA GPU and install matching GPU
:: acceleration (Warp + the correct cupy-cudaXXx wheel for your CUDA version).
::
:: uv gives every machine the SAME Python without depending on a system install
:: (mirrors thirdparty/skintokens). It is auto-downloaded if not already present.
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "PYVER=3.13"

call :ensure_uv || goto :error

if not exist ".venv\Scripts\python.exe" (
  call :setup || goto :error
) else (
  call ".venv\Scripts\activate.bat"
)

:: Override host/port via env if needed, e.g. set MESHTOOLS_PORT=8200
python main.py
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

echo.
echo Installing base (CPU) requirements...
"%UV%" pip install -r requirements.txt || exit /b 1

:: --- Optional NVIDIA GPU acceleration -------------------------------------
:: detect_cuda.py prints the matching CuPy wheel (e.g. cupy-cuda13x) when an
:: NVIDIA GPU is present, or nothing otherwise. Force a specific wheel with
:: MESHTOOLS_CUPY_PACKAGE, or skip GPU deps entirely with MESHTOOLS_SKIP_GPU=1.
echo.
if defined MESHTOOLS_SKIP_GPU (
  echo MESHTOOLS_SKIP_GPU set -- skipping GPU acceleration ^(CPU-only install^).
  exit /b 0
)

echo Detecting NVIDIA GPU / CUDA version...
set "CUPY_PKG="
for /f "usebackq delims=" %%p in (`python detect_cuda.py`) do set "CUPY_PKG=%%p"

if defined CUPY_PKG (
  echo NVIDIA GPU detected -- installing GPU acceleration: !CUPY_PKG! + Warp
  "%UV%" pip install -r requirements-nvidia.txt || exit /b 1
  "%UV%" pip install "!CUPY_PKG!" || exit /b 1
  echo GPU acceleration installed.
) else (
  echo No NVIDIA GPU detected -- CPU-only install. Auto Retopo will run on the CPU.
)
exit /b 0


:error
echo.
echo Setup failed. See the messages above.
exit /b 1

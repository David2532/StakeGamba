@echo off
cd /d "%~dp0"
set LOG=build_and_sync.log
> "%LOG%" (
  echo === Syntax check ===
  node --check apps\cluster\scripts\build-preview-html.mjs
)
if errorlevel 1 (
  echo SYNTAX CHECK FAILED>> "%LOG%"
  exit /b 1
)
>> "%LOG%" (
  echo OK
  echo.
  echo === Build preview.html / publish/frontend/index.html ===
  node apps\cluster\scripts\build-preview-html.mjs
)
if errorlevel 1 (
  echo BUILD FAILED>> "%LOG%"
  exit /b 1
)
>> "%LOG%" (
  echo.
  echo === Sync to publish/frontend ===
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File scripts\sync-stake-publish.ps1 >> "%LOG%" 2>&1
if errorlevel 1 (
  echo SYNC FAILED>> "%LOG%"
  exit /b 1
)
>> "%LOG%" (
  echo.
  echo === DONE ===
  echo Build finished successfully.
)

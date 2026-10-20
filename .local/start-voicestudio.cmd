@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
set OMNIVOICE_TORCH_VARIANT=cpu
start "" "%~dp0VoiceStudioApp\VoiceStudio.exe"
endlocal

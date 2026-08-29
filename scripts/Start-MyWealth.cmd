@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-MyWealth.ps1" %*
if errorlevel 1 (
    echo.
    echo My Wealth stopped with an error. Press any key to close.
    pause >nul
)
endlocal
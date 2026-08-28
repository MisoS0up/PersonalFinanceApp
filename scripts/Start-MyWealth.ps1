param(
    [int]$Port = 8000,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$projectRoot = Split-Path -Parent $PSScriptRoot

function Find-Python {
    $commands = @("python", "py")
    foreach ($name in $commands) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }
    return $null
}

$python = Find-Python
if (-not $python) {
    Write-Host "Python was not found." -ForegroundColor Red
    Write-Host "Install Python from https://www.python.org/downloads/windows/ and enable 'Add Python to PATH'."
    Read-Host "Press Enter to close"
    exit 1
}

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Port $Port is already in use. Stop the existing server or run: .\Start-MyWealth.ps1 -Port 8001" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
}

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.AddressState -eq "Preferred" }

$address = $addresses |
    Where-Object {
        $_.IPAddress -match "^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $address) {
    $address = $addresses | Select-Object -First 1 -ExpandProperty IPAddress
}

Write-Host "My Wealth is ready" -ForegroundColor Green
Write-Host "This computer: http://localhost:$Port"
if ($address) {
    Write-Host "Same Wi-Fi:   http://$address`:$Port" -ForegroundColor Cyan
} else {
    Write-Host "LAN address could not be detected. Run Get-NetIPAddress -AddressFamily IPv4 if needed." -ForegroundColor Yellow
}
$tailscaleAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like "100.*" -and $_.AddressState -eq "Preferred" } |
    Select-Object -First 1 -ExpandProperty IPAddress
if ($tailscaleAddress) {
    Write-Host "Tailscale:    http://$tailscaleAddress`:$Port" -ForegroundColor Green
}
Write-Host "Keep this window open while using LAN sync. Press Ctrl+C to stop."

if ($OpenBrowser) {
    Start-Process "http://localhost:$Port"
}

& $python "$projectRoot\backend\server.py" --port $Port

param(
    [int]$Port = 8000,
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

try {
    Set-Location -LiteralPath $PSScriptRoot
    $projectRoot = Split-Path -Parent $PSScriptRoot

function Find-Python {
    $candidates = @(
        @{ Name = "py"; Path = (Get-Command py -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source) },
        @{ Name = "python"; Path = (Get-Command python -All -ErrorAction SilentlyContinue | Where-Object { $_.CommandType -in @('Application', 'ExternalScript') -and $_.Source -and $_.Source -notlike '*WindowsApps*' } | Select-Object -First 1 -ExpandProperty Source) }
    )

    foreach ($candidate in $candidates) {
        if ($candidate.Path) {
            return [pscustomobject]@{
                Name = $candidate.Name
                Path = $candidate.Path
            }
        }
    }

    return $null
}

$python = Find-Python
if (-not $python) {
    Write-Host "Python was not found or the Windows Store alias is active." -ForegroundColor Red
    Write-Host "Install Python from https://www.python.org/downloads/windows/ and enable 'Add Python to PATH'."
    Write-Host "If Windows shows the Microsoft Store alias, disable App execution aliases for Python in Settings > Apps > Advanced app settings."
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

Write-Host "Personal Finance App Server is ready" -ForegroundColor Green
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
    Write-Host "Tailscale:    http://$tailscaleAddress`:$Port"  -ForegroundColor Green
    Write-Host "Use the generated address in your phone browser (SERVER MUST BE RUNNING)" -ForegroundColor Green
}
Write-Host "Keep this window open while using LAN sync. Press Ctrl+C to stop."

if ($OpenBrowser) {
    Start-Process "http://localhost:$Port"
}

    $pythonArgs = @()
    if ($python.Name -eq "py") {
        $pythonArgs += "-3"
    }

    & $python.Path @pythonArgs "$projectRoot\backend\server.py" --port $Port
    if ($LASTEXITCODE -ne 0) {
        throw "The server stopped with exit code $LASTEXITCODE."
    }
}
catch {
    Write-Host "`nMy Wealth could not start:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nCheck the message above, then press Enter to close." -ForegroundColor Yellow
    Read-Host
    exit 1
}

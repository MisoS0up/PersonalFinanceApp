# My Wealth

My Wealth is an offline-first personal finance tracker for savings, expenses, budgets, wealth goals, and US investments. It runs locally in a web browser and can optionally sync data with other devices on the same Wi-Fi network or through Tailscale.

## Features

- Net worth dashboard for savings, investments, and expenses
- Savings accounts and transfers
- Expense tracking with account linking and history
- Monthly budget breakdown for needs, wants, savings, and investments
- Wealth goals with progress tracking
- US stock portfolio tracking with manually entered prices
- Offline browser storage with installable PWA support
- JSON export and import for backups and device transfers
- Optional LAN and Tailscale synchronization

## Requirements

- Windows
- Python 3
- PowerShell

During Python installation, enable **Add Python to PATH**.

## Quick Start

1. Open the `scripts` folder.
2. Double-click `Start-MyWealth.cmd`.
3. Open the displayed `localhost` address, or use the displayed LAN address on another device.
4. Keep the launcher window open while synchronization is needed.

The `.cmd` launcher uses a process-only PowerShell execution-policy bypass. This avoids changing the computer's permanent PowerShell policy.

To open the app automatically, run this from the project folder:

```powershell
.\scripts\Start-MyWealth.cmd -OpenBrowser
```

To use another port:

```powershell
.\scripts\Start-MyWealth.cmd -Port 8001 -OpenBrowser
```

Stop the server with `Ctrl+C` in the launcher window.

## Manual Start

```powershell
python backend\server.py
```

Then open `http://localhost:8000` in a browser.

## Project Structure

```text
backend/                 Python LAN sync server
 data/                   Shared sync data file
 docs/                   Detailed setup and usage guide
 frontend/               Browser app and PWA files
 scripts/                Windows startup launchers
```

## Documentation

See [docs/SETUP.md](docs/SETUP.md) for installation, LAN access, Tailscale access, backups, offline use, troubleshooting, and data rules.

## Security and Data

The app stores primary data in the browser's local storage. The optional sync server writes shared data to `data/sync-data.json` and has no login system or HTTPS. Use it only on a trusted private network or through a private Tailscale network. Do not expose the server directly to the public internet or forward its port from your router.

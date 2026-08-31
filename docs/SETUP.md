# My Wealth Setup Guide

This guide sets up the tracker on a fresh Windows computer and makes it available to devices on the same Wi-Fi network or through a private internet connection.

## 1. Install Python

1. Download Python 3 from https://www.python.org/downloads/windows/.
2. During installation, enable **Add Python to PATH**.
3. Open PowerShell and verify it:

```powershell
python --version
```

## 2. Copy the app

Copy the complete `Dans_Wealth` folder to the new computer. Keep these files together:

- `frontend\index.html`
- `frontend\app.js`
- `frontend\style.css`
- `frontend\manifest.json`
- `frontend\service-worker.js`
- `backend\server.py`
- `scripts\Start-MyWealth.ps1`

Do not copy `data\sync-data.json` unless you are intentionally restoring the shared LAN data file.

## 3. Start the local server

For plug-and-play startup, double-click `scripts\Start-MyWealth.cmd`. This starts PowerShell with a process-only execution-policy bypass, so it works on computers where the default policy blocks local scripts. The window stays open while the server is running and shows startup errors instead of closing immediately.

You can also run this from PowerShell in the app folder:

```powershell
.\scripts\Start-MyWealth.ps1 -OpenBrowser
```

The script checks for Python, detects the LAN address, checks that port `8000` is available, and starts the sync server. Keep its window open while using the app. Use `Ctrl+C` to stop it.

If you prefer to run the `.ps1` directly and PowerShell blocks it, run this once with:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then start the script again.

If Windows reports `Python was not found` and opens the Microsoft Store, the user is hitting the App execution alias instead of the actual Python install. Install Python from python.org, make sure **Add Python to PATH** is enabled, and disable the Python App execution alias in **Settings > Apps > Advanced app settings** if it is still enabled.

To use a different port:

```powershell
.\scripts\Start-MyWealth.ps1 -Port 8001 -OpenBrowser
```

The app address will then use that port.

### Manual startup

Open PowerShell in the app folder and run:

```powershell
python backend\server.py
```

Leave this window running while you want LAN access or syncing. The server listens on port `8000`.

Find the computer's Wi-Fi address:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'} | Select-Object InterfaceAlias,IPAddress
```

Use the address shown for Wi-Fi or Ethernet. For example:

```text
http://192.168.1.10:8000
```

If Windows Firewall asks, allow Python on **Private networks**.

## 4. Open and customize the app

Open the LAN address in a browser. Click the gear button to change the app name, for example `Alex's Wealth` or `Family Finance`.

The name is saved with the app data and is included in backups.

## 5. Move existing data

On the old computer or old app address:

1. Click the Export button (`⇩`).
2. Save the JSON backup file.
3. Open the new LAN address.
4. Click the Import button (`⇧`).
5. Select the JSON file and confirm the restore.

Import replaces the current browser data, so export first if the destination already contains information.

## 6. Use it on a phone

1. Connect the phone and computer to the same Wi-Fi.
2. Open the LAN address on the phone.
3. Use the browser menu and choose **Add to Home Screen**.
4. Load the app once while connected.
5. The app can then be used away from Wi-Fi.

Changes made offline are saved on the phone. When the phone reconnects to the same LAN server, pending changes upload automatically. The status text shows `Offline`, `Syncing...`, or `Synced`.

## 7. Use it away from home Wi-Fi

The simplest secure option is [Tailscale](https://tailscale.com/download), which creates a private encrypted network between your devices. It does not make this financial app public on the internet.

1. Install Tailscale on the computer and phone.
2. Sign in to the same Tailscale account on both devices.
3. Start My Wealth on the computer. The launcher prints a `Tailscale` address such as `http://100.x.y.z:8000`.
4. On the phone, while mobile data is enabled, open that Tailscale address.
5. Load the page once, then use the browser menu to choose **Add to Home Screen**.

Keep the computer awake, Tailscale running, and the `server.py` window open when you need synchronization. The phone can still read and edit its local copy when the computer is unavailable; changes upload the next time the Tailscale address is reachable.

Do not forward port `8000` on your router and do not use a public tunnel for this server without adding authentication and HTTPS first. The server has no login system.

## 8. Important data rules

- Data is stored locally in the browser and shared on the computer in `data\sync-data.json`.
- Keep `backend\server.py` running for synchronization.
- Do not edit the app on two devices while both are offline at the same time. The last device to reconnect can replace the earlier shared copy.
- Keep regular JSON exports in a private location.
- Anyone connected to the same local network can access the LAN address, so do not use this server on an untrusted public Wi-Fi network.
- Clearing browser data or using the Reset button can remove local data.
- The LAN server is not a public internet service and does not provide login or encryption.

## 9. Stop the server

Return to the PowerShell window running `server.py` and press `Ctrl+C`.

## Troubleshooting

### The phone cannot open the address

Confirm both devices are on the same Wi-Fi, the server is still running, and Windows Firewall allows Python on Private networks.

### The address changed

Run the IPv4 command again. Home routers may assign a different local address after reconnecting.

### The app shows old files

Open the app once while online so the service worker can cache the shell. After an update, close the installed app completely and reopen the address; the service worker will replace its cache automatically. A normal refresh while offline should then reopen the cached app shell.

### Refresh says the page is unreachable while offline

Confirm the app was opened successfully over `http://` at least once and was added to the Home Screen. Opening the HTML file directly with `file://` cannot install a service worker. If the browser still has an old broken cache, remove the Home Screen shortcut, open the app online once, and add it again.

### Data does not appear on a new device

Import an Export backup into the new device, or open the app through the LAN address and wait for the `Synced` status.

## 10. iPhone Shortcut (Add expense without opening website)

You can create an iOS Shortcut that asks for an expense name, amount, and account, then posts directly to `http://<your-ip-or-tailscale>:8000/api/expenses`.

### Shortcut actions:

1. **Ask for Input**: "Expense item name?" (Text)
2. **Ask for Input**: "Amount (₱)?" (Number)
3. **Get Contents of URL**: `http://<your-ip-or-tailscale>:8000/api/accounts`
4. **Choose from List**: Choose from *Contents of URL* (prompt: "Pay from account?")
5. **Get Contents of URL**:
   - URL: `http://<your-ip-or-tailscale>:8000/api/expenses`
   - Method: **POST**
   - Request Body: **JSON**
   - Fields:
     - `name`: Provided Input (Text from step 1)
     - `amount`: Provided Input (Number from step 2)
     - `account`: Chosen Item (from step 4)
6. **Show Notification**: "Saved expense!"


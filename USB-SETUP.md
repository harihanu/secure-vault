# Secure Vault - USB Setup Guide

## Quick Start (Any Device)

### Windows
1. Double-click `start-vault.bat`
2. If it closes immediately, right-click → "Run as administrator"
3. Or open Command Prompt, navigate to the folder, and run: `start-vault.bat`
4. Open browser to `http://localhost:2134`

### Mac/Linux
1. Open terminal in this folder
2. Run: `chmod +x start-vault.sh && ./start-vault.sh`
3. Open browser to `http://localhost:2134`

---

## What's on Your USB

```
USB Drive
├── start-vault.bat      ← Windows setup script
├── start-vault.sh       ← Mac/Linux setup script
├── USB-SETUP.md         ← This file
├── index.html           ← Vault application
├── scripts\             ← JavaScript files
├── styles\              ← CSS files
├── workers\             ← Web Workers
└── vault-backup.vault   ← Your encrypted vault data
```

---

## Requirements

| Device | Requirement |
|--------|-------------|
| **Windows** | Node.js (https://nodejs.org) |
| **Mac** | Node.js or Homebrew (`brew install node`) |
| **Linux** | Node.js (`sudo apt install nodejs npm`) |

---

## First-Time Setup on New Device

1. **Install Node.js** (if not installed)
   - Download from: https://nodejs.org
   - Choose LTS version
   - Run installer

2. **Run the setup script**
   - Windows: Double-click `start-vault.bat`
   - Mac/Linux: `./start-vault.sh`

3. **Import your vault**
   - Open `http://localhost:2134`
   - Click "Create Vault" (or find Import)
   - Select your `vault-backup.vault` file
   - Enter your master password
   - Done!

---

## Daily Use

1. Plug in USB
2. Run `start-vault.bat` (Windows) or `./start-vault.sh` (Mac/Linux)
3. Open `http://localhost:2134`
4. Enter master password + 2FA code (if enabled)

---

## Backup Your Vault

1. Open vault at `http://localhost:2134`
2. Go to Settings → Export Vault
3. Save `.vault` file to USB

---

## Security Notes

- Your `.vault` file is **encrypted** — safe to store anywhere
- Never share your master password
- Store recovery codes in a separate safe location
- The vault only works on `http://localhost:2134` (not `file://`)

---

## Troubleshooting

**"Node.js not found"**
- Install Node.js from https://nodejs.org

**"Port 2134 already in use"**
- Close other programs using port 2134
- Or change port in the script

**"Vault not saving"**
- Make sure you're using `http://localhost:2134`
- Don't open `index.html` directly (use `file://`)

**"2FA not working"**
- Check your authenticator app time is synced
- Use recovery codes if needed

---

## Need Help?

- Check the browser console (F12) for errors
- Make sure Node.js is installed
- Try a different browser (Chrome recommended)

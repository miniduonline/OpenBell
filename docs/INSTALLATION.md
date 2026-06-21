# Installation Guide

## For End Users

1. Go to the [Releases](https://github.com/openbell/openbell/releases) page.
2. Download the installer for your platform:
   - Windows: `OpenBell-Setup-x.x.x.exe`
   - macOS: `OpenBell-x.x.x.dmg`
   - Linux: `OpenBell-x.x.x.AppImage` or `.deb`
3. Run the installer and follow the on-screen steps.
4. Launch OpenBell from your applications menu / Start menu.

## For Developers

### Prerequisites

- Node.js 18+ and npm
- Git
- Build tools for native modules:
  - Windows: `windows-build-tools` (or Visual Studio Build Tools)
  - macOS: Xcode Command Line Tools
  - Linux: `build-essential`, `libsqlite3-dev`

### Steps

```bash
git clone https://github.com/openbell/openbell.git
cd openbell
npm install
npm run dev
```

The app will open automatically once the Vite dev server is ready.

### First Run

On first launch, OpenBell creates its SQLite database under your OS user-data folder:

- Windows: `%APPDATA%/OpenBell/data/openbell.db`
- macOS: `~/Library/Application Support/OpenBell/data/openbell.db`
- Linux: `~/.config/OpenBell/data/openbell.db`

Sample schedules and sounds can be loaded by running the SQL in `sample-data/seed.sql` against this database.

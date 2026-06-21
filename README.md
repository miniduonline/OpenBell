# 🔔 OpenBell

**OpenBell** is a modern, cross-platform, open-source **School Bell Management System** built for schools, colleges, universities, training institutes, and offices. It automates bell ringing on a configurable schedule, with holiday awareness, multi-language support, and a clean, professional dashboard.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)
![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F)

---

## ✨ Features

- 📊 **Modern Dashboard** — real-time clock, today's upcoming bells, system status
- 🌗 **Light & Dark Mode**
- 🔔 **Bell Schedule Management** — weekly schedules, multiple bells per day, drag & drop editor
- 🎵 **Bell Audio Management** — upload MP3/WAV, preview, per-sound volume control
- 📅 **Holiday Management** — school holidays, public holidays, exceptions, CSV import
- ⚙️ **Automation Engine** — background scheduler, auto-start with OS, error recovery, event logging
- 📈 **Reports** — bell history, system logs, CSV/PDF export
- 💾 **Backup System** — automatic & manual backups, one-click restore
- 🌐 **Multi-language** — English, Sinhala (සිංහල), Tamil (தமிழ்)
- ⌨️ **Keyboard shortcuts**, notifications, and accessible UI

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron |
| UI | React + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Database | SQLite (better-sqlite3) |
| Scheduler | node-cron |
| Packaging | electron-builder |

## 📁 Project Structure

```
openbell/
├── electron/              # Electron main process (Node.js side)
│   ├── main.ts
│   ├── preload.ts
│   ├── database/          # SQLite schema & connection
│   └── services/          # scheduler, audio player, backup, logger
├── src/                   # React renderer (frontend)
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── store/              # Zustand store
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── i18n/               # en / si / ta translations
├── sample-data/            # demo seed SQL
├── docs/                   # install / build / deploy guides
└── .github/                # issue & PR templates, CI workflow
```

## 🚀 Quick Start

```bash
git clone https://github.com/openbell/openbell.git
cd openbell
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron app pointed at it.

### Build a production installer

```bash
npm run build
npm run build:win     # Windows installer (.exe)
npm run build:mac     # macOS (.dmg)
npm run build:linux   # Linux (AppImage / .deb)
```

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md), [`docs/BUILD.md`](docs/BUILD.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full details.

🇱🇰 **සිංහල භාෂාවෙන් ස්ථාපන උපදෙස් සඳහා** [`INSTALL_SINHALA.md`](INSTALL_SINHALA.md) බලන්න.

## 🗄 Database Schema

OpenBell uses SQLite with six core tables: `schedules`, `sounds`, `holidays`, `logs`, `settings`, `backups`. Full schema: [`electron/database/schema.sql`](electron/database/schema.sql).

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before submitting a pull request.

## 📜 License

OpenBell is released under the [MIT License](LICENSE).

## 🙏 Acknowledgements

Built with ❤️ for educational institutions everywhere.

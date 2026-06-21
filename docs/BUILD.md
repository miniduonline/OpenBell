# Build Instructions

## Development Build

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build          # compiles renderer (Vite) + main process (tsc)
```

Output:
- Renderer bundle → `dist/`
- Compiled Electron main/preload → `dist-electron/`

## Packaging Installers

OpenBell uses `electron-builder`, configured in `package.json` under the `build` key.

```bash
npm run build:win      # produces NSIS installer (.exe)
npm run build:mac      # produces .dmg
npm run build:linux    # produces AppImage and .deb
```

Packaged installers are written to the `release/` directory.

### Code Signing (optional, recommended for distribution)

- **Windows**: set `CSC_LINK` and `CSC_KEY_PASSWORD` environment variables to your `.pfx` certificate.
- **macOS**: set `CSC_LINK`, `CSC_KEY_PASSWORD`, and configure notarization credentials (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`).

### Native Module Rebuild

`better-sqlite3` is a native module. If you switch Node/Electron versions, rebuild it:

```bash
npx electron-builder install-app-deps
```

## Running Tests

```bash
npm run test       # one-off run
npm run test:watch # watch mode
```

## Linting & Formatting

```bash
npm run lint
npm run format
```

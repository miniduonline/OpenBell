# Contributing to OpenBell

Thank you for considering a contribution to OpenBell! 🎉

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Run the dev environment: `npm run dev`
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development Guidelines

- **TypeScript strict mode** is enabled — please keep types accurate, avoid `any`.
- Run `npm run lint` and `npm run format` before committing.
- Write unit tests for new services/utilities (`npm run test`).
- Keep components small and composable; place shared logic in `src/hooks` or `src/utils`.
- Database changes must update `electron/database/schema.sql` and be backward compatible where possible.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add drag-and-drop schedule reordering
fix: correct holiday date range check in scheduler
docs: update installation guide
```

## Pull Requests

- Reference any related issue (`Closes #123`).
- Describe what changed and why.
- Include screenshots/GIFs for UI changes.
- Ensure CI checks (lint, build, test) pass.

## Reporting Bugs / Requesting Features

Please use the issue templates under `.github/ISSUE_TEMPLATE/`.

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). Be kind and respectful.

## Translations

We welcome new language translations! Add a new file under `src/i18n/locales/<lang>.json` following the structure of `en.json`, and register it in `src/i18n/index.ts`.

Happy coding! 🔔

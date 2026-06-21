# Deployment Guide

OpenBell is a desktop application; "deployment" means distributing signed installers and keeping institutions updated.

## 1. Versioning

Follow [Semantic Versioning](https://semver.org/). Bump `version` in `package.json` before tagging a release.

## 2. Release Process

```bash
git tag v1.0.0
git push origin v1.0.0
```

The CI workflow (`.github/workflows/ci.yml`) lints, type-checks, and builds on every push. For full release automation, extend the workflow with an `electron-builder --publish always` step triggered on tag pushes, using `GH_TOKEN` to publish installers to GitHub Releases.

## 3. Updates

As of v1.9.0, OpenBell does **not** auto-download or auto-install updates in-app. The "Check for Updates" button on the Settings page simply opens the project's GitHub releases page in the user's browser, so they can read the changelog and grab a new installer manually if they want it.

When publishing a new release:

1. Bump `version` in `package.json` and build installers with `npm run build:win` / `build:mac` / `build:linux`.
2. Upload the installers to a new GitHub Release on the `miniduonline/OpenBell` repo (the URL the in-app button links to).
3. There is no `latest.yml`/feed file to maintain anymore — installers can simply be attached to the release.

## 4. Institutional Rollout

For schools deploying to multiple lab/office PCs:

- Use the Windows `.exe` silent install flag: `OpenBell-Setup.exe /S`
- Pre-seed `sample-data/seed.sql` into the database before mass deployment if a shared starting schedule is desired.
- Consider Group Policy / MDM software distribution for large fleets.

## 5. Backups in Production

Enable automatic backups (Settings → General) and periodically copy the `backups/` folder to network storage or cloud sync for disaster recovery.

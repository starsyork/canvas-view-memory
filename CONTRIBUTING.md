# Contributing to Canvas View Memory

## Build and test

Requires Node.js and npm.

```sh
npm ci
npm test
npm run build
npm run package
```

`npm run dev` rebuilds `main.js` on source changes. After copying a build into
a test vault, disable and re-enable the plugin to load changes. The package
command requires `zip` and creates an installable folder and ZIP under `dist/`.

## Test in Obsidian

```sh
npm run build
node scripts/prepare-live-vault.mjs
```

Open the generated `test-vault` folder as a vault in Obsidian, enable community
plugins and Canvas View Memory there, and enable the command line interface in
Obsidian's general settings. Then run:

```sh
node scripts/live-test.mjs
```

The runner uses the bundled macOS CLI by default. Set `OBSIDIAN_CLI` to a CLI
executable path on other installations. It refuses to run outside this project's
test vault. Results are written to `live-test-results/latest.json`. The runner
exercises the real Canvas implementation but does not synthesize mouse gestures.

Before release, manually check panning and fractional zoom after switching
tabs, closing and reopening a canvas, and restarting Obsidian. Also check
same-tab navigation, multiple panes, background tabs, canvas and folder renames,
screenshot export, and behavior after disabling and re-enabling the plugin.
Repeat compatibility checks after Obsidian updates and with other Canvas plugins.

Canvas viewport controls are not part of Obsidian's published TypeScript API.
The guarded internal methods and removable instance patches are in
`src/canvas.ts`; view lifecycle and persistence are in `src/main.ts`.

## Release

1. Confirm the public author name in `manifest.json` and `LICENSE`.
2. Run the tests and build, then commit the source, `README.md`, `LICENSE`,
   `manifest.json`, lockfile, and `versions.json` to a public GitHub repository.
3. Create a GitHub release whose tag exactly matches the manifest version (for
   example, `0.1.0`). Attach `main.js` and `manifest.json` as separate assets.
   The ZIP is only a convenience for manual installation.
4. Follow Obsidian's [plugin submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)
   to submit the repository for review and address any feedback.

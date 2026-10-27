# Canvas View Memory

Pick up where you left off in an Obsidian canvas. This plugin remembers each
canvas's last center position and zoom, then restores them when you reopen it.
There are no settings to configure.

**Status:** desktop release candidate. Type checking, ten mocked lifecycle tests,
and eight checks inside real Obsidian 1.13.7 on macOS pass. Live checks cover
switching files, closing/reopening, plugin reload, disk persistence, and app-window
reload. Manual pan/zoom testing was also reported successful. Mobile, full process
restart, and compatibility with other Canvas plugins remain unverified. This
release is marked desktop-only until mobile testing is complete.

## Install for personal use

1. Unzip `dist/canvas-view-memory.zip`.
2. Copy the extracted `canvas-view-memory` folder into your vault's
   `.obsidian/plugins/` folder. Create `plugins` if it does not exist. If your
   vault uses a custom configuration folder, use that instead of `.obsidian`.
3. Restart Obsidian, then open **Settings → Community plugins**. Enable community
   plugins if prompted and turn on **Canvas View Memory**.
4. Open a canvas, pan and zoom, open a different note, then reopen the canvas.

On macOS, press **Command+Shift+.** in Finder to show the hidden `.obsidian` folder.
This version requires desktop Obsidian 1.13.7 or newer; older versions are unverified.

## Behavior

- Saves a separate viewport for every `.canvas` file.
- Restores fractional coordinates and the canvas's exact native zoom value.
- Captures the outgoing view when changing tabs, loading another file in the same
  tab, or closing a canvas; also samples visible canvases every 200 milliseconds.
- Writes changed positions at most once per 500 milliseconds, with serialized
  writes so an earlier save cannot overwrite a newer one.
- Moves saved entries when a canvas or its parent folder is renamed.
- Removes entries for deleted canvases and folders.
- Leaves a new canvas's first view to Obsidian. Once visited, its view is remembered.
- With the same canvas open in multiple panes, each existing pane keeps its own
  viewport; the last observed movement becomes the saved view for reopening.
- Adds **Canvas View Memory: Remember current canvas view** to the command palette.

Positions are saved in the plugin's `data.json` inside the vault configuration
folder. Canvas documents are not modified. The plugin makes no network requests.
If your sync tool synchronizes plugin data, it may also synchronize these views;
there is no device-specific conflict resolution in this version.

The saved center and zoom are restored. A different window size naturally shows
a different amount of canvas around that center. Sudden app termination can lose
the most recent unsaved movement. Canvas screenshot exports are excluded from
capture while Obsidian reports that an export is in progress.

## Develop

Requires Node.js and npm.

```sh
npm ci
npm test
npm run build
npm run package
```

`npm run dev` rebuilds `main.js` on source changes. After copying the build into a
test vault, disable and re-enable the plugin to load changes. `npm run package`
requires the `zip` command and produces both an installable folder and ZIP under
`dist/`.

### Repeat tests in real Obsidian

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
executable path on other installations. It refuses to run unless the target is
this project's test vault. It moves the test canvases, switches files, closes a
tab, reloads the plugin, reads saved data, and reloads the test-vault window.
Results are written to `live-test-results/latest.json`. This exercises the real
Canvas implementation through JavaScript in the app; it does not synthesize mouse
gestures. Manual interaction testing complements these numeric assertions.

- `src/main.ts`: view lifecycle, capture, restoration, and persistence.
- `src/canvas.ts`: guarded access to internal Canvas APIs.
- `src/state.ts`: validation and path migrations.
- `tests/plugin.test.ts`: lifecycle regression checks using a mocked Obsidian host.

Canvas viewport controls are not part of Obsidian's published TypeScript API.
This plugin uses guarded internal methods and removable instance patches via
`monkey-around`. An incompatible Canvas view is skipped with a notice. Check
compatibility after Obsidian updates and alongside other Canvas plugins.

## Live acceptance checks before release

Use a test vault first:

- Pan and zoom canvas A; switch to a note and back, then close and reopen A.
- Switch between canvases A and B in the same tab, including back/forward history.
- Quit and reopen Obsidian after leaving a canvas at a fractional zoom.
- Open A in two panes, move one, close the other, then reopen A.
- Rename a canvas and its parent folder; reopen it and confirm the view follows.
- Open a saved canvas in a background tab, then activate it.
- Export a screenshot and verify that it does not change the remembered viewport.
- Disable the plugin, verify normal Canvas behavior, then re-enable it.
- Repeat on mobile and with any installed Canvas plugins before claiming support.

## Publish later

1. Complete the desktop live checks above and choose the public author name in
   `manifest.json` and `LICENSE`.
2. Create a public GitHub repository containing the source, README, MIT license,
   manifest, lockfile, and `versions.json`.
3. Run the tests and build. Create a GitHub release tagged with the exact manifest
   version, for example `0.1.0` (no `v` prefix). Attach `main.js` and `manifest.json`
   individually. The ZIP is only a convenience for manual installation.
4. Follow Obsidian's [current plugin submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin):
   sign into the Community directory, link your GitHub account, and submit the
   repository for review. Verify that the plugin ID is available and address the
   review feedback before publishing.

Nothing in this project publishes or uploads the plugin automatically.

## License

MIT. The bundled `monkey-around` dependency is ISC licensed (by PJ Eby).

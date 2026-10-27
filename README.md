# Canvas View Memory

Return to an Obsidian canvas where you left it. Canvas View Memory saves the
center position and zoom for each canvas and restores that view when you reopen
it. There are no settings to configure.

## Install

Once published, install **Canvas View Memory** from **Settings → Community
plugins** in Obsidian. Until then, you can install it manually:

1. Download `main.js` and `manifest.json` from the same GitHub release, or run
   `npm run package` from this repository and use the folder it creates in `dist/`.
2. Put both files in your vault's `.obsidian/plugins/canvas-view-memory/` folder.
   If your vault uses a custom configuration folder, use that instead of
   `.obsidian`.
3. Restart Obsidian and enable **Canvas View Memory** under **Community plugins**.

Requires desktop Obsidian 1.13.7 or newer. Mobile support has not been tested.

## How it works

Open a canvas, pan or zoom, then leave and reopen it. The plugin remembers a
separate view for each canvas. You can also use **Canvas View Memory: Remember
current canvas view** in the command palette to save immediately.

Saved views follow canvases when you rename or move them within the vault, and
are removed when you delete them. A new canvas uses Obsidian's normal initial
view. If the same canvas is open in multiple panes, the last observed movement
is the view saved for the next time you open it.

Views are stored in this plugin's `data.json` in your vault configuration folder.
The plugin does not edit your `.canvas` files or make network requests. If you
sync plugin data, saved views may sync across devices; this version does not
resolve conflicts between devices. A different window size may show a different
amount of canvas around the saved center.

Canvas viewport controls are internal Obsidian APIs. An Obsidian update or
another Canvas plugin may affect compatibility. If an incompatible Canvas view
is encountered, this plugin skips restoring it and shows a notice.

## Development

Requires Node.js and npm. Run `npm ci`, `npm test`, and `npm run build`. See
[CONTRIBUTING.md](CONTRIBUTING.md) for real-app testing and release steps.

## License

MIT. The bundled `monkey-around` dependency is ISC licensed (by PJ Eby).

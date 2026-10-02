# Spotlight EX by [Maru](https://marumimamori.me/)

Browse notes, images, and PDFs in an Obsidian Base and edit their properties in a dedicated sidebar.

**Current version:** `0.1.8`

**Original creator:** This is an expanded fork of [Obsidian Bases Spotlight View](https://github.com/mymindstorm/obsidian-bases-spotlight-view) by **Brendan Early / [mymindstorm](https://github.com/mymindstorm)**. The original MIT license and copyright notice are preserved.

---

## Features

- **Spotlight browsing:** a large preview beside a property sidebar, with Previous/Next navigation and arrow keys.
- **Notes, images, and PDFs:** preview files directly from the current Base results.
- **Typed property editing:** Text, List, Tags, Number, Checkbox, Date, and Date & time editors.
- **Additional native pickers:** File, Folder, and Property editors when supported by your installed Obsidian version.
- **Real multi-value properties:** each List/Tags value has its own chip and remove button, while frontmatter stays a YAML array.
- **Continuous entry:** press Enter or choose a suggestion to save a value and keep the input ready for the next one.
- **Suggestions:** choose values from the whole vault or the current Base results, including file suggestions for wikilinks.
- **Live synchronization:** property edits and type changes update the sidebar while preserving unfinished input.
- **Property type icons:** shown by default; click an editable icon to change its shared Obsidian property type.
- **Flexible layout:** fields grow with content, the sidebar can be resized, and properties can be reordered or given a saved minimum height.
- **Attachment companion notes:** use `filename.ext.md` sidecars to store properties for images and PDFs.
- **Individual setting resets:** restore any setting's default using the arrow beside it.
- **Original creator attribution:** included in the README, bundled notices, source, and Credits & License tab.

## Install With BRAT

1. Install **Obsidian42 - BRAT** from Obsidian's Community Plugins.
2. Open the command palette.
3. Run **BRAT: Add a beta plugin for testing**.
4. Enter `https://github.com/marumimamori/spotlight-ex`.
5. Choose the latest version, let BRAT install it, and enable **Spotlight EX** under **Settings > Community plugins**.

[BRAT documentation](https://tfthacker.com/BRAT) explains installation and automatic updates.

> [!NOTE]
> This fork was **vibecoded** with AI assistance.

### Manual Installation

1. Download the install ZIP from the [latest release](https://github.com/marumimamori/spotlight-ex/releases/latest), or download `main.js`, `manifest.json`, and `styles.css` individually.
2. Create `<Vault>/.obsidian/plugins/bases-spotlight-view-expanded/`.
3. Extract the ZIP into that folder, or copy the three plugin files into it.
4. Reload Obsidian and enable **Spotlight EX** under **Settings > Community plugins**.

The ZIP also includes the license, attribution, and documentation.

## Requirements

- **Obsidian 1.10.0 or newer**, with the core **Bases** plugin enabled.
- A `.base` file containing the files you want to browse.
- Optional: **Obsidian42 - BRAT** for installation and updates.

The original Spotlight plugin is not required. This fork has its own plugin ID and view type, so both can be installed together.

## Information

### Configure A Base

1. Enable **Bases** under **Settings > Core plugins** and **Spotlight EX** under **Settings > Community plugins**.
2. Open an existing `.base` file, or run **Bases: Create new base** from the command palette.
3. Click the view name at the top left and choose **Add view**. Give it a name and select **Spotlight EX** as its layout.
4. To change an existing view, click the arrow beside its name in that menu, or right-click the view name. Choose **Spotlight EX** under **Layout**.
5. Use **Properties** in the Base toolbar to choose the fields shown in the sidebar. Use **Filter** to limit the files and **Sort** to set their navigation order.
6. Open the view settings again to choose **Spotlight Content Property** and **Hyperlink Property**, if needed. See [Base View Options](#base-view-options) below.

These instructions are also available under **Settings > Spotlight EX > Setup**. Obsidian's [Views guide](https://help.obsidian.md/bases/views) explains the Base toolbar and view settings.

Use **Previous**, **Next**, or the arrow keys to move through results. Arrow keys inside property editors remain available for editing. If the Base is empty, check its filters.

The center pane previews the selected file. The sidebar shows the properties configured for that Base view.

### Property Editing

| Property type | Editor |
| --- | --- |
| Text | Growing textarea; Enter saves, Shift+Enter adds a line break |
| List | Separate value chips, per-value removal, and suggestions |
| Tags | Separate tag chips and suggestions; an optional displayed `#` |
| Number | Numeric input, including decimals |
| Checkbox | Checkbox with an empty, true, or false state |
| Date | Date input |
| Date & time | Date and time input |
| File, Folder, Property | Native Obsidian picker when available |
| Complex YAML object | Read-only display |

Press Enter or **Add** to commit a List/Tags value. The input remains open for the next value. A first click into an inactive Spotlight pane activates it without taking focus from the selected editor.

Normal wikilinks such as `[[Sample]]` use their link labels. Embed text such as `![[Sample]]` stays literal, matching Obsidian's Properties view. Stored strings are preserved.

### Property Types And Synchronization

Property type icons and labels are enabled by default. Changing an editable type through its icon updates the vault-wide Obsidian type. Changes made in Obsidian's Properties view also update Spotlight.

Tags, Aliases, and CSS classes keep their reserved native types. Changing a property's type does not silently convert incompatible existing values. Those values are shown for reference until you replace them. If a type changes while you are typing, unfinished input is retained under **Unfinished value from the previous type**.

Unfocused properties can sync while a different property has a draft. Saves are queued so rapid additions retain earlier values and concurrent metadata edits.

### Layout And Settings

Drag a property name to reorder it. Resize the sidebar using its divider, or resize a property using the handle beneath it. A saved property height acts as a minimum; additional content can still expand the field.

Empty-value dashes and checkboxes align beneath their type icons using the icons' measured size and position. Type icons have a darker box normally and a lighter hover state.

Open **Settings > Spotlight EX**. **General** controls editing preferences and defaults, **Setup** explains how to configure a Base, and **Credits & License** preserves the original attribution. Every General setting has a reset arrow; hover to see the default, then click to restore that setting.

Layout, visible properties, filters, sorting, and the preview options below are configured separately for each Base view using its toolbar.

| Setting | Default |
| --- | --- |
| Always show remove × buttons | On |
| Show “+ Add value” | On |
| Prevent duplicate list values | On |
| Suggestion source | Whole vault |
| Maximum suggestions | 12 |
| Display # for Tags | On |
| Show property type icons and labels | On |
| Create sidecars for attachments | On |
| Default sidebar width | 330 pixels |

### Base View Options

- **Spotlight Content Property:** choose a property containing a normal `[[wikilink]]` to the file you want in the preview. Leave it empty to preview the current Base entry.
- **Hyperlink Property:** choose a displayed property that opens the current Base entry when clicked.

---

## Examples

### Add Several List Values

For a List property named `related`, add `Architecture`, press Enter, and then add `Panorama`. Spotlight displays two removable chips and stores a real array:

```yaml
related:
  - Architecture
  - Panorama
```

### Use Wikilinks And Tags

Wikilinks remain strings inside their array. Tag values can be displayed with a `#` without rewriting the stored values just for display:

```yaml
related:
  - "[[Sample]]"
  - "![[Sample]]"
tags:
  - photography
  - architecture
```

The first `related` value appears as a clickable link label. The second appears as the complete literal embed text.

### Edit Attachment Properties

An image called `Sample.jpg` can use `Sample.jpg.md` as its companion note. The image stays in the preview while property edits are stored in that Markdown sidecar. Automatic sidecar creation can be disabled in settings.

### Change A Property Type

Click a property's type icon and select **Date**. Spotlight switches to a date editor, and Obsidian sees the same shared type. If the property's previous value does not fit Date, it remains available for reference until you enter a replacement.

## Notice

- Standard editors, continuous entry, synchronization, formatting, and appearance changes are exercised in the included browser regression fixture with in-memory test metadata.
- Obsidian's native property widget registry is an internal API. Native type integration and optional File/Folder/Property pickers can need adjustments after Obsidian updates.
- The plugin was developed in English. Please report bugs with reproducible steps and your Obsidian version through [GitHub Issues](https://github.com/marumimamori/spotlight-ex/issues).

## Original Creator And Thanks

Thank you to **Brendan Early / [mymindstorm](https://github.com/mymindstorm)** for creating [Obsidian Bases Spotlight View](https://github.com/mymindstorm/obsidian-bases-spotlight-view) and releasing it under the MIT License.

The original plugin supplied the Spotlight layout, file previews, navigation, sidecar workflow, content property options, and property layout controls. This expanded fork builds on that work with typed editing, multi-value chips, continuous input, suggestions, live type/value synchronization, and additional settings.

The expanded fork is maintained by [Maru](https://marumimamori.me/). It is an independent derivative; no endorsement by the original creator is implied. See [NOTICE.md](NOTICE.md) and [UPSTREAM.md](UPSTREAM.md) for the attribution and upstream basis.

## Beta Notes

This plugin is still in beta. BRAT is the recommended distribution path while it is tested with real vaults before any wider Obsidian Community Plugin submission.

The plugin was renamed to **Spotlight EX** in version `0.1.8`. Its internal plugin ID and saved view type remain `bases-spotlight-view-expanded` for compatibility, so existing settings and `.base` views continue working. Keep the existing plugin folder when updating, including its `data.json`. New manual installs also use the folder named in [Manual Installation](#manual-installation). The current BRAT repository is `marumimamori/spotlight-ex`.

There is no telemetry in the plugin.

## License

Spotlight EX is free software licensed under **MIT**.

The original **Copyright (c) 2026 Brendan Early** notice and complete MIT permission notice are preserved in [LICENSE](LICENSE), included in release downloads, and displayed in **Credits & License**. Keep those notices when redistributing the plugin or a modified version.

## Development

The build uses Node.js and has no third-party build dependencies. The release workflow uses Node.js 24.

Build and check the plugin:

```bash
npm run build
npm run check
npm run verify-release
```

`src/main.js` is the editable source. The build copies it to `main.js` and prepares the manual-install files in `release/`.

Run the browser regression fixture:

```bash
node tests/serve.mjs
```

Open the printed local URL and choose **Run regression tests**. The fixture uses the real plugin code and stylesheet with an in-memory Obsidian adapter; it does not modify vault files.

For a future release, update the versions in `manifest.json` and `package.json`, add the version to `versions.json`, and update this README and [CHANGELOG.md](CHANGELOG.md). Build and verify the release, then push a matching tag such as `0.1.9` without a leading `v`. GitHub Actions publishes the BRAT files, license, attribution notice, and install ZIP.

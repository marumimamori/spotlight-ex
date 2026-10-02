# Changelog

## 0.1.8 — 2026-10-02

- Rename the plugin, layout, repository, and current documentation to Spotlight EX.
- Add a Setup tab in plugin settings with Base creation, layout selection, properties, filters, sorting, and preview configuration instructions.
- Expand the repository's Base setup guide and explain per-view options versus global settings.
- Keep the persisted plugin ID and view type so existing settings and Base views continue working.
- Preserve Brendan Early / mymindstorm's original creator attribution and MIT license.

## 0.1.7 — 2026-10-02

- Restore the darker rounded box, border, and shadow around property type icons, with a lighter hover state using theme button colors.
- Keep the adaptive icon/value alignment and native icon-button behavior.

## 0.1.6 — 2026-10-02

- Align empty dashes and checkboxes using the icon's actual rendered dimensions and position instead of a fixed width.
- Recalculate alignment when theme sizing, fonts, or layout change, preserving active controls.
- Use Obsidian's native clickable-icon class so type icons are styled as icon buttons.
- Add coverage for 30px, 38px, and 52px icon widths, theme offsets, and changing appearance without a reload.

## 0.1.5 — 2026-10-02

- Center empty-value dashes and checkboxes beneath their property type icons using a shared column width.
- Align checkbox labels with property names while retaining the compact layout when type icons are hidden.

## 0.1.4 — 2026-10-02

- Add a reset arrow beside every General setting, with its default shown in the tooltip.
- Reset individual settings without changing other saved preferences; support mouse and keyboard activation.
- Apply saved or reset sidebar widths to open Spotlight views immediately.

## 0.1.3 — 2026-10-02

- Enable property-type display by default and use Obsidian's native icons beside property names.
- Click an editable type icon to change the vault-wide type in Obsidian; reserved Tags, Aliases, and CSS classes retain their native types.
- Read the live assigned widget/type, rather than a nonexistent registry field or a startup-only type snapshot.
- Listen for native type changes, metadata updates, and external `types.json` updates; refresh other fields while preserving active drafts.
- Replace editors immediately when types change, preserve unfinished values in a disclosure, and reject queued writes that no longer match the type.
- Support every standard property editor and use native File, Folder, and Property widgets when available.
- Preserve decimal numbers, date/time seconds, timezone-aware display, empty values, and indeterminate checkboxes.
- Show incompatible existing values without rewriting them during a type change.

## 0.1.2 — 2026-10-02

- Match native Properties formatting for embed values such as `![[adssa]]`: keep the complete literal text instead of turning it into a normal link label.
- Preserve normal wikilink labels, aliases, and per-value removal; keep stored YAML strings unchanged.
- Add browser regression checks for embed display and add/remove behavior.

## 0.1.1 — 2026-10-01

- Keep List/Tags entry open and focused after Enter, Add, or choosing a suggestion.
- Preserve drafts and focused controls during metadata saves and Base updates.
- Activate an inactive Spotlight pane on the first click without stealing editor focus.
- Queue metadata writes and update arrays from current frontmatter so rapid additions do not overwrite earlier values.
- Grow property fields with content and Add Value controls; wrap long labels and auto-size textareas.
- Treat saved manual field heights as minimums instead of clipping additional content.
- Build the installable plugin directly from its source and add browser regression coverage.

## 0.1.0 — 2026-10-01

Initial expanded fork release.

- New plugin/view ID so it can coexist with the upstream plugin.
- Type-aware editors for Text, List, Tags, Number, Checkbox, Date and Date & time properties.
- Real YAML arrays for List/Tags values instead of JSON/text flattening.
- Per-value chips with one-click `×` removal.
- Add-value editor with vault/Base suggestions and wikilink-aware file suggestions.
- Clickable wikilinks inside list chips.
- Attachment/PDF sidecar metadata support.
- Dual-pane preview, Previous/Next and arrow-key navigation.
- Property reorder and height resizing.
- General and Credits & License settings sub-tabs.
- Preserved upstream MIT license and explicit attribution to Brendan Early / mymindstorm.

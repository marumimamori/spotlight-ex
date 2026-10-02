/*
 * Spotlight EX
 *
 * Derived from "Obsidian Bases Spotlight View" by Brendan Early (mymindstorm):
 * https://github.com/mymindstorm/obsidian-bases-spotlight-view
 *
 * Original project and this derivative are distributed under the MIT License.
 * See LICENSE and NOTICE.md.
 */

const {
  Plugin,
  BasesView,
  MarkdownRenderer,
  TFile,
  PluginSettingTab,
  Setting,
  Notice,
  Menu,
  setIcon,
} = require('obsidian');

// Persisted identifier: retain it so existing Base views survive the branding change.
const VIEW_TYPE = 'bases-spotlight-view-expanded';
const REPOSITORY_URL = 'https://github.com/marumimamori/spotlight-ex';
const UPSTREAM_URL = 'https://github.com/mymindstorm/obsidian-bases-spotlight-view';

const ORIGINAL_MIT_LICENSE = `MIT License

Copyright (c) 2026 Brendan Early

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const DEFAULT_SETTINGS = {
  propertyHeights: {},
  propertyOrder: [],
  sidebarWidth: 330,
  showTypeBadge: true,
  suggestionScope: 'vault',
  maxSuggestions: 12,
  preventDuplicateListValues: true,
  showAddValueButton: true,
  removeButtonAlwaysVisible: true,
  tagHashDisplay: true,
  createBinarySidecars: true,
};

const PROPERTY_TYPES = {
  text: { name: 'Text', icon: 'lucide-text', native: 'text' },
  list: { name: 'List', icon: 'lucide-list', native: 'multitext' },
  tags: { name: 'Tags', icon: 'lucide-tags', native: 'tags' },
  number: { name: 'Number', icon: 'lucide-binary', native: 'number' },
  checkbox: { name: 'Checkbox', icon: 'lucide-check-square', native: 'checkbox' },
  date: { name: 'Date', icon: 'lucide-calendar', native: 'date' },
  datetime: { name: 'Date & time', icon: 'lucide-clock', native: 'datetime' },
  file: { name: 'File', icon: 'lucide-file', native: 'file' },
  folder: { name: 'Folder', icon: 'lucide-folder', native: 'folder' },
  property: { name: 'Property', icon: 'lucide-info', native: 'property' },
  complex: { name: 'Object', icon: 'lucide-braces' },
  readonly: { name: 'Read-only', icon: 'lucide-lock' },
};

function localDateTimeValue(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(' ', 'T');
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime())) return '';
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return normalized;
}

function validPropertyValue(type, value) {
  if (value == null) return true;
  if (type === 'list' || type === 'tags') {
    return typeof value === 'string' || (Array.isArray(value)
      && value.every((item) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))));
  }
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'checkbox') return typeof value === 'boolean';
  if (type === 'date' || type === 'datetime') {
    const text = type === 'datetime' ? localDateTimeValue(value) : value;
    if (typeof text !== 'string') return false;
    const match = text.match(type === 'date'
      ? /^(\d{4})-(\d{2})-(\d{2})$/
      : /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/);
    if (!match) return false;
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    const date = new Date(0);
    date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1
      && date.getUTCDate() === Number(day) && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
  }
  return typeof value === 'string';
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function unwrapValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(unwrapValue);
  if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return unwrapValue(value.value);
  }
  return value;
}

function toComparableString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return String(value);
  }
}

function normalizeType(type, propName, rawValue) {
  const lower = String(type || '').toLowerCase();
  if (lower === 'multitext' || lower === 'list' || lower === 'aliases') return 'list';
  if (lower === 'tags' || lower === 'tag') return 'tags';
  if (lower === 'checkbox' || lower === 'boolean') return 'checkbox';
  if (lower === 'number') return 'number';
  if (lower === 'date') return 'date';
  if (lower === 'datetime' || lower === 'date-time') return 'datetime';
  if (lower === 'text' || lower === 'string') return 'text';
  if (lower === 'file' || lower === 'folder' || lower === 'property') return lower;
  if (lower && lower !== 'unknown') return lower;

  const key = String(propName || '').toLowerCase();
  if (key === 'tags') return 'tags';
  if (key === 'aliases' || key === 'cssclasses') return 'list';
  if (Array.isArray(rawValue)) return key === 'tags' ? 'tags' : 'list';
  if (typeof rawValue === 'boolean') return 'checkbox';
  if (typeof rawValue === 'number') return 'number';
  if (typeof rawValue === 'string' && validPropertyValue('date', rawValue)) return 'date';
  if (typeof rawValue === 'string' && validPropertyValue('datetime', rawValue)) return 'datetime';
  if (typeof rawValue === 'string' || rawValue == null) return 'text';
  return 'complex';
}

function sidecarOriginalPath(path) {
  const match = String(path || '').match(/^(.*\.(png|jpe?g|gif|bmp|svg|webp|pdf|avif|heic|heif))\.md$/i);
  return match ? match[1] : null;
}

function isEditablePropertyId(propId) {
  if (!propId) return false;
  if (propId.startsWith('note.')) return true;
  return !propId.includes('.');
}

function frontmatterKeyFromPropertyId(propId) {
  if (propId.startsWith('note.')) return propId.slice(5);
  if (!propId.includes('.')) return propId;
  return null;
}

function extractWikilink(value) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const str = toComparableString(unwrapValue(item));
    const match = str.match(/!?\[\[([^\]]+)\]\]/);
    if (match) {
      const inside = match[1];
      const target = inside.split('|')[0].split('#')[0];
      if (target) return target;
    }
  }
  return null;
}

function isWikiLinkString(value) {
  // Native Properties displays embed syntax literally, rather than as a link chip.
  return typeof value === 'string' && /^\[\[[^\]]+\]\]$/.test(value.trim());
}

function displayWikiLink(value) {
  const match = String(value).trim().match(/^\[\[([^\]]+)\]\]$/);
  if (!match) return String(value);
  const inside = match[1];
  const alias = inside.includes('|') ? inside.split('|').slice(1).join('|') : null;
  const target = inside.split('|')[0];
  return alias || target.split('#')[0].split('/').pop() || target;
}

class SpotlightEXView extends BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.type = VIEW_TYPE;
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.currentIndex = 0;
    this.sidebarVisible = true;
    this.sidebarWidth = Number(plugin.settings.sidebarWidth) || 330;
    this.isResizing = false;
    this.activePdfBlobUrls = [];
    this.renderToken = 0;
    this.pendingDataRender = false;
    this.pendingWrites = 0;
    this.writeQueue = Promise.resolve();
    this.pendingPropertyWrites = new Map();
    this.recoveredDrafts = new Map();
    this.editorCleanups = [];
    this.unloaded = false;

    this.containerEl.tabIndex = 0;
    this.containerEl.addClass('spotlight-ex-view');

    this.wrapperEl = this.containerEl.createDiv('spotlight-ex-wrapper');
    this.centerEl = this.wrapperEl.createDiv('spotlight-ex-center');
    this.resizerEl = this.wrapperEl.createDiv('spotlight-ex-resizer');
    this.sidebarEl = this.wrapperEl.createDiv('spotlight-ex-sidebar');

    this.resizerEl.addEventListener('mousedown', (event) => this.beginSidebarResize(event));
    this.containerEl.addEventListener('keydown', (event) => this.handleKeyDown(event));
    this.containerEl.addEventListener('pointerdown', () => this.activatePane(), true);
    // Bases navigation must not consume keys intended for a property editor.
    this.sidebarEl.addEventListener('keydown', (event) => event.stopPropagation());
    this.sidebarEl.addEventListener('focusout', () => this.scheduleDataRender());

    this.toggleBtn = this.containerEl.createEl('button', {
      text: 'Toggle Sidebar',
      cls: 'spotlight-ex-toolbar-button spotlight-ex-sidebar-toggle',
    });
    this.toggleBtn.addEventListener('click', () => this.toggleSidebar());

    this.fullscreenBtn = this.containerEl.createEl('button', {
      text: 'Full Screen',
      cls: 'spotlight-ex-toolbar-button spotlight-ex-fullscreen-toggle',
    });
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    this.fullscreenHandler = () => {
      const doc = this.containerEl.ownerDocument;
      const active = doc.fullscreenElement === this.containerEl;
      this.fullscreenBtn.setText(active ? 'Exit Full Screen' : 'Full Screen');
      this.containerEl.toggleClass('spotlight-ex-is-fullscreen', active);
    };
    this.containerEl.ownerDocument.addEventListener('fullscreenchange', this.fullscreenHandler);
    this.plugin.views?.add(this);
  }

  onDataUpdated() {
    if (this.unloaded) return;
    if (this.deferDataRender()) {
      this.pendingDataRender = true;
      this.syncSidebarProperties();
      return;
    }
    this.render();
  }

  deferDataRender() {
    return this.activatingPane || this.pendingWrites
      || this.sidebarEl.contains(this.containerEl.ownerDocument.activeElement)
      || this.sidebarEl.querySelector('[data-dirty="true"]')
      || Array.from(this.sidebarEl.querySelectorAll('.spotlight-ex-add-input')).some((input) => input.value.trim());
  }

  activatePane() {
    this.activatingPane = true;
    const win = this.containerEl.ownerDocument.defaultView;
    win.clearTimeout(this.activationTimer);
    this.activationTimer = win.setTimeout(() => {
      this.activatingPane = false;
      this.scheduleDataRender();
    }, 0);
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.containerEl.contains(this.containerEl) && this.app.workspace.activeLeaf !== leaf) {
        this.app.workspace.setActiveLeaf(leaf, { focus: false });
      }
    });
  }

  scheduleDataRender() {
    if (this.unloaded) return;
    const win = this.containerEl.ownerDocument.defaultView;
    win.clearTimeout(this.dataRenderTimer);
    this.dataRenderTimer = win.setTimeout(() => {
      this.dataRenderTimer = null;
      if (!this.unloaded) this.syncSidebarProperties();
      if (!this.unloaded && this.pendingDataRender && !this.deferDataRender()) {
        this.render();
      }
    }, 0);
  }

  onunload() {
    this.unloaded = true;
    this.plugin.views?.delete(this);
    this.containerEl.ownerDocument.defaultView.clearTimeout(this.dataRenderTimer);
    this.containerEl.ownerDocument.defaultView.clearTimeout(this.activationTimer);
    this.clearEditorCleanups();
    this.revokePdfUrls();
    this.containerEl.ownerDocument.removeEventListener('fullscreenchange', this.fullscreenHandler);
  }

  get filteredEntries() {
    if (!this.data || !Array.isArray(this.data.data)) return [];

    // One logical record per original file. If both a binary attachment and its
    // .md metadata sidecar appear in the Base results, prefer the sidecar entry.
    const byOriginal = new Map();
    for (const entry of this.data.data) {
      const file = entry?.file;
      if (!(file instanceof TFile)) continue;
      const original = sidecarOriginalPath(file.path);
      const key = original || file.path;
      const previous = byOriginal.get(key);
      if (!previous || original) byOriginal.set(key, entry);
    }
    return Array.from(byOriginal.values());
  }

  handleKeyDown(event) {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || target.isContentEditable) {
        return;
      }
    }

    const entries = this.filteredEntries;
    if (!entries.length) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      this.currentIndex = Math.min(this.currentIndex + 1, entries.length - 1);
      this.render();
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      this.currentIndex = Math.max(this.currentIndex - 1, 0);
      this.render();
      event.preventDefault();
    }
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    this.sidebarEl.style.display = this.sidebarVisible ? 'flex' : 'none';
    this.resizerEl.style.display = this.sidebarVisible ? 'block' : 'none';
  }

  async toggleFullscreen() {
    const doc = this.containerEl.ownerDocument;
    try {
      if (!doc.fullscreenElement) await this.containerEl.requestFullscreen();
      else await doc.exitFullscreen();
    } catch (err) {
      console.error('[Spotlight EX] Fullscreen failed', err);
    }
  }

  beginSidebarResize(event) {
    event.preventDefault();
    this.isResizing = true;
    const doc = this.containerEl.ownerDocument;
    const move = (e) => {
      if (!this.isResizing) return;
      const rect = this.containerEl.getBoundingClientRect();
      const width = rect.right - e.clientX;
      if (width >= 180 && width <= rect.width - 180) {
        this.sidebarWidth = width;
        this.sidebarEl.style.width = `${width}px`;
      }
    };
    const up = async () => {
      this.isResizing = false;
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
      this.plugin.settings.sidebarWidth = Math.round(this.sidebarWidth);
      await this.plugin.saveSettings();
    };
    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', up);
  }

  revokePdfUrls() {
    for (const url of this.activePdfBlobUrls) URL.revokeObjectURL(url);
    this.activePdfBlobUrls = [];
  }

  render() {
    this.pendingDataRender = false;
    this.clearEditorCleanups();
    this.renderToken += 1;
    const token = this.renderToken;
    this.revokePdfUrls();
    this.centerEl.empty();
    this.sidebarEl.empty();

    const entries = this.filteredEntries;
    if (!entries.length) {
      this.centerEl.createDiv({ text: 'No entries found.', cls: 'spotlight-ex-empty' });
      return;
    }

    this.currentIndex = Math.max(0, Math.min(this.currentIndex, entries.length - 1));
    const entry = entries[this.currentIndex];
    this.renderedFilePath = entry.file.path;

    this.renderCenter(entry, token);
    this.renderSidebar(entry, entries);
  }

  renderCenter(entry, token) {
    const centerContent = this.centerEl.createDiv('spotlight-ex-center-content');
    const spotlightProperty = this.config?.get?.('spotlight_property');
    let previewFile = null;

    if (spotlightProperty) {
      let value;
      try {
        value = unwrapValue(entry.getValue(spotlightProperty));
      } catch (_err) {
        value = null;
      }
      const linkPath = extractWikilink(value);
      if (linkPath) {
        const sourcePath = entry.file instanceof TFile ? entry.file.path : '';
        const dest = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
        if (dest instanceof TFile) previewFile = dest;
      }
    }

    if (!previewFile && entry.file instanceof TFile) previewFile = this.resolvePreviewFile(entry.file);

    if (!previewFile) {
      this.centerEl.removeClass('spotlight-ex-center-no-padding');
      centerContent.createDiv({ text: 'Cannot read file content.', cls: 'spotlight-ex-error-message' });
      return;
    }

    this.renderFileContent(previewFile, centerContent, token);
  }

  resolvePreviewFile(file) {
    const originalPath = sidecarOriginalPath(file.path);
    if (originalPath) {
      const original = this.app.vault.getAbstractFileByPath(originalPath);
      if (original instanceof TFile) return original;
    }
    return file;
  }

  getVisiblePropertyIds() {
    const fromData = Array.isArray(this.data?.properties) ? this.data.properties : [];
    const fromConfig = typeof this.config?.getOrder === 'function' ? this.config.getOrder() : [];
    const list = fromData.length ? fromData : fromConfig;
    const unique = [...new Set(list)];

    const orderMap = new Map();
    this.plugin.settings.propertyOrder.forEach((id, index) => orderMap.set(id, index));
    return unique.sort((a, b) => {
      const ai = orderMap.has(a) ? orderMap.get(a) : Number.POSITIVE_INFINITY;
      const bi = orderMap.has(b) ? orderMap.get(b) : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return unique.indexOf(a) - unique.indexOf(b);
    });
  }

  renderSidebar(entry, entries) {
    this.sidebarEl.style.width = `${this.sidebarWidth}px`;
    this.sidebarEl.createEl('h3', { text: 'Attributes', cls: 'spotlight-ex-sidebar-title' });

    const properties = this.getVisiblePropertyIds();
    for (const propId of properties) this.renderProperty(entry, entries, propId, properties);

    const nav = this.sidebarEl.createDiv('spotlight-ex-nav-container');
    const prev = nav.createEl('button', { text: 'Previous', cls: 'spotlight-ex-nav-btn' });
    prev.disabled = this.currentIndex === 0;
    prev.addEventListener('click', () => {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.render();
    });

    nav.createDiv({ text: `Entry ${this.currentIndex + 1} of ${entries.length}`, cls: 'spotlight-ex-count' });

    const next = nav.createEl('button', { text: 'Next', cls: 'spotlight-ex-nav-btn' });
    next.disabled = this.currentIndex >= entries.length - 1;
    next.addEventListener('click', () => {
      this.currentIndex = Math.min(entries.length - 1, this.currentIndex + 1);
      this.render();
    });
  }

  renderProperty(entry, entries, propId, orderedProperties) {
    const propEl = this.sidebarEl.createDiv('spotlight-ex-property');
    propEl.dataset.prop = propId;

    const header = propEl.createDiv('spotlight-ex-property-header');
    const displayName = typeof this.config?.getDisplayName === 'function'
      ? this.config.getDisplayName(propId)
      : this.getPropName(propId);
    const nameEl = header.createDiv({ text: displayName || this.getPropName(propId), cls: 'spotlight-ex-property-name' });

    nameEl.draggable = true;
    nameEl.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', propId);
      propEl.addClass('spotlight-ex-property-dragging');
    });
    nameEl.addEventListener('dragend', () => {
      propEl.removeClass('spotlight-ex-property-dragging');
      this.sidebarEl.querySelectorAll('.spotlight-ex-property-drag-over, .spotlight-ex-property-drag-below')
        .forEach((el) => el.removeClasses(['spotlight-ex-property-drag-over', 'spotlight-ex-property-drag-below']));
    });

    const editable = isEditablePropertyId(propId);
    const key = frontmatterKeyFromPropertyId(propId);
    const metadataFile = editable ? this.getMetadataFile(entry.file) : null;
    const rawValue = editable && key ? this.readRawFrontmatterValue(metadataFile, key) : undefined;
    const propType = editable && key ? this.getPropertyType(key, rawValue) : 'readonly';
    propEl.dataset.type = propType;
    propEl.dataset.value = JSON.stringify(rawValue) ?? 'undefined';

    if (this.plugin.settings.showTypeBadge) {
      const details = PROPERTY_TYPES[propType] || { name: propType, icon: 'lucide-circle-help' };
      const widget = editable && key ? this.getPropertyWidget(key, rawValue) : null;
      const icon = header.createEl('button', {
        cls: 'spotlight-ex-type-icon clickable-icon',
        attr: { title: `Property type: ${details.name}`, 'aria-label': `Change ${displayName || key} property type (${details.name})` },
      });
      setIcon(icon, widget?.icon || details.icon);
      header.insertBefore(icon, nameEl);
      icon.disabled = !editable || !this.app.metadataTypeManager?.setType || propType === 'complex'
        || ['tags', 'aliases', 'cssclasses'].includes(key?.toLowerCase());
      icon.addEventListener('click', (event) => this.openPropertyTypeMenu(event, key, propType));
      header.createSpan({ text: details.name, cls: 'spotlight-ex-type-badge' });
    }

    this.addDragDropHandlers(propEl, propId, orderedProperties);

    const valueContainer = propEl.createDiv('spotlight-ex-property-value-container');
    const savedHeight = this.plugin.settings.propertyHeights[propId];
    if (savedHeight) {
      valueContainer.style.minHeight = `${savedHeight}px`;
    }

    const hyperlinkProperty = this.config?.get?.('hyperlink_property');
    if (hyperlinkProperty && propId === hyperlinkProperty) {
      this.renderHyperlinkProperty(entry, valueContainer, propId);
    } else if (editable && key) {
      // When a binary file has no sidecar yet, rawValue is undefined. We still
      // use the global Obsidian type for the property so the correct editor is shown.
      this.renderTypedEditor(entry, entries, key, propId, propType, rawValue, valueContainer);
    } else {
      this.renderReadOnlyValue(entry, propId, valueContainer);
    }

    this.addHeightResizer(propEl, valueContainer, propId);
    const draft = this.recoveredDrafts.get(`${entry.file.path}\0${propId}`);
    if (draft) {
      const details = propEl.createEl('details', { cls: 'spotlight-ex-recovered-draft' });
      details.createEl('summary', { text: 'Unfinished value from the previous type' });
      details.createEl('pre', { text: draft });
    }
    this.alignPropertyControls(propEl);
    return propEl;
  }

  alignPropertyControls(property) {
    const icon = property.querySelector('.spotlight-ex-type-icon');
    const values = property.querySelector('.spotlight-ex-property-value-container');
    if (!icon || !values.querySelector('.spotlight-ex-chip-list, .spotlight-ex-checkbox, .spotlight-ex-empty-value')) return;
    const name = property.querySelector('.spotlight-ex-property-name');
    const win = property.ownerDocument.defaultView;
    const align = () => {
      if (!property.isConnected) return;
      const iconRect = icon.getBoundingClientRect();
      if (!iconRect.width) return;
      const valueRect = values.getBoundingClientRect();
      // Convert visual distances back to layout pixels when a parent is scaled.
      const scale = property.getBoundingClientRect().width / property.offsetWidth || 1;
      const measurements = {
        'width': iconRect.width / scale,
        'offset': (iconRect.left - valueRect.left) / scale,
        'gap': (name.getBoundingClientRect().left - iconRect.right) / scale,
      };
      for (const [key, measurement] of Object.entries(measurements)) {
        const variable = `--spotlight-ex-value-icon-${key}`;
        const value = `${measurement}px`;
        if (property.style.getPropertyValue(variable) !== value) property.style.setProperty(variable, value);
      }
    };
    const observer = new win.ResizeObserver(align);
    for (const element of [icon, name, values]) observer.observe(element, { box: 'border-box' });
    const frame = win.requestAnimationFrame(align);
    const cleanup = () => { observer.disconnect(); win.cancelAnimationFrame(frame); };
    cleanup.target = property;
    this.editorCleanups.push(cleanup);
  }

  syncSidebarProperties() {
    if (this.unloaded || this.isResizing) return;
    const entries = this.filteredEntries;
    const entry = entries.find((item) => item.file.path === this.renderedFilePath);
    if (!entry) return;
    const order = this.getVisiblePropertyIds();
    const doc = this.containerEl.ownerDocument;
    for (const row of Array.from(this.sidebarEl.querySelectorAll('.spotlight-ex-property'))) {
      const propId = row.dataset.prop;
      const key = frontmatterKeyFromPropertyId(propId);
      if (!key || !isEditablePropertyId(propId) || !order.includes(propId)) continue;
      if (this.pendingPropertyWrites.get(`${entry.file.path}\0${key}`)) continue;
      const raw = this.readRawFrontmatterValue(this.getMetadataFile(entry.file), key);
      const type = this.getPropertyType(key, raw);
      const typeChanged = type !== row.dataset.type;
      const draftInput = row.querySelector('[data-dirty="true"]')
        || row.querySelector('.spotlight-ex-add-input');
      const draft = draftInput?.value ?? draftInput?.textContent ?? '';
      const focused = row.contains(doc.activeElement);
      if (!typeChanged && (focused || draftInput?.dataset.dirty === 'true' || draft.trim())) continue;
      if (!typeChanged && row.dataset.value === (JSON.stringify(raw) ?? 'undefined')) continue;
      if (typeChanged && (draftInput?.dataset.dirty === 'true' || draft.trim())) {
        this.recoveredDrafts.set(`${entry.file.path}\0${propId}`, draft);
      }
      this.clearEditorCleanups(row);
      const replacement = this.renderProperty(entry, entries, propId, order);
      row.replaceWith(replacement);
      if (focused) {
        const control = replacement.querySelector('textarea, input, select, .spotlight-ex-add-button');
        control?.focus();
      }
    }
  }

  openPropertyTypeMenu(event, key, currentType) {
    const manager = this.app.metadataTypeManager;
    if (!manager?.setType) return;
    const menu = new Menu();
    const reserved = { tags: 'tags', aliases: 'aliases', cssclasses: 'multitext' }[key.toLowerCase()];
    for (const [type, details] of Object.entries(PROPERTY_TYPES)) {
      if (!details.native || type === 'tags' || (reserved && details.native !== reserved)) continue;
      if (manager.getWidget && manager.getWidget(details.native)?.type !== details.native) continue;
      menu.addItem((item) => item.setTitle(details.name).setIcon(details.icon).setChecked(type === currentType)
        .onClick(async () => {
          try { await manager.setType(key, details.native); this.syncSidebarProperties(); }
          catch (error) { new Notice(`Could not change the type of “${key}”.`); }
        }));
    }
    menu.showAtMouseEvent(event);
  }

  addDragDropHandlers(propEl, propId, orderedProperties) {
    propEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      const rect = propEl.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        propEl.addClass('spotlight-ex-property-drag-over');
        propEl.removeClass('spotlight-ex-property-drag-below');
      } else {
        propEl.addClass('spotlight-ex-property-drag-below');
        propEl.removeClass('spotlight-ex-property-drag-over');
      }
    });
    propEl.addEventListener('dragleave', () => {
      propEl.removeClasses(['spotlight-ex-property-drag-over', 'spotlight-ex-property-drag-below']);
    });
    propEl.addEventListener('drop', async (event) => {
      event.preventDefault();
      propEl.removeClasses(['spotlight-ex-property-drag-over', 'spotlight-ex-property-drag-below']);
      const dragged = event.dataTransfer?.getData('text/plain');
      if (!dragged || dragged === propId) return;

      const nextOrder = [...orderedProperties];
      const oldIndex = nextOrder.indexOf(dragged);
      if (oldIndex >= 0) nextOrder.splice(oldIndex, 1);
      let targetIndex = nextOrder.indexOf(propId);
      const rect = propEl.getBoundingClientRect();
      if (event.clientY >= rect.top + rect.height / 2) targetIndex += 1;
      nextOrder.splice(Math.max(0, targetIndex), 0, dragged);
      this.plugin.settings.propertyOrder = nextOrder;
      await this.plugin.saveSettings();
      this.render();
    });
  }

  addHeightResizer(propEl, valueContainer, propId) {
    const resizeHandle = propEl.createDiv('spotlight-ex-property-resizer');
    let startY = 0;
    let startHeight = 0;
    const doc = this.containerEl.ownerDocument;

    const move = (event) => {
      const height = Math.max(28, startHeight + (event.clientY - startY));
      valueContainer.style.minHeight = `${height}px`;
    };
    const up = async () => {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
      window.setTimeout(() => { this.isResizing = false; }, 50);
      this.plugin.settings.propertyHeights[propId] = parseFloat(valueContainer.style.minHeight) || 28;
      await this.plugin.saveSettings();
    };
    resizeHandle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.isResizing = true;
      startY = event.clientY;
      startHeight = valueContainer.getBoundingClientRect().height;
      doc.addEventListener('mousemove', move);
      doc.addEventListener('mouseup', up);
    });
  }

  getMetadataFile(file) {
    if (!(file instanceof TFile)) return null;
    if (sidecarOriginalPath(file.path)) return file;
    if (file.extension === 'md') return file;
    const sidecar = this.app.vault.getAbstractFileByPath(`${file.path}.md`);
    return sidecar instanceof TFile ? sidecar : null;
  }

  async ensureMetadataFile(file) {
    if (!(file instanceof TFile)) return null;
    const existing = this.getMetadataFile(file);
    if (existing) return existing;
    if (file.extension === 'md') return file;
    if (!this.plugin.settings.createBinarySidecars) return null;

    const sidecarPath = `${file.path}.md`;
    try {
      const created = await this.app.vault.create(sidecarPath, '');
      return created instanceof TFile ? created : null;
    } catch (err) {
      console.error('[Spotlight EX] Could not create sidecar', err);
      new Notice(`Could not create metadata sidecar: ${sidecarPath}`);
      return null;
    }
  }

  readRawFrontmatterValue(file, key) {
    if (!(file instanceof TFile)) return undefined;
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter ? cache.frontmatter[key] : undefined;
  }

  getPropertyType(key, rawValue) {
    const manager = this.app.metadataTypeManager;
    let declared = null;
    try {
      declared = manager?.getAssignedWidget?.(key) || manager?.getAssignedType?.(key)
        || manager?.getTypeInfo?.(key, rawValue)?.expected?.type;
      if (!declared) {
        const info = manager?.getPropertyInfo?.(key);
        declared = info?.widget || info?.type || null;
      }
    } catch (_err) {
      declared = null;
    }
    if (!declared) declared = this.plugin.getStoredPropertyType(key);
    return normalizeType(declared, key, rawValue);
  }

  getPropertyWidget(key, rawValue) {
    const manager = this.app.metadataTypeManager;
    try {
      const nativeType = manager?.getAssignedWidget?.(key)
        || manager?.getTypeInfo?.(key, rawValue)?.expected?.type
        || PROPERTY_TYPES[this.getPropertyType(key, rawValue)]?.native;
      return nativeType ? manager?.getWidget?.(nativeType) : null;
    } catch (error) { return null; }
  }

  renderTypedEditor(entry, entries, key, propId, type, rawValue, container) {
    container.empty();
    container.addClass('spotlight-ex-editor-container');
    if (type !== 'complex' && !validPropertyValue(type, rawValue)) {
      container.createDiv({ text: `Stored value does not match ${PROPERTY_TYPES[type]?.name || type}. Enter a new value to replace it.`, cls: 'spotlight-ex-type-mismatch' });
      container.createEl('pre', { text: toComparableString(rawValue), cls: 'spotlight-ex-mismatched-value' });
      rawValue = undefined;
    }

    switch (type) {
      case 'list':
      case 'tags':
        this.renderMultiValueEditor(entry, entries, key, type, rawValue, container);
        break;
      case 'checkbox':
        this.renderCheckboxEditor(entry, key, rawValue, container);
        break;
      case 'number':
        this.renderScalarInput(entry, key, 'number', rawValue, container);
        break;
      case 'date':
        this.renderScalarInput(entry, key, 'date', rawValue, container);
        break;
      case 'datetime':
        this.renderScalarInput(entry, key, 'datetime-local', rawValue, container);
        break;
      case 'complex':
        this.renderComplexReadOnly(rawValue, container);
        break;
      case 'file':
      case 'folder':
      case 'property':
        this.renderNativeEditor(entry, key, type, rawValue, container);
        break;
      case 'text':
      default:
        if (type === 'text') this.renderTextEditor(entry, key, rawValue, container);
        else this.renderNativeEditor(entry, key, type, rawValue, container);
        break;
    }
  }

  renderMultiValueEditor(entry, entries, key, type, rawValue, container) {
    const values = rawValue == null ? [] : (Array.isArray(rawValue) ? [...rawValue] : [rawValue]);
    const listEl = container.createDiv('spotlight-ex-chip-list');
    const updateValues = async (update) => {
      const result = await this.writeProperty(entry.file, key, (stored) => {
        const current = stored == null ? [] : (Array.isArray(stored) ? [...stored] : [stored]);
        return update(current);
      }, type);
      if (!result) return false;
      values.splice(0, values.length, ...result.value);
      if (listEl.isConnected) renderChips();
      return true;
    };

    const renderChips = () => {
      const restoreFocus = listEl.contains(listEl.ownerDocument.activeElement);
      listEl.empty();
      if (!values.length) {
        listEl.createSpan({ text: '—', cls: 'spotlight-ex-empty-value' });
      }

      values.forEach((value) => {
        const chip = listEl.createDiv('spotlight-ex-chip');
        const label = chip.createSpan('spotlight-ex-chip-label');
        this.renderChipLabel(label, value, type, entry.file);

        const remove = chip.createEl('button', {
          text: '×',
          cls: 'spotlight-ex-chip-remove',
          attr: { 'aria-label': `Remove ${toComparableString(value)}`, title: 'Remove value' },
        });
        remove.addEventListener('mousedown', (event) => event.preventDefault());
        if (!this.plugin.settings.removeButtonAlwaysVisible) remove.addClass('spotlight-ex-chip-remove-hover');
        remove.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await updateValues((current) => {
            const index = current.findIndex((item) => toComparableString(item) === toComparableString(value));
            if (index >= 0) current.splice(index, 1);
            return current;
          });
        });
      });
      if (restoreFocus) {
        const next = container.querySelector('.spotlight-ex-add-input')
          || listEl.querySelector('.spotlight-ex-chip-remove')
          || container.querySelector('.spotlight-ex-add-button');
        if (next) next.focus();
        else { listEl.tabIndex = -1; listEl.focus(); }
      }
    };
    renderChips();

    if (this.plugin.settings.showAddValueButton) {
      const addArea = container.createDiv('spotlight-ex-add-area');
      const addButton = addArea.createEl('button', { text: '+ Add value', cls: 'spotlight-ex-add-button' });
      addButton.addEventListener('click', () => {
        addButton.style.display = 'none';
        this.openAddValueEditor(entry, entries, key, type, values, addArea, addButton, updateValues);
      });
    }
  }

  renderChipLabel(label, value, type, sourceFile) {
    const stringValue = toComparableString(value);
    if (isWikiLinkString(stringValue)) {
      label.addClass('spotlight-ex-chip-link');
      label.setText(displayWikiLink(stringValue));
      label.title = stringValue;
      label.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openWikiLink(stringValue, sourceFile, event);
      });
      return;
    }

    if (type === 'tags' && this.plugin.settings.tagHashDisplay) {
      label.setText(stringValue.startsWith('#') ? stringValue : `#${stringValue}`);
    } else {
      label.setText(stringValue);
    }
  }

  openWikiLink(wikilink, sourceFile, event) {
    const match = String(wikilink).match(/!?\[\[([^\]]+)\]\]/);
    if (!match) return;
    const target = match[1].split('|')[0];
    const sourcePath = sourceFile instanceof TFile ? sourceFile.path : '';
    const linkPath = target.split('#')[0];
    const dest = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
    if (!(dest instanceof TFile)) return;
    const newLeaf = !!(event?.ctrlKey || event?.metaKey || event?.button === 1);
    this.app.workspace.getLeaf(newLeaf).openFile(dest);
  }

  openAddValueEditor(entry, entries, key, type, currentValues, addArea, addButton, updateValues) {
    const editor = addArea.createDiv('spotlight-ex-add-editor');
    const input = editor.createEl('input', {
      type: 'text',
      cls: 'spotlight-ex-add-input',
      attr: { placeholder: type === 'tags' ? 'Add tag…' : 'Add value…' },
    });
    const add = editor.createEl('button', { text: 'Add', cls: 'spotlight-ex-add-confirm' });
    const cancel = editor.createEl('button', { text: '×', cls: 'spotlight-ex-add-cancel', attr: { title: 'Cancel' } });
    const suggestions = editor.createDiv('spotlight-ex-suggestions');
    suggestions.style.display = 'none';
    let activeSuggestion = -1;
    let visibleSuggestions = [];
    const pendingValues = new Set();

    const close = () => {
      editor.remove();
      addButton.style.display = '';
      addButton.focus();
    };

    const normalizeAddedValue = (text) => {
      const trimmed = text.trim();
      if (type === 'tags' && trimmed.startsWith('#')) return trimmed.slice(1);
      return trimmed;
    };

    const submit = async (forcedValue = null) => {
      let value = normalizeAddedValue(forcedValue == null ? input.value : forcedValue);
      if (!value) return;

      // List properties can legally contain numbers. If all existing values are
      // numeric, keep the item type numeric rather than silently changing it.
      if (type === 'list' && currentValues.length > 0 && currentValues.every((item) => typeof item === 'number')) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) value = numeric;
      }

      const comparable = toComparableString(value);
      const duplicate = pendingValues.has(comparable)
        || currentValues.some((existing) => toComparableString(existing) === comparable);
      if (duplicate && this.plugin.settings.preventDuplicateListValues) {
        input.addClass('spotlight-ex-input-error');
        input.ownerDocument.defaultView.setTimeout(() => input.removeClass('spotlight-ex-input-error'), 350);
        return;
      }
      const draft = input.value;
      pendingValues.add(comparable);
      input.value = '';
      input.focus();
      refreshSuggestions();
      const saved = await updateValues((current) => {
        if (this.plugin.settings.preventDuplicateListValues
          && current.some((existing) => toComparableString(existing) === comparable)) return current;
        return [...current, value];
      });
      pendingValues.delete(comparable);
      if (!editor.isConnected) return;
      if (!saved) {
        if (!input.value) input.value = draft || toComparableString(value);
        input.addClass('spotlight-ex-input-error');
      } else {
        input.removeClass('spotlight-ex-input-error');
      }
      refreshSuggestions();
    };

    const refreshSuggestions = () => {
      const rawQuery = input.value.trim();
      const query = rawQuery.replace(/^#/, '').toLowerCase();
      const candidateSet = new Set(this.getSuggestions(entries, key, type));
      const looksLikeWikiList = type === 'list' && (
        rawQuery.startsWith('[[') || currentValues.some((item) => isWikiLinkString(toComparableString(item)))
      );
      if (looksLikeWikiList) {
        for (const candidate of this.getWikiLinkSuggestions(rawQuery)) candidateSet.add(candidate);
      }
      const candidates = Array.from(candidateSet)
        .filter((candidate) => !currentValues.some((v) => toComparableString(v) === candidate))
        .filter((candidate) => !pendingValues.has(candidate))
        .filter((candidate) => !query || candidate.toLowerCase().includes(query))
        .slice(0, Math.max(1, Number(this.plugin.settings.maxSuggestions) || 12));
      visibleSuggestions = candidates;
      activeSuggestion = -1;
      suggestions.empty();
      if (!candidates.length) {
        suggestions.style.display = 'none';
        return;
      }
      suggestions.style.display = 'block';
      candidates.forEach((candidate, index) => {
        const item = suggestions.createDiv('spotlight-ex-suggestion');
        item.setText(type === 'tags' && this.plugin.settings.tagHashDisplay ? `#${candidate.replace(/^#/, '')}` : candidate);
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.addEventListener('click', () => submit(candidate));
        item.dataset.index = String(index);
      });
    };

    const setActiveSuggestion = (index) => {
      const items = Array.from(suggestions.querySelectorAll('.spotlight-ex-suggestion'));
      items.forEach((el) => el.removeClass('is-active'));
      if (!items.length) return;
      activeSuggestion = (index + items.length) % items.length;
      items[activeSuggestion].addClass('is-active');
      items[activeSuggestion].scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('input', refreshSuggestions);
    input.addEventListener('focus', refreshSuggestions);
    input.addEventListener('keydown', (event) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'ArrowDown' && visibleSuggestions.length) {
        event.preventDefault();
        setActiveSuggestion(activeSuggestion + 1);
      } else if (event.key === 'ArrowUp' && visibleSuggestions.length) {
        event.preventDefault();
        setActiveSuggestion(activeSuggestion - 1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (activeSuggestion >= 0 && visibleSuggestions[activeSuggestion]) submit(visibleSuggestions[activeSuggestion]);
        else submit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });
    add.addEventListener('mousedown', (event) => event.preventDefault());
    add.addEventListener('click', () => submit());
    cancel.addEventListener('click', close);
    input.focus();
  }

  getSuggestions(entries, key, type) {
    const result = new Set();
    const addRaw = (raw) => {
      const list = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
      for (const item of list) {
        let value = toComparableString(item).trim();
        if (!value) continue;
        if (type === 'tags' && value.startsWith('#')) value = value.slice(1);
        result.add(value);
      }
    };

    if (this.plugin.settings.suggestionScope === 'base') {
      for (const candidateEntry of entries) {
        const metadataFile = this.getMetadataFile(candidateEntry.file);
        addRaw(this.readRawFrontmatterValue(metadataFile, key));
      }
    } else {
      for (const file of this.app.vault.getMarkdownFiles()) {
        const cache = this.app.metadataCache.getFileCache(file);
        addRaw(cache?.frontmatter?.[key]);
      }
    }
    return Array.from(result).sort((a, b) => a.localeCompare(b));
  }

  getWikiLinkSuggestions(rawQuery) {
    const needle = String(rawQuery || '').replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase();
    const values = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const display = file.basename;
      const path = file.path.replace(/\.md$/i, '');
      if (needle && !display.toLowerCase().includes(needle) && !path.toLowerCase().includes(needle)) continue;
      // Prefer a short wikilink when the basename uniquely resolves; a path link
      // remains valid even if duplicate basenames exist.
      values.push(`[[${path}]]`);
    }
    return values;
  }

  renderCheckboxEditor(entry, key, rawValue, container) {
    const row = container.createDiv('spotlight-ex-checkbox-row');
    const input = row.createEl('input', { type: 'checkbox', cls: 'spotlight-ex-checkbox' });
    input.checked = rawValue === true;
    input.indeterminate = rawValue == null;
    const label = row.createSpan({ text: input.indeterminate ? 'No value' : (input.checked ? 'True' : 'False'), cls: 'spotlight-ex-checkbox-label' });
    input.addEventListener('change', async () => {
      input.indeterminate = false;
      label.setText(input.checked ? 'True' : 'False');
      await this.writeProperty(entry.file, key, input.checked, 'checkbox');
    });
  }

  renderScalarInput(entry, key, inputType, rawValue, container) {
    const input = container.createEl('input', { type: inputType, cls: 'spotlight-ex-scalar-input' });
    const expectedType = inputType === 'datetime-local' ? 'datetime' : inputType;
    let initial = rawValue == null ? '' : String(rawValue);
    if (inputType === 'datetime-local' && initial) {
      // Native input expects YYYY-MM-DDTHH:mm[:ss] without timezone suffix.
      initial = localDateTimeValue(initial);
    }
    input.value = initial;
    if (inputType === 'number') input.step = 'any';
    if (inputType === 'datetime-local') input.step = '1';
    let dirty = false;
    input.addEventListener('input', () => { dirty = true; input.dataset.dirty = 'true'; });

    const save = async () => {
      if (!dirty) return;
      if (!input.checkValidity()) return;
      let next = input.value;
      if (next === '') next = null;
      else if (inputType === 'number') {
        const parsed = Number(next);
        if (!Number.isFinite(parsed)) return;
        next = parsed;
      }
      dirty = false;
      delete input.dataset.dirty;
      if (!await this.writeProperty(entry.file, key, next, expectedType)) {
        dirty = true;
        input.dataset.dirty = 'true';
      }
    };
    input.addEventListener('change', save);
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        save();
      }
    });
  }

  renderTextEditor(entry, key, rawValue, container) {
    const textarea = container.createEl('textarea', {
      cls: 'spotlight-ex-text-input',
      attr: { placeholder: 'Empty' },
    });
    textarea.value = rawValue == null ? '' : String(rawValue);
    let dirty = false;
    this.autoSizeTextarea(textarea);
    textarea.addEventListener('input', () => { dirty = true; textarea.dataset.dirty = 'true'; });
    const save = async () => {
      if (!dirty) return;
      dirty = false;
      delete textarea.dataset.dirty;
      if (!await this.writeProperty(entry.file, key, textarea.value === '' ? null : textarea.value, 'text')) {
        dirty = true;
        textarea.dataset.dirty = 'true';
      }
    };
    textarea.addEventListener('blur', save);
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        save();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.render();
      }
    });
  }

  renderNativeEditor(entry, key, type, rawValue, container) {
    const widget = this.getPropertyWidget(key, rawValue);
    if (!widget?.render || normalizeType(widget.type, key, rawValue) !== type) {
      this.renderComplexReadOnly(rawValue, container);
      return;
    }
    container.addEventListener('input', (event) => {
      if (event.target instanceof HTMLElement) event.target.dataset.dirty = 'true';
    });
    widget.render(container, rawValue ?? null, {
      app: this.app, key, sourcePath: entry.file.path, hoverSource: 'bases',
      onChange: async (value) => {
        const input = container.querySelector('input, textarea, [contenteditable="true"]');
        const draft = input?.value ?? input?.textContent;
        const saved = await this.writeProperty(entry.file, key, value ?? null, type);
        if (saved && input && (input.value ?? input.textContent) === draft) delete input.dataset.dirty;
      },
      blur: () => container.querySelector('input, [contenteditable="true"]')?.blur(),
    });
  }

  clearEditorCleanups(container = null) {
    this.editorCleanups = this.editorCleanups.filter((cleanup) => {
      if (container && !container.contains(cleanup.target)) return true;
      cleanup();
      return false;
    });
  }

  autoSizeTextarea(textarea) {
    const win = textarea.ownerDocument.defaultView;
    const resize = () => {
      textarea.style.height = 'auto';
      const style = win.getComputedStyle(textarea);
      const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      textarea.style.height = `${textarea.scrollHeight + borders}px`;
    };
    textarea.addEventListener('input', resize);
    let lastWidth;
    const observer = new win.ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== lastWidth) {
        lastWidth = entry.contentRect.width;
        resize();
      }
    });
    observer.observe(textarea);
    const frame = win.requestAnimationFrame(resize);
    const cleanup = () => {
      observer.disconnect();
      win.cancelAnimationFrame(frame);
    };
    cleanup.target = textarea;
    this.editorCleanups.push(cleanup);
    resize();
  }

  renderComplexReadOnly(rawValue, container) {
    container.addClass('spotlight-ex-complex-readonly');
    const msg = container.createDiv({ text: 'Complex YAML value — shown read-only to avoid changing its structure.', cls: 'spotlight-ex-complex-note' });
    const pre = container.createEl('pre', { cls: 'spotlight-ex-complex-value' });
    try {
      pre.setText(JSON.stringify(rawValue, null, 2));
    } catch (_err) {
      pre.setText(String(rawValue));
    }
  }

  renderReadOnlyValue(entry, propId, container) {
    const valueEl = container.createDiv('spotlight-ex-readonly-value');
    let value;
    try {
      value = entry.getValue(propId);
    } catch (_err) {
      value = null;
    }
    if (value && typeof value.renderTo === 'function') {
      value.renderTo(valueEl, this.app.renderContext);
      if (!valueEl.innerHTML) valueEl.setText('—');
      return;
    }
    const unwrapped = unwrapValue(value);
    if (Array.isArray(unwrapped)) {
      const chips = valueEl.createDiv('spotlight-ex-chip-list');
      if (!unwrapped.length) chips.createSpan({ text: '—', cls: 'spotlight-ex-empty-value' });
      unwrapped.forEach((item) => {
        const chip = chips.createDiv('spotlight-ex-chip spotlight-ex-chip-readonly');
        chip.createSpan({ text: toComparableString(item), cls: 'spotlight-ex-chip-label' });
      });
      return;
    }
    const text = toComparableString(unwrapped);
    valueEl.setText(text || '—');
    if (!text) valueEl.addClass('spotlight-ex-empty-value');
  }

  renderHyperlinkProperty(entry, container, propId) {
    container.empty();
    const value = entry.getValue(propId);
    const text = this.formatValue(value) || '—';
    const link = container.createDiv({ text, cls: 'spotlight-ex-hyperlink-value' });
    link.title = 'Open current file (Ctrl/Cmd+Click for a new pane)';
    link.addEventListener('click', (event) => {
      if (!(entry.file instanceof TFile)) return;
      const newLeaf = event.ctrlKey || event.metaKey || event.button === 1;
      this.app.workspace.getLeaf(newLeaf).openFile(entry.file);
    });
  }

  writeProperty(sourceFile, key, value, expectedType = null) {
    const propertyKey = `${sourceFile.path}\0${key}`;
    this.pendingPropertyWrites.set(propertyKey, (this.pendingPropertyWrites.get(propertyKey) || 0) + 1);
    this.pendingWrites += 1;
    const task = this.writeQueue.then(() => this.commitProperty(sourceFile, key, value, expectedType));
    this.writeQueue = task.catch(() => null);
    return task.finally(() => {
      this.pendingWrites -= 1;
      const count = this.pendingPropertyWrites.get(propertyKey) - 1;
      if (count) this.pendingPropertyWrites.set(propertyKey, count);
      else this.pendingPropertyWrites.delete(propertyKey);
      this.scheduleDataRender();
    });
  }

  async commitProperty(sourceFile, key, value, expectedType) {
    const metadataFile = await this.ensureMetadataFile(sourceFile);
    if (!(metadataFile instanceof TFile)) {
      if (sourceFile instanceof TFile && sourceFile.extension !== 'md' && !this.plugin.settings.createBinarySidecars) {
        new Notice('Enable “Create sidecars for attachments” to edit attachment metadata.');
      }
      return null;
    }
    try {
      let writtenValue;
      await this.app.fileManager.processFrontMatter(metadataFile, (frontmatter) => {
        if (expectedType && this.getPropertyType(key, frontmatter[key]) !== expectedType) {
          throw new Error('Property type changed before this edit was saved.');
        }
        writtenValue = typeof value === 'function' ? value(frontmatter[key]) : value;
        if (expectedType && !validPropertyValue(expectedType, writtenValue)) {
          throw new Error('Value does not match the current property type.');
        }
        frontmatter[key] = writtenValue;
      });
      return { value: writtenValue };
    } catch (err) {
      console.error('[Spotlight EX] Property write failed', err);
      new Notice(`Could not update property “${key}”.`);
      return null;
    }
  }

  getPropName(propId) {
    const parts = String(propId).split('.');
    return parts.length > 1 ? parts.slice(1).join('.') : String(propId);
  }

  formatValue(value) {
    const unwrapped = unwrapValue(value);
    if (unwrapped == null) return '';
    if (Array.isArray(unwrapped)) return unwrapped.map((v) => this.formatValue(v)).join(', ');
    if (isObject(unwrapped)) {
      try { return JSON.stringify(unwrapped); } catch (_err) { return String(unwrapped); }
    }
    return String(unwrapped);
  }

  renderFileContent(file, containerEl, token) {
    this.centerEl.removeClasses([
      'spotlight-ex-center-no-padding',
      'spotlight-ex-center-media-mode',
      'spotlight-ex-center-pdf-mode',
    ]);

    const ext = file.extension.toLowerCase();
    const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'heic', 'heif']);

    if (imageExtensions.has(ext)) {
      this.centerEl.addClasses(['spotlight-ex-center-no-padding', 'spotlight-ex-center-media-mode']);
      containerEl.empty();
      containerEl.addClass('spotlight-ex-center-media-container');
      const resourcePath = this.app.vault.getResourcePath(file);
      containerEl.createEl('img', { attr: { src: resourcePath, alt: file.basename }, cls: 'spotlight-ex-media' });
      return;
    }

    if (ext === 'pdf') {
      this.centerEl.addClasses(['spotlight-ex-center-no-padding', 'spotlight-ex-center-pdf-mode']);
      containerEl.empty();
      containerEl.addClass('spotlight-ex-center-pdf-container');
      this.app.vault.readBinary(file).then((buffer) => {
        if (this.renderToken !== token) return;
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        this.activePdfBlobUrls.push(url);
        containerEl.createEl('iframe', {
          cls: 'spotlight-ex-pdf-iframe',
          attr: { src: url, type: 'application/pdf', title: file.basename },
        });
      }).catch((err) => {
        console.error(err);
        if (this.renderToken !== token) return;
        containerEl.empty();
        containerEl.createDiv({ text: `Could not load PDF content for ${file.name}.`, cls: 'spotlight-ex-error-message' });
      });
      return;
    }

    this.app.vault.cachedRead(file).then((content) => {
      if (this.renderToken !== token) return;
      containerEl.empty();
      containerEl.addClasses(['markdown-rendered', 'markdown-preview-view']);
      MarkdownRenderer.render(this.app, content, containerEl, file.path, this).catch((err) => {
        console.error('[Spotlight EX] Markdown render failed', err);
      });
    }).catch((err) => {
      console.error(err);
      if (this.renderToken !== token) return;
      containerEl.empty();
      containerEl.createDiv({ text: `Could not load content for ${file.name}.`, cls: 'spotlight-ex-error-message' });
    });
  }
}

class SpotlightEXSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.activeTab = 'general';
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('spotlight-ex-settings');

    containerEl.createEl('h2', { text: 'Spotlight EX' });
    const tabs = containerEl.createDiv('spotlight-ex-settings-tabs');
    const generalTab = tabs.createEl('button', { text: 'General', cls: 'spotlight-ex-settings-tab' });
    const setupTab = tabs.createEl('button', { text: 'Setup', cls: 'spotlight-ex-settings-tab' });
    const creditsTab = tabs.createEl('button', { text: 'Credits & License', cls: 'spotlight-ex-settings-tab' });
    generalTab.toggleClass('is-active', this.activeTab === 'general');
    setupTab.toggleClass('is-active', this.activeTab === 'setup');
    creditsTab.toggleClass('is-active', this.activeTab === 'credits');
    generalTab.addEventListener('click', () => { this.activeTab = 'general'; this.display(); });
    setupTab.addEventListener('click', () => { this.activeTab = 'setup'; this.display(); });
    creditsTab.addEventListener('click', () => { this.activeTab = 'credits'; this.display(); });

    const body = containerEl.createDiv('spotlight-ex-settings-body');
    if (this.activeTab === 'credits') this.renderCredits(body);
    else if (this.activeTab === 'setup') this.renderSetup(body);
    else this.renderGeneral(body);
  }

  renderSetup(containerEl) {
    const guide = containerEl.createDiv('spotlight-ex-setup-guide');
    guide.createEl('h3', { text: 'Configure a Base' });
    const steps = guide.createEl('ol');
    for (const step of [
      'Enable Bases under Settings → Core plugins and Spotlight EX under Settings → Community plugins.',
      'Open an existing .base file, or run “Bases: Create new base” from the command palette.',
      'Click the view name at the top left → Add view. Name it, then choose Spotlight EX as its layout. To change an existing view, click the arrow beside its name (or right-click the view name) and select Spotlight EX under Layout.',
      'Use Properties in the Base toolbar to choose the fields shown in the sidebar. Use Filter to limit the files and Sort to set their navigation order.',
      'Open the view settings again to configure Spotlight Content Property and Hyperlink Property if needed.',
    ]) steps.createEl('li', { text: step });

    guide.createEl('h3', { text: 'Preview and navigation options' });
    const options = guide.createEl('ul');
    options.createEl('li', { text: 'Spotlight Content Property: select a property containing a [[wikilink]] to another file to preview. Leave it empty to preview the current entry.' });
    options.createEl('li', { text: 'Hyperlink Property: select a displayed field whose value should open the current Base entry when clicked.' });
    guide.createEl('p', { text: 'Use Previous / Next or the arrow keys to browse. Arrow keys inside property editors remain available for editing. If the Base is empty, check its filters.' });
    guide.createEl('p', { text: 'Use the General tab here for editing preferences, suggestions, attachment sidecars, and sidebar width. Layout, displayed properties, filters, and sorting are configured separately for each Base view.' });
    const link = guide.createEl('a', { text: 'Full setup guide on GitHub', href: `${REPOSITORY_URL}#configure-a-base` });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener noreferrer');
  }

  renderGeneral(containerEl) {
    containerEl.createEl('h3', { text: 'Property editing' });

    this.addReset(new Setting(containerEl)
      .setName('Always show remove × buttons')
      .setDesc('Every List/Tags item always has its × visible. If disabled, the same one-click × appears on hover/focus instead. Values remain real YAML array items.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.removeButtonAlwaysVisible)
        .onChange(async (value) => {
          this.plugin.settings.removeButtonAlwaysVisible = value;
          await this.plugin.saveSettings();
        })), 'removeButtonAlwaysVisible');

    this.addReset(new Setting(containerEl)
      .setName('Show “+ Add value”')
      .setDesc('Adds a compact editor with suggestions for List and Tags properties.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showAddValueButton)
        .onChange(async (value) => {
          this.plugin.settings.showAddValueButton = value;
          await this.plugin.saveSettings();
        })), 'showAddValueButton');

    this.addReset(new Setting(containerEl)
      .setName('Prevent duplicate list values')
      .setDesc('Avoids adding the exact same list/tag value twice.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.preventDuplicateListValues)
        .onChange(async (value) => {
          this.plugin.settings.preventDuplicateListValues = value;
          await this.plugin.saveSettings();
        })), 'preventDuplicateListValues');

    this.addReset(new Setting(containerEl)
      .setName('Suggestion source')
      .setDesc('Choose where autocomplete suggestions for List and Tags properties come from.')
      .addDropdown((dropdown) => dropdown
        .addOption('vault', 'Whole vault')
        .addOption('base', 'Current Base results')
        .setValue(this.plugin.settings.suggestionScope)
        .onChange(async (value) => {
          this.plugin.settings.suggestionScope = value;
          await this.plugin.saveSettings();
        })), 'suggestionScope');

    this.addReset(new Setting(containerEl)
      .setName('Maximum suggestions')
      .setDesc('Maximum number of autocomplete values shown at once.')
      .addText((text) => text
        .setPlaceholder('12')
        .setValue(String(this.plugin.settings.maxSuggestions))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed) && parsed > 0) {
            this.plugin.settings.maxSuggestions = Math.min(100, parsed);
            await this.plugin.saveSettings();
          }
        })), 'maxSuggestions');

    this.addReset(new Setting(containerEl)
      .setName('Display # for Tags')
      .setDesc('Visual only. Stored tag values are not rewritten just to add a #.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.tagHashDisplay)
        .onChange(async (value) => {
          this.plugin.settings.tagHashDisplay = value;
          await this.plugin.saveSettings();
        })), 'tagHashDisplay');

    this.addReset(new Setting(containerEl)
      .setName('Show property type icons and labels')
      .setDesc('Shows the native type icon beside each property name and a type label. On by default. Click an editable type icon to change its vault-wide type.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showTypeBadge)
        .onChange(async (value) => {
          this.plugin.settings.showTypeBadge = value;
          await this.plugin.saveSettings();
        })), 'showTypeBadge');

    containerEl.createEl('h3', { text: 'Attachments' });
    this.addReset(new Setting(containerEl)
      .setName('Create sidecars for attachments')
      .setDesc('When editing note properties for images/PDFs, create “filename.ext.md” as the metadata sidecar if it does not already exist.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.createBinarySidecars)
        .onChange(async (value) => {
          this.plugin.settings.createBinarySidecars = value;
          await this.plugin.saveSettings();
        })), 'createBinarySidecars');

    containerEl.createEl('h3', { text: 'Layout' });
    this.addReset(new Setting(containerEl)
      .setName('Default sidebar width')
      .setDesc('The live sidebar resizer also saves its width automatically.')
      .addText((text) => text
        .setPlaceholder('330')
        .setValue(String(this.plugin.settings.sidebarWidth))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed) && parsed >= 180) {
            this.plugin.settings.sidebarWidth = parsed;
            await this.plugin.saveSettings();
          }
        })), 'sidebarWidth');
  }

  addReset(setting, key) {
    const value = DEFAULT_SETTINGS[key];
    const control = setting.components.find((component) => typeof component.setValue === 'function');
    const label = typeof value === 'boolean' ? (value ? 'On' : 'Off')
      : key === 'suggestionScope' ? 'Whole vault' : String(value);
    const tooltip = `Reset ${setting.nameEl.textContent} to default (${label})`;
    return setting.addExtraButton((button) => {
      button.setIcon('rotate-ccw').setTooltip(tooltip).onClick(async () => {
        this.plugin.settings[key] = value;
        control.setValue(typeof value === 'number' ? String(value) : value);
        await this.plugin.saveSettings();
      });
      const el = button.extraSettingsEl;
      el.addClass('spotlight-ex-setting-reset');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', tooltip);
      el.tabIndex = 0;
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          el.click();
        }
      });
    });
  }

  renderCredits(containerEl) {
    containerEl.createEl('h3', { text: 'Thanks & attribution' });
    const credit = containerEl.createDiv('spotlight-ex-credit-card');
    credit.createEl('p', {
      text: 'Spotlight EX is a derivative of Bases Spotlight View by Brendan Early (mymindstorm). Thank you for creating and releasing the original plugin under the MIT License.',
    });
    const link = credit.createEl('a', {
      text: 'Original project on GitHub',
      href: UPSTREAM_URL,
      cls: 'spotlight-ex-upstream-link',
    });
    link.setAttr('target', '_blank');
    link.setAttr('rel', 'noopener noreferrer');

    containerEl.createEl('h3', { text: 'Original MIT License' });
    containerEl.createEl('p', {
      text: 'The original copyright notice and permission notice are preserved below and in the bundled LICENSE file, as required by the MIT License.',
    });
    const pre = containerEl.createEl('pre', { cls: 'spotlight-ex-license-text' });
    pre.setText(ORIGINAL_MIT_LICENSE);
  }
}

module.exports = class SpotlightEXPlugin extends Plugin {
  async onload() {
    this.views = new Set();
    await this.loadSettings();
    await this.loadStoredPropertyTypes();
    this.watchPropertyChanges();

    this.registerBasesView(VIEW_TYPE, {
      name: 'Spotlight EX',
      icon: 'presentation',
      factory: (controller, containerEl) => new SpotlightEXView(controller, containerEl, this),
      options: () => [
        {
          type: 'property',
          key: 'spotlight_property',
          displayName: 'Spotlight Content Property',
          description: 'Optional property containing a [[wikilink]] to the file shown in the large preview pane.',
        },
        {
          type: 'property',
          key: 'hyperlink_property',
          displayName: 'Hyperlink Property',
          description: 'Optional displayed property that opens the current Base entry when clicked.',
        },
      ],
    });

    this.addSettingTab(new SpotlightEXSettingTab(this.app, this));
  }

  watchPropertyChanges() {
    const refreshTypes = () => {
      for (const view of this.views) view.syncSidebarProperties();
    };
    const manager = this.app.metadataTypeManager;
    if (manager?.on) {
      this.registerEvent(manager.on('changed', () => {
        refreshTypes();
        this.loadStoredPropertyTypes().then(refreshTypes);
      }));
    }
    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      for (const view of this.views) {
        const entry = view.filteredEntries.find((item) => item.file.path === view.renderedFilePath);
        if (entry && view.getMetadataFile(entry.file)?.path === file.path) view.syncSidebarProperties();
      }
    }));
    // Obsidian also uses the raw config-file event to observe external type changes.
    this.registerEvent(this.app.vault.on('raw', (path) => {
      if (path === `${this.app.vault.configDir || '.obsidian'}/types.json`) {
        this.loadStoredPropertyTypes().then(refreshTypes);
      }
    }));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.propertyHeights = this.settings.propertyHeights || {};
    this.settings.propertyOrder = this.settings.propertyOrder || [];
  }

  async loadStoredPropertyTypes() {
    this.storedPropertyTypes = {};
    try {
      const configDir = this.app.vault.configDir || '.obsidian';
      const path = `${configDir}/types.json`;
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.types && typeof parsed.types === 'object') {
          this.storedPropertyTypes = parsed.types;
        }
      }
    } catch (err) {
      console.warn('[Spotlight EX] Could not read types.json fallback', err);
    }
  }

  getStoredPropertyType(key) {
    if (!this.storedPropertyTypes) return null;
    if (this.storedPropertyTypes[key]) return this.storedPropertyTypes[key];
    const lower = String(key).toLowerCase();
    if (this.storedPropertyTypes[lower]) return this.storedPropertyTypes[lower];
    const match = Object.keys(this.storedPropertyTypes).find((candidate) => candidate.toLowerCase() === lower);
    return match ? this.storedPropertyTypes[match] : null;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const view of this.views || []) {
      view.sidebarWidth = this.settings.sidebarWidth;
      view.sidebarEl.style.width = `${view.sidebarWidth}px`;
      view.onDataUpdated();
    }
  }
};

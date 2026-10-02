(() => {
  const pause = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const key = (input, value, options = {}) => input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }));
  const type = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const click = (element) => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    if (element.dispatchEvent(down)) element.focus();
    element.click();
  };
  const frame = () => new Promise(requestAnimationFrame);
  let fixture;

  function setup(frontmatter = {}, assignedTypes = {}) {
    fixture?.view.onunload();
    fixture?.plugin.unload();
    document.querySelector('#fixture').replaceChildren();
    const root = document.querySelector('#fixture').createDiv();
    const file = new testObsidian.TFile('test.md');
    const fm = { labels: ['alpha'], tags: ['existing'], notes: 'Short text', other: 'Other text', score: 3,
      done: false, date: '2026-10-02', datetime: '2026-10-02T10:30:45', ...frontmatter };
    const types = { labels: 'multitext', tags: 'tags', notes: 'text', other: 'text', score: 'number',
      done: 'checkbox', date: 'date', datetime: 'datetime', ...assignedTypes };
    const manager = new testObsidian.TestEvents();
    const widgets = Object.fromEntries(Object.entries(PROPERTY_TYPES).filter(([, info]) => info.native).map(([type, info]) => [info.native, {
      type: info.native, icon: info.icon,
      render: (container, value, context) => {
        const input = container.createEl('input', { type: 'text', cls: 'test-native-widget' }); input.value = value || '';
        input.addEventListener('change', () => context.onChange(input.value));
        input.addEventListener('keydown', (event) => { if (event.key === 'Enter') context.onChange(input.value); });
      },
    }]));
    manager.getAssignedWidget = (key) => types[Object.keys(types).find((name) => name.toLowerCase() === key.toLowerCase())] || null;
    manager.getWidget = (type) => widgets[type] || { type: 'unknown' };
    manager.getTypeInfo = (key, raw) => ({ expected: manager.getWidget(manager.getAssignedWidget(key) || PROPERTY_TYPES[normalizeType(null, key, raw)]?.native) });
    manager.getPropertyInfo = (key) => ({ name: key, widget: manager.getAssignedWidget(key) || 'text', occurrences: 1 });
    manager.setType = async (key, type) => { types[key] = type; manager.trigger('changed', key.toLowerCase()); };
    const cache = new testObsidian.TestEvents(); cache.getFileCache = () => ({ frontmatter: fm });
    const vault = new testObsidian.TestEvents();
    Object.assign(vault, { getAbstractFileByPath: () => file, getMarkdownFiles: () => [file],
      adapter: { exists: async () => true, read: async () => JSON.stringify({ types }) } });
    let view;
    const leaf = { view: { containerEl: root } };
    const workspace = {
      activeLeaf: null,
      iterateAllLeaves: (callback) => callback(leaf),
      setActiveLeaf: (next, options) => {
        assert(options.focus === false, 'Activating pane stole native focus');
        workspace.activeLeaf = next;
        view.onDataUpdated();
      },
    };
    const app = {
      workspace,
      vault, metadataCache: cache, metadataTypeManager: manager,
      fileManager: { processFrontMatter: async (_file, callback) => {
        await pause(25);
        if (fixture.failNext) { fixture.failNext = false; throw new Error('Expected test failure'); }
        callback(fm);
        cache.trigger('changed', file); view.onDataUpdated();
        // Simulate a delayed metadata refresh after the write has returned.
        setTimeout(() => view.onDataUpdated(), 5);
      } },
    };
    const plugin = new module.exports(); plugin.app = app; plugin.views = new Set();
    plugin.settings = { ...DEFAULT_SETTINGS, propertyHeights: {}, propertyOrder: [], suggestionScope: 'base' };
    plugin.storedPropertyTypes = { ...types };
    plugin.saveData = async (settings) => {
      const status = document.querySelector('#settings-status');
      status.textContent = 'Settings saved in the preview.';
      status.dataset.saved = JSON.stringify(settings);
    };
    plugin.watchPropertyChanges();
    view = new SpotlightExpandedView({ app }, root, plugin);
    fixture = { view, fm, workspace, leaf, plugin, types, manager, cache, file, vault };
    view.config = { get: () => null, getDisplayName: (id) => id.replace(/^note\./, '') };
    view.data = { data: [{ file }], properties: Object.keys(fm).map((key) => `note.${key}`) };
    view.renderFileContent = (_file, container) => container.createDiv({ text: 'Preview area — metadata edits are kept in memory.' });
    view.render();
    return fixture;
  }
  const field = (name) => fixture.view.sidebarEl.querySelector(`[data-prop="note.${name}"]`);
  const open = (name) => {
    click(field(name).querySelector('.spotlight-expanded-add-button'));
    return field(name).querySelector('input');
  };
  const settled = async () => { await fixture.view.writeQueue; await pause(20); };

  const cases = [
    ['Empty dashes and checkboxes follow actual icon geometry across appearances without replacing inputs', async () => {
      const appearance = document.body.dataset.appearance;
      try {
        setup({ labels: [], done: null });
        const checkbox = field('done').querySelector('input');
        for (const variant of ['basic', 'obsidian', 'large', 'obsidian']) {
          document.body.dataset.appearance = variant;
          await frame(); await frame();
          for (const name of ['labels', 'done']) {
            const row = field(name);
            const icon = row.querySelector('.spotlight-expanded-type-icon').getBoundingClientRect();
            const value = row.querySelector('.spotlight-expanded-empty-value, .spotlight-expanded-checkbox').getBoundingClientRect();
            assert(Math.abs(icon.left + icon.width / 2 - value.left - value.width / 2) < 0.75, `${name} is off-center in ${variant}`);
            if (variant === 'large') assert(icon.width === 52, 'The oversized theme was not applied');
          }
          const name = field('done').querySelector('.spotlight-expanded-property-name').getBoundingClientRect();
          const label = field('done').querySelector('.spotlight-expanded-checkbox-label').getBoundingClientRect();
          assert(Math.abs(name.left - label.left) < 0.75, `Checkbox label is misaligned in ${variant}`);
          assert(checkbox === field('done').querySelector('input') && checkbox.indeterminate, 'Appearance change replaced or changed the checkbox');
        }
      } finally { document.body.dataset.appearance = appearance; }
    }],
    ['Property type icons and labels are on by default for every standard editor', async () => {
      setup();
      assert(DEFAULT_SETTINGS.showTypeBadge, 'Type display default is off');
      for (const [name, type] of Object.entries({ labels: 'list', tags: 'tags', notes: 'text', score: 'number', done: 'checkbox', date: 'date', datetime: 'datetime' })) {
        const row = field(name);
        assert(row.dataset.type === type, `Wrong ${name} editor`);
        const icon = row.querySelector('.spotlight-expanded-type-icon');
        assert(icon?.querySelector('svg') && icon.dataset.icon === PROPERTY_TYPES[type].icon, `Missing native ${type} icon`);
        assert(row.querySelector('.spotlight-expanded-type-badge').textContent === PROPERTY_TYPES[type].name, `Wrong ${type} label`);
        assert(icon.nextElementSibling.classList.contains('spotlight-expanded-property-name'), 'Icon is not beside the name');
      }
    }],
    ['All native scalar editors save the correct YAML types and empty values', async () => {
      setup();
      for (const [name, value, expected] of [['score', '3.75', 3.75], ['date', '2026-11-04', '2026-11-04'], ['datetime', '2026-11-04T14:15:30', '2026-11-04T14:15:30']]) {
        const input = field(name).querySelector('input.spotlight-expanded-scalar-input'); click(input); type(input, value); key(input, 'Enter'); await settled();
        assert(fixture.fm[name] === expected, `Wrong stored ${name} type or format`);
        type(input, ''); key(input, 'Enter'); await settled(); assert(fixture.fm[name] === null, `Clearing ${name} did not save an empty value`);
      }
      const checkbox = field('done').querySelector('input'); click(checkbox); await settled();
      assert(fixture.fm.done === true, 'Checkbox was not saved as boolean');
    }],
    ['External type changes replace the editor without a plugin reload', async () => {
      setup();
      await fixture.manager.setType('labels', 'text');
      assert(field('labels').dataset.type === 'text' && field('labels').querySelector('textarea'), 'List did not switch to Text');
      assert(field('labels').querySelector('.spotlight-expanded-type-mismatch'), 'Incompatible old array was silently flattened');
      await fixture.manager.setType('labels', 'datetime');
      assert(field('labels').querySelector('input[type="datetime-local"]'), 'Text did not switch to Date & time');
      assert(field('labels').querySelector('.spotlight-expanded-type-icon').dataset.icon === 'lucide-clock', 'Type icon did not update');
      assert(Array.isArray(fixture.fm.labels), 'Changing the displayed type rewrote stored values');
    }],
    ['The property icon changes the shared Obsidian type', async () => {
      setup(); click(field('notes').querySelector('.spotlight-expanded-type-icon'));
      const option = Array.from(document.querySelectorAll('.test-type-menu button')).find((item) => item.textContent === 'Date & time');
      assert(option, 'Type menu did not include Date & time'); click(option); await pause();
      assert(fixture.types.notes === 'datetime' && field('notes').querySelector('input[type="datetime-local"]'), 'Type selection did not sync with the native registry');
    }],
    ['External value updates sync while a different field has an unfinished draft', async () => {
      setup(); const draft = open('labels'); type(draft, 'keep this'); fixture.fm.other = 'changed elsewhere';
      fixture.cache.trigger('changed', fixture.file);
      assert(field('other').querySelector('textarea').value === 'changed elsewhere', 'Inactive value did not sync');
      assert(document.activeElement === draft && draft.value === 'keep this', 'Another property refresh interrupted input');
    }],
    ['Type changes preserve an unfinished value and prevent stale typed writes', async () => {
      setup(); const draft = open('labels'); type(draft, 'do not lose this');
      await fixture.manager.setType('labels', 'date');
      assert(field('labels').querySelector('input[type="date"]'), 'Editor still has the old type');
      assert(field('labels').querySelector('.spotlight-expanded-recovered-draft pre').textContent === 'do not lose this', 'Unfinished draft was discarded');
      setup(); const input = open('labels'); type(input, 'queued list item'); key(input, 'Enter');
      await fixture.manager.setType('labels', 'number'); await settled();
      assert(fixture.fm.labels.join(',') === 'alpha', 'An old list write overwrote a new Number type');
      assert(field('labels').querySelector('.spotlight-expanded-recovered-draft pre').textContent === 'queued list item', 'Rejected queued value was lost');
    }],
    ['Reserved aliases and CSS classes stay as arrays and empty checkbox stays indeterminate', async () => {
      setup({ aliases: ['Known name'], cssclasses: ['wide'], done: null }, { aliases: 'aliases', cssclasses: 'multitext' });
      const alias = open('aliases'); type(alias, 'Another name'); key(alias, 'Enter'); await settled();
      assert(Array.isArray(fixture.fm.aliases) && fixture.fm.aliases.includes('Another name'), 'Alias type was flattened');
      assert(field('tags').querySelector('.spotlight-expanded-type-icon').disabled, 'Reserved Tags can be reassigned');
      assert(field('done').querySelector('input').indeterminate, 'Empty checkbox became false');
    }],
    ['Available File, Folder and Property editors use native widgets and save text', async () => {
      setup({ attachment: 'Beach Room.jpg', folder: 'Files', relatedProperty: 'labels' }, { attachment: 'file', folder: 'folder', relatedProperty: 'property' });
      for (const [name, next] of [['attachment', 'Other.jpg'], ['folder', 'Notes'], ['relatedProperty', 'tags']]) {
        const input = field(name).querySelector('.test-native-widget'); assert(input, `Missing native ${name} widget`);
        click(input); type(input, next); key(input, 'Enter'); await settled();
        assert(fixture.fm[name] === next, `${name} did not save`);
      }
    }],
    ['Dates with offsets show local time while refresh leaves the stored timestamp unchanged', async () => {
      const timestamp = '2026-10-02T10:30:45Z'; setup({ datetime: timestamp });
      const input = field('datetime').querySelector('input');
      assert(input.value === localDateTimeValue(timestamp), 'Zoned date was treated as local wall time');
      fixture.view.onDataUpdated(); assert(fixture.fm.datetime === timestamp, 'Rendering changed the stored offset');
    }],
    ['Type changes preserve drafts in native file picker widgets', async () => {
      setup({ attachment: 'Beach Room.jpg' }, { attachment: 'file' });
      const input = field('attachment').querySelector('.test-native-widget'); click(input); type(input, 'unfinished.jpg');
      await fixture.manager.setType('attachment', 'folder');
      assert(field('attachment').dataset.type === 'folder', 'Native picker type did not update');
      assert(field('attachment').querySelector('.spotlight-expanded-recovered-draft pre').textContent === 'unfinished.jpg', 'Native picker draft was discarded');
      assert(fixture.fm.attachment === 'Beach Room.jpg', 'Type change silently saved the unfinished picker value');
    }],
    ['Embed syntax stays literal while normal wikilinks keep their link labels', async () => {
      setup({ labels: ['![[adssa]]', '[[asdas]]', '![[Folder/adssa#Section|Shown]]', '[[Folder/asdas#Section|Alias]]'] });
      const labels = Array.from(field('labels').querySelectorAll('.spotlight-expanded-chip-label'));
      assert(labels[0].textContent === '![[adssa]]' && !labels[0].classList.contains('spotlight-expanded-chip-link'), 'Embed syntax was collapsed into a regular link');
      assert(labels[1].textContent === 'asdas' && labels[1].classList.contains('spotlight-expanded-chip-link'), 'Regular wikilink stopped rendering as a link');
      assert(labels[2].textContent === '![[Folder/adssa#Section|Shown]]' && !labels[2].classList.contains('spotlight-expanded-chip-link'), 'Embed alias or section was stripped');
      assert(labels[3].textContent === 'Alias' && labels[3].classList.contains('spotlight-expanded-chip-link'), 'Regular wikilink alias was lost');
    }],
    ['Adding and removing an embed preserves the original YAML string', async () => {
      setup(); const input = open('labels'); type(input, '![[adssa]]'); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.includes('![[adssa]]'), 'Embed syntax was changed during saving');
      const chip = Array.from(field('labels').querySelectorAll('.spotlight-expanded-chip')).find((item) => item.querySelector('.spotlight-expanded-chip-label').textContent === '![[adssa]]');
      assert(chip, 'Saved embed was not shown literally');
      click(chip.querySelector('.spotlight-expanded-chip-remove')); await settled();
      assert(fixture.fm.labels.join(',') === 'alpha' && document.activeElement === input, 'Embed removal changed another value or interrupted entry');
    }],
    ['First click in an inactive pane opens and focuses the input', async () => {
      setup(); const input = open('labels'); await pause();
      assert(fixture.workspace.activeLeaf === fixture.leaf, 'Pane did not activate');
      assert(input.isConnected && document.activeElement === input, 'First click lost the editor');
      type(input, 'first-click'); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.includes('first-click'), 'Inactive pane ignored input');
    }],
    ['Enter saves consecutive list values and preserves the next draft through refresh', async () => {
      setup(); const input = open('labels');
      type(input, 'one'); key(input, 'Enter');
      assert(input.value === '' && document.activeElement === input, 'Next value is not ready immediately');
      type(input, 'two'); key(input, 'Enter');
      type(input, 'unsaved draft'); await settled(); fixture.view.onDataUpdated();
      assert(JSON.stringify(fixture.fm.labels) === JSON.stringify(['alpha', 'one', 'two']), 'Rapid values overwrote one another');
      assert(input.isConnected && input.value === 'unsaved draft' && document.activeElement === input, 'Refresh destroyed the draft or focus');
    }],
    ['Concurrent metadata changes survive a list addition', async () => {
      setup(); const input = open('labels'); type(input, 'mine'); key(input, 'Enter');
      fixture.fm.labels.push('external'); await settled();
      assert(fixture.fm.labels.join(',') === 'alpha,external,mine', 'Append used a stale array');
    }],
    ['Duplicate values, including pending saves, are rejected', async () => {
      setup(); const input = open('labels'); type(input, 'one'); key(input, 'Enter');
      type(input, 'one'); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.filter((value) => value === 'one').length === 1, 'Duplicate was saved');
      assert(input.value === 'one', 'Rejected draft disappeared');
    }],
    ['Tag entry normalizes # and Add keeps focus ready', async () => {
      setup(); const input = open('tags'); type(input, '#new-tag');
      click(field('tags').querySelector('.spotlight-expanded-add-confirm')); await settled();
      assert(fixture.fm.tags.includes('new-tag'), 'Tag hash was saved');
      assert(document.activeElement === input && input.value === '', 'Add did not keep the input ready');
    }],
    ['Suggestion selection keeps the same input ready', async () => {
      setup(); fixture.view.getSuggestions = () => ['suggested'];
      const input = open('labels'); key(input, 'ArrowDown'); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.includes('suggested'), 'Suggestion was not saved');
      assert(document.activeElement === input && input.value === '', 'Suggestion closed input');
    }],
    ['Removing a value preserves an active add draft', async () => {
      setup(); const input = open('labels'); type(input, 'draft');
      click(field('labels').querySelector('.spotlight-expanded-chip-remove')); await settled();
      assert(fixture.fm.labels.length === 0, 'Value was not removed');
      assert(input.isConnected && input.value === 'draft', 'Remove destroyed draft');
    }],
    ['A failed write retains the editor and submitted draft', async () => {
      setup(); fixture.failNext = true; const input = open('labels');
      type(input, 'retry me'); key(input, 'Enter'); await settled();
      assert(!fixture.fm.labels.includes('retry me') && input.value === 'retry me', 'Failed write discarded draft');
      key(input, 'Enter'); await settled(); assert(fixture.fm.labels.includes('retry me'), 'Retry failed');
    }],
    ['Clicking a second text field survives the first field saving on blur', async () => {
      setup(); const input = field('notes').querySelector('textarea'); click(input); type(input, 'saved on blur');
      const other = field('other').querySelector('textarea'); click(other); type(other, 'second draft'); await settled();
      assert(fixture.fm.notes === 'saved on blur', 'First field did not save');
      assert(other.isConnected && document.activeElement === other && other.value === 'second draft', 'First save interrupted the second field');
      key(other, 'Enter'); await settled(); assert(fixture.fm.other === 'second draft', 'Enter did not save text');
      assert(document.activeElement === other, 'Enter dropped text focus');
    }],
    ['Composition Enter does not submit unfinished text', async () => {
      setup(); const input = open('labels'); type(input, 'composing'); key(input, 'Enter', { isComposing: true }); await settled();
      assert(!fixture.fm.labels.includes('composing') && input.value === 'composing', 'Composition text was submitted prematurely');
    }],
    ['Numeric lists retain numbers and scalar Enter preserves focus', async () => {
      setup({ labels: [1, 2] }); const input = open('labels'); type(input, '3'); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.every((value) => typeof value === 'number'), 'Numeric array became text');
      const scalar = field('score').querySelector('input'); click(scalar); type(scalar, '4'); key(scalar, 'Enter'); await settled();
      assert(fixture.fm.score === 4 && document.activeElement === scalar, 'Number save lost type or focus');
    }],
    ['Switching away preserves an unfinished list draft through Base refresh', async () => {
      setup(); const input = open('labels'); type(input, 'unsubmitted draft');
      document.querySelector('#deactivate').focus(); fixture.view.onDataUpdated(); await pause();
      assert(input.isConnected && input.value === 'unsubmitted draft', 'Inactive editor lost its draft');
      click(input); key(input, 'Enter'); await settled();
      assert(fixture.fm.labels.includes('unsubmitted draft'), 'Returning to an inactive editor ignored Enter');
    }],
    ['Fields fit long values and the full Add Value row without inner scrolling', async () => {
      setup({ labels: Array.from({ length: 25 }, (_, index) => `A long wrapped value ${index} with further detail`) }); await frame();
      const property = field('labels'); const container = property.querySelector('.spotlight-expanded-property-value-container');
      assert(container.clientHeight > 170 && container.scrollHeight <= container.clientHeight + 1, 'Content still hits the fixed height limit');
      const button = property.querySelector('.spotlight-expanded-add-button');
      assert(button.getBoundingClientRect().bottom <= container.getBoundingClientRect().bottom + 1, 'Add Value is outside the field');
      assert(getComputedStyle(property).flexShrink === '0', 'Sidebar compresses property content');
      fixture.view.sidebarEl.style.width = '220px'; await frame();
      assert(container.scrollWidth <= container.clientWidth + 1, 'Long labels overflow a narrow sidebar');
      const input = open('labels'); await frame();
      const confirm = property.querySelector('.spotlight-expanded-add-confirm');
      assert(input.getBoundingClientRect().right <= confirm.getBoundingClientRect().left, 'Add input overlaps its confirmation button');
    }],
    ['Textareas grow and shrink with text and respond to sidebar width', async () => {
      setup(); const input = field('notes').querySelector('textarea'); const short = input.clientHeight;
      type(input, Array.from({ length: 12 }, () => 'A longer line of text which can wrap.').join('\n')); await frame();
      assert(input.clientHeight > short && input.scrollHeight <= input.clientHeight + 1, 'Textarea clipped long content');
      const wide = input.clientHeight; fixture.view.sidebarEl.style.width = '220px'; await frame(); await frame();
      assert(input.clientHeight > wide, 'Textarea did not grow when sidebar became narrower');
      type(input, 'Short'); await frame(); assert(input.clientHeight < wide, 'Textarea did not shrink');
    }],
    ['Saved manual heights remain minimums while content can grow', async () => {
      setup({ labels: Array.from({ length: 20 }, (_, index) => `Item ${index}`) });
      fixture.plugin.settings.propertyHeights['note.labels'] = 50; fixture.view.render(); await frame();
      const container = field('labels').querySelector('.spotlight-expanded-property-value-container');
      assert(container.style.minHeight === '50px' && container.clientHeight > 50, 'Saved height caps content');
    }],
    ['Deferred Base refresh applies after focus leaves the sidebar', async () => {
      setup(); const input = open('labels'); fixture.view.onDataUpdated();
      assert(fixture.view.pendingDataRender, 'Refresh was not deferred');
      document.querySelector('#deactivate').focus(); await pause();
      assert(!input.isConnected && !fixture.view.pendingDataRender, 'Deferred refresh did not apply');
    }],
  ];

  document.querySelector('#run').onclick = async () => {
    const output = document.querySelector('#results'); output.textContent = 'Running…';
    const results = [];
    for (const [name, run] of cases) {
      try { await run(); results.push(`PASS ${name}`); }
      catch (error) { results.push(`FAIL ${name}: ${error.message}`); }
      output.textContent = results.join('\n');
    }
    const failures = results.filter((result) => result.startsWith('FAIL')).length;
    output.textContent += `\n\n${cases.length - failures}/${cases.length} passed.`;
    output.dataset.complete = 'true'; output.dataset.failures = String(failures);
    setup({ labels: ['A short value', 'A much longer value that should wrap completely as the sidebar gets narrower', '[[asdas]]', '![[adssa]]'], notes: 'Text fields grow as you type.\nAdd another line to try it.' });
  };
  document.querySelector('#deactivate').onclick = () => { fixture.workspace.activeLeaf = null; };
  document.querySelector('#refresh').onclick = () => fixture.view.onDataUpdated();
  document.querySelector('#alignment').onclick = () => {
    setup({ labels: [], done: null });
    fixture.view.data.properties = ['note.labels', 'note.done'];
    fixture.view.config.getDisplayName = (id) => id === 'note.labels' ? 'Related' : 'CurrentStatus';
    fixture.view.render();
  };
  document.querySelector('#settings').onclick = () => {
    const preview = document.querySelector('#settings-preview'); preview.replaceChildren(); preview.hidden = false;
    const tab = new BasesSpotlightExpandedSettingTab(fixture.plugin.app, fixture.plugin);
    preview.append(tab.containerEl); tab.display();
  };
  document.querySelector('#appearance').onchange = (event) => { document.body.dataset.appearance = event.target.value; };
  document.body.dataset.appearance = document.querySelector('#appearance').value;
  setup();
})();

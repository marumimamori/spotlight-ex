import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
const version = process.env.GITHUB_REF_NAME || manifest.version;
if (version !== manifest.version) throw new Error('Release tag and manifest version differ.');
let notes;
try { notes = await readFile(resolve(root, `docs/releases/${version}.md`), 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
  const section = changelog.split(/^## /m).find((entry) => entry.startsWith(`${version} `));
  if (!section) throw new Error(`No changelog section for ${version}.`);
  notes = section.slice(section.indexOf('\n') + 1).trim();
  notes += '\n\nExpanded fork of [Obsidian Bases Spotlight View](https://github.com/mymindstorm/obsidian-bases-spotlight-view) by Brendan Early / mymindstorm. The original MIT license and attribution are included.\n';
}
await mkdir(resolve(root, 'release'), { recursive: true });
await writeFile(resolve(root, 'release/release-notes.md'), notes);
console.log(`Prepared release notes for ${version}.`);

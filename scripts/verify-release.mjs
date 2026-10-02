import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(resolve(root, file));
const manifest = JSON.parse(await read('manifest.json'));
const pkg = JSON.parse(await read('package.json'));
const versions = JSON.parse(await read('versions.json'));
const expected = process.argv[2] || process.env.GITHUB_REF_NAME || manifest.version;
const requireCondition = (condition, message) => { if (!condition) throw new Error(message); };

requireCondition(/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/i.test(expected), 'Release tag must be a version without a leading v.');
requireCondition(manifest.version === expected, 'Manifest version does not match the release tag.');
requireCondition(pkg.version === expected, 'Package version does not match the release tag.');
requireCondition(manifest.id === 'bases-spotlight-view-expanded', 'Unexpected plugin ID.');
requireCondition(manifest.name === 'Spotlight EX', 'Unexpected plugin display name.');
requireCondition(versions[expected] === manifest.minAppVersion, 'versions.json is missing the current minimum app version.');
const readme = (await read('README.md')).toString();
requireCondition(readme.includes(`**Current version:** \`${expected}\``), 'README current version does not match the release.');
requireCondition((await read('src/main.js')).equals(await read('main.js')), 'Build main.js from src/main.js before releasing.');
for (const file of ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'NOTICE.md', 'README.md', 'UPSTREAM.md', 'CHANGELOG.md', 'versions.json']) {
  const original = await read(file);
  requireCondition(original.length > 0, `${file} is empty.`);
  requireCondition(original.equals(await read(`release/${file}`)), `Release copy of ${file} is out of date.`);
}
console.log(`Release ${expected} verified: versions, plugin files, documentation, and attribution match.`);

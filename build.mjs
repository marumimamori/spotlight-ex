import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = resolve(root, 'release');
await copyFile(resolve(root, 'src/main.js'), resolve(root, 'main.js'));
await mkdir(out, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'NOTICE.md', 'README.md', 'UPSTREAM.md', 'CHANGELOG.md', 'versions.json']) {
  await copyFile(resolve(root, file), resolve(out, file));
}
console.log(`Built manual-install bundle at ${out}`);

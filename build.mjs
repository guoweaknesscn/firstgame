import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/client', { recursive: true });
await mkdir('dist/server', { recursive: true });

for (const file of ['index.html', 'style.css', 'game.js']) {
  await cp(file, `dist/client/${file}`);
}

await writeFile('dist/server/index.js', `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};\n`);

console.log('BEAT//BACK production build ready.');

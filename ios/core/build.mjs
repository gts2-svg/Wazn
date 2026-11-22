// يجمع نواة «وزن» (المحرك والذكاء الاصطناعي من src/) في ملف واحد يشغّله التطبيق داخل JavaScriptCore.
// الاستعمال: npx esbuild متاح (npm i esbuild)، ثم: node ios/core/build.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(here, 'entry.js')],
  bundle: true,
  format: 'iife',
  target: 'safari16',
  charset: 'utf8',
  legalComments: 'none',
  outfile: path.join(here, '..', 'App', 'JS', 'wazn-core.js'),
  banner: { js: '// مولَّد آلياً من src/ بالأمر node ios/core/build.mjs — لا تعدّله يدوياً' },
});
console.log('built ios/App/JS/wazn-core.js');

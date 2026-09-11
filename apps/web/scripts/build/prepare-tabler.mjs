import { compileString } from 'sass';
import rtlcss from 'rtlcss';
import { mkdir, writeFile } from 'node:fs/promises';

// Keep Tabler's components, but let the existing Tailwind utilities win via CSS layers.
// RTL is generated with the same rtlcss tooling used by Tabler's distribution.
const result = compileString(
  `@use '@tabler/core/scss/tabler' with (
  $enable-important-utilities: false,
  $enable-cssgrid: false,
  $font-google: null,
  $font-google-monospaced: null,
  $font-family-sans-serif: ('Noto Sans Arabic Variable', 'Segoe UI', Arial, sans-serif),
  $primary: #206bc4
);`,
  { loadPaths: ['node_modules'], style: 'expanded', quietDeps: true, charset: false },
);
const css = rtlcss.process(result.css);
await mkdir('src/styles', { recursive: true });
await writeFile(
  'src/styles/tabler.generated.css',
  '/*! Tabler 1.5.1 — MIT. See docs/licenses/Tabler-LICENSE.txt */\n' + css,
);
console.log('Tabler RTL theme prepared');

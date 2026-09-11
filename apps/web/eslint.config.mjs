import core from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
const config = [
  ...core,
  ...ts,
  prettier,
  { ignores: ['.next/**', 'node_modules/**', 'data/**', 'coverage/**', 'next-env.d.ts', 'public/maplibre/**', 'test-results/**', 'playwright-report/**'] },
];

export default config;

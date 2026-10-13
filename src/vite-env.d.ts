/// <reference types="vite/client" />

// Injected at build time by `define` in configs/vite.config.ts (and configs/vitest.config.ts and
// configs/storybook/main.ts) from the version in package.json; see resolveAppVersion in
// @brain-bbqs/config.
declare const __APP_VERSION__: string;

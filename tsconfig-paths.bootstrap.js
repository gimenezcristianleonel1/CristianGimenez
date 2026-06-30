/**
 * Runtime resolver for the `@core`, `@infrastructure`, `@modules` and
 * `@shared` path aliases when running the COMPILED app (dist/).
 * Usage: node -r ./tsconfig-paths.bootstrap.js dist/main.js
 *
 * `nest start` (dev) handles aliases on its own; this is only for production.
 */
const path = require('node:path');
const tsConfigPaths = require('tsconfig-paths');

tsConfigPaths.register({
  baseUrl: path.join(__dirname, 'dist'),
  paths: {
    '@core/*': ['core/*'],
    '@infrastructure/*': ['infrastructure/*'],
    '@modules/*': ['modules/*'],
    '@shared/*': ['shared/*'],
  },
});

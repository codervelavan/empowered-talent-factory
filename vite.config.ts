import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES, type RouteDef } from './src/app/routes';

/** Where the site is published (GitHub Pages project site). */
const BASE = '/empowered-talent-factory/';
const ORIGIN = 'https://codervelavan.github.io';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Head tags and readable text for one route, written into a copy of the built page. */
function pageFor(html: string, r: RouteDef): string {
  const url = ORIGIN + BASE + r.path;
  const head = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(r.title)}">`,
    `<meta property="og:description" content="${esc(r.description)}">`,
    `<meta property="og:url" content="${url}">`,
  ].join('');
  const links = ROUTES.map((x) => `<li><a href="${BASE + x.path}">${esc(x.heading)}</a></li>`).join('');
  // Readable text for search engines and screen readers; the 3D view and the standard page show the same content.
  const doc = `<main id="routeDoc" class="srx"><h1>${esc(r.heading)}</h1>${r.body.map((p) => `<p>${esc(p)}</p>`).join('')}<nav aria-label="Explore EmpowerED"><ul>${links}</ul></nav></main>`;
  return html.replace(/<title>[\s\S]*?<\/title>/, head).replace(/<body([^>]*)>/, `<body$1>${doc}`);
}

/** After the build, write a real HTML page for every route, plus a 404 page that opens the site. */
function routePages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'route-pages',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      for (const r of ROUTES) {
        const dir = join(outDir, r.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), pageFor(html, r));
      }
      writeFileSync(join(outDir, '404.html'), pageFor(html, ROUTES[0]));
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  // Real paths (/career/assurance/) need an absolute base in production; dev serves from the root.
  base: command === 'build' || isPreview ? BASE : '/',
  plugins: [routePages()],
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; it's one chunk by design.
    chunkSizeWarningLimit: 900,
  },
}));

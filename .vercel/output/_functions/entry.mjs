import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_D-d_SEIt.mjs';
import { manifest } from './manifest_Bmwu0F3d.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/about.astro.mjs');
const _page2 = () => import('./pages/api/views.astro.mjs');
const _page3 = () => import('./pages/archives.astro.mjs');
const _page4 = () => import('./pages/blog/_page_.astro.mjs');
const _page5 = () => import('./pages/blog.astro.mjs');
const _page6 = () => import('./pages/gallery.astro.mjs');
const _page7 = () => import('./pages/projects.astro.mjs');
const _page8 = () => import('./pages/reading.astro.mjs');
const _page9 = () => import('./pages/robots.txt.astro.mjs');
const _page10 = () => import('./pages/rss.xml.astro.mjs');
const _page11 = () => import('./pages/sites.astro.mjs');
const _page12 = () => import('./pages/tags/_tag_.astro.mjs');
const _page13 = () => import('./pages/tags.astro.mjs');
const _page14 = () => import('./pages/timeline.astro.mjs');
const _page15 = () => import('./pages/tutorials/_series_.astro.mjs');
const _page16 = () => import('./pages/tutorials.astro.mjs');
const _page17 = () => import('./pages/types/_domain_.astro.mjs');
const _page18 = () => import('./pages/types.astro.mjs');
const _page19 = () => import('./pages/_prefix_/_code_.astro.mjs');
const _page20 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/api/views.ts", _page2],
    ["src/pages/archives.astro", _page3],
    ["src/pages/blog/[page].astro", _page4],
    ["src/pages/blog/index.astro", _page5],
    ["src/pages/gallery.astro", _page6],
    ["src/pages/projects/index.astro", _page7],
    ["src/pages/reading.astro", _page8],
    ["src/pages/robots.txt.ts", _page9],
    ["src/pages/rss.xml.ts", _page10],
    ["src/pages/sites.astro", _page11],
    ["src/pages/tags/[tag].astro", _page12],
    ["src/pages/tags/index.astro", _page13],
    ["src/pages/timeline.astro", _page14],
    ["src/pages/tutorials/[series]/index.astro", _page15],
    ["src/pages/tutorials/index.astro", _page16],
    ["src/pages/types/[domain].astro", _page17],
    ["src/pages/types/index.astro", _page18],
    ["src/pages/[prefix]/[code].astro", _page19],
    ["src/pages/index.astro", _page20]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "b1e45e45-cbc1-4688-8b39-c8df14b7c0b9",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };

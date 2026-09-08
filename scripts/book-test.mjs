import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let Book,
  now = 0,
  rafs = new Map(),
  id = 0;
const ctx = new Proxy(
  {},
  {
    get: (_, key) =>
      key === 'createLinearGradient' || key === 'createRadialGradient'
        ? () => ({ addColorStop() {} })
        : () => {},
  },
);
const controls = new Map();
function control(selector) {
  if (!controls.has(selector))
    controls.set(selector, {
      getContext: () => ctx,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 390,
        height: 600,
      }),
      focus() {},
      setPointerCapture() {},
      hasPointerCapture() {
        return false;
      },
    });
  return controls.get(selector);
}
class Element {
  attachShadow() {
    this.shadowRoot = { querySelector: control };
  }
  dispatchEvent(e) {
    this.lastEvent = e;
  }
}
const sandbox = {
  HTMLElement: Element,
  customElements: {
    get() {},
    define(_, c) {
      Book = c;
    },
  },
  document: { createElement: () => ({ getContext: () => ctx }) },
  window: { devicePixelRatio: 1 },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  CustomEvent: class {
    constructor(name, options) {
      this.type = name;
      this.detail = options.detail;
    }
  },
  performance: { now: () => now },
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: (f) => {
    rafs.set(++id, f);
    return id;
  },
  cancelAnimationFrame: (id) => rafs.delete(id),
};
vm.runInNewContext(
  (
    await readFile(
      new URL('../lib/folio/book/folio-book.js', import.meta.url),
      'utf8',
    )
  ).replace('export {};', ''),
  sandbox,
);
function flush() {
  while (rafs.size) {
    now += 20;
    const jobs = [...rafs.values()];
    rafs.clear();
    jobs.forEach((f) => f(now));
  }
}
const book = new Book(),
  texture = {};
book.setContent({
  cover: texture,
  pages: [0, 1, 2].map((i) => ({ texture, title: `P${i + 1}` })),
});
assert.equal(book.currentSpread, -1);
assert.equal(book.textures[-1], texture);
assert.equal(book.textures.length, 4);
const draws = [];
book.paper = (...args) => draws.push(args);
book.render();
assert.deepEqual(
  draws,
  [[-1, 1]],
  'closed book has exactly one cover, no preceding page',
);
assert.equal(book.previousPage(), false);
book.nextPage();
assert.equal(book.nextPage(), false, 'ignore concurrent turns');
flush();
assert.equal(book.currentSpread, 0);
book.nextPage();
flush();
assert.equal(book.currentSpread, 1);
assert.equal(book.nextPage(), false);
book.previousPage();
flush();
assert.equal(book.currentSpread, 0);
book.previousPage();
flush();
assert.equal(book.currentSpread, -1);
const event = (x, time = now) => ({
  clientX: x,
  clientY: book.cy,
  timeStamp: time,
  pointerId: 1,
  isPrimary: true,
  button: 0,
});
book.down(event(book.cx + book.unit * 0.8));
book.move(event(book.cx + book.unit * 0.8 - 12, now + 150));
book.up(event(book.cx + book.unit * 0.8 - 12, now + 350));
flush();
assert.equal(book.currentSpread, -1, 'short slow drag returns to cover');
book.down(event(book.cx + book.unit * 0.8));
book.move(event(book.cx + book.unit * 0.8 - 35, now + 20));
book.up(event(book.cx + book.unit * 0.8 - 35, now + 25));
flush();
assert.equal(book.currentSpread, 0, 'short fast flick completes');
book.down(event(book.cx - book.unit * 0.8));
book.move(event(book.cx + book.unit * 0.6, now + 200));
book.up(event(book.cx + book.unit * 0.6, now + 250));
flush();
assert.equal(book.currentSpread, -1, 'reverse drag closes first spread');
book.nextPage();
book.disconnectedCallback();
flush();
assert.equal(book.turn, null);
assert.equal(book.textures, null);
console.log(
  'Reference book: cover/spreads, bounds, reverse, slow cancel, fast flick, disposal passed.',
);

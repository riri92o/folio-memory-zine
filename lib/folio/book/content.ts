import { getFontEmbedCSS, toCanvas } from 'html-to-image';

export type BookContent = {
  cover: HTMLCanvasElement;
  pages: { texture: HTMLCanvasElement; title?: string; body?: string }[];
  title?: string;
  bookType?: 'book' | 'binder';
};
export type BookElement = HTMLElement & {
  setContent(content: BookContent): void;
  nextPage(): boolean;
  previousPage(): boolean;
  readonly currentSpread: number;
};

/** Rasterize the existing editor renderer once, locally. Animation only draws these textures. */
export async function capturePages(root: HTMLElement, signal: AbortSignal) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.page-canvas'));
  if (!nodes.length) throw new Error('No cover');
  // LocalImage resolves IndexedDB Blob URLs asynchronously. Never capture its loading placeholder.
  await new Promise<void>((resolve, reject) => {
    const check = () => {
      if (!root.querySelector('.image-missing')) {
        cleanup();
        resolve();
      }
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const observer = new MutationObserver(check);
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Photo load timeout'));
    }, 15000);
    const cleanup = () => {
      clearTimeout(timer);
      observer.disconnect();
      signal.removeEventListener('abort', abort);
    };
    observer.observe(root, { childList: true, subtree: true });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else check();
  });
  await Promise.all(
    Array.from(root.querySelectorAll('img')).map(async (img) => {
      await img.decode();
      if (!img.complete || !img.naturalWidth)
        throw new Error('Photo did not finish rendering');
    }),
  );
  await document.fonts.ready;
  // Canvas doodles, decoded photos and web fonts can all settle one paint after
  // their promises resolve. Two frames keep the cover from capturing a partial
  // first paint, which was visible on photo-heavy cover designs.
  await nextPaint(signal);
  await nextPaint(signal);
  const fontEmbedCSS = await getFontEmbedCSS(root);
  const capture = (node: HTMLElement) =>
    toCanvas(node, {
      width: 500,
      height: 707,
      canvasWidth: 700,
      canvasHeight: 980,
      pixelRatio: 1,
      fontEmbedCSS,
      cacheBust: false,
    });

  // Capture the cover last. The first SVG foreignObject render on iOS can be
  // incomplete while its background image and font are warming up.
  const textures: HTMLCanvasElement[] = [];
  for (const node of nodes.slice(1)) {
    signal.throwIfAborted();
    textures.push(await capture(node));
  }
  signal.throwIfAborted();
  const cover = await capture(nodes[0]);
  return [cover, ...textures];
}

function nextPaint(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = requestAnimationFrame(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    });
    const abort = () => {
      cancelAnimationFrame(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

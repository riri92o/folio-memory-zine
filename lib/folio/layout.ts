import {
  themes,
  paper,
  readableInk,
  type Element,
  type Page,
  type ThemeId,
  type PaperId,
} from './model';
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Slot = {
  x: number;
  y: number;
  width: number;
  height: number;
  bleed?: boolean;
};
export const themePapers: Record<ThemeId, PaperId[]> = {
  minimal: ['white', 'plain'],
  scrap: ['white', 'notebook', 'cream'],
  y2k: ['grid', 'white', 'dot'],
  film: ['cream', 'white'],
  pastel: ['washi', 'white', 'dot'],
  zine: ['white', 'plain', 'grid'],
  cinema: ['black'],
  classic: ['ruled', 'cream', 'notebook'],
};
export function generateLayout(
  page: Page,
  theme: ThemeId,
  seed: number,
  options: { varyPaper?: boolean } = {},
): Page {
  const rnd = random(seed),
    t = themes[theme],
    pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const background = options.varyPaper
    ? paper(pick(themePapers[theme]))
    : { ...page.background };
  if (options.varyPaper) {
    background.texture = Math.min(0.13, background.texture);
    if (theme === 'y2k')
      background.color = pick(['#fff1fb', '#eff4ff', '#ffffff']);
    if (theme === 'pastel')
      background.color = pick(['#fff3f8', '#f4f0ff', '#ffffff']);
  }
  const ink = readableInk(background.color, t.ink),
    loose = ['scrap', 'pastel', 'y2k', 'film'].includes(theme),
    bold = ['zine', 'cinema'].includes(theme);
  const photos = page.elements.filter((e) => e.type === 'photo').slice(0, 5);
  // Shuffle the hero as well as the composition, while retaining every image.
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  const n = photos.length,
    margin = loose ? 7 + rnd() * 2 : 5 + rnd() * 4,
    top = page.isCover ? 23 + rnd() * 5 : 15 + rnd() * 6,
    bottom = 90 - rnd() * 3,
    span = bottom - top;
  const family = Math.floor(rnd() * 4),
    fullBleed = n > 0 && (bold || page.isCover) && family === 3;
  const slots: Slot[] = [];
  if (fullBleed) {
    slots.push({ x: 0, y: 0, width: 100, height: 100, bleed: true });
    const miniW = n > 3 ? 20 : 27;
    for (let i = 1; i < n; i++)
      slots.push({
        x: 100 - margin - (n - i) * (miniW + 2),
        y: 72 + rnd() * 6,
        width: miniW,
        height: 18 + rnd() * 4,
      });
  } else if (n === 1)
    slots.push({
      x: margin,
      y: top - 1,
      width: 100 - margin * 2,
      height: span,
    });
  else if (n === 2) {
    if (family % 2 === 0) {
      const ratio = 0.48 + rnd() * 0.13;
      slots.push(
        { x: margin, y: top, width: 100 - margin * 2, height: span * ratio },
        {
          x: margin + 4 + rnd() * 5,
          y: top + span * ratio + 3,
          width: 87 - margin * 2,
          height: span * (1 - ratio) - 3,
        },
      );
    } else
      slots.push(
        { x: margin, y: top, width: 49 + rnd() * 4, height: span * 0.83 },
        {
          x: 57,
          y: top + span * 0.23,
          width: 100 - margin - 57,
          height: span * 0.74,
        },
      );
  } else if (n >= 3) {
    if (family === 1) {
      const mainW = 48 + rnd() * 9;
      slots.push({ x: margin, y: top, width: mainW, height: span });
      const h = (span - 3 * (n - 2)) / (n - 1);
      for (let i = 1; i < n; i++)
        slots.push({
          x: margin + mainW + 3,
          y: top + (i - 1) * (h + 3),
          width: 100 - 2 * margin - mainW - 3,
          height: h,
        });
    } else if (family === 2 && n === 3) {
      slots.push(
        { x: margin, y: top, width: 62 + rnd() * 5, height: span * 0.65 },
        {
          x: 47 - rnd() * 5,
          y: top + span * 0.42,
          width: 45,
          height: span * 0.51,
        },
        { x: margin + 1, y: top + span * 0.69, width: 37, height: span * 0.31 },
      );
    } else {
      const hero = span * (n > 3 ? 0.48 : 0.55 + rnd() * 0.1);
      slots.push({
        x: bold ? 0 : margin,
        y: top,
        width: bold ? 100 : 100 - 2 * margin,
        height: hero,
      });
      const cols = 2,
        rows = Math.ceil((n - 1) / cols),
        gap = 3,
        cellW = (100 - margin * 2 - gap) / 2,
        cellH = (span - hero - gap * rows) / rows;
      for (let i = 1; i < n; i++)
        slots.push({
          x: margin + ((i - 1) % 2) * (cellW + gap),
          y: top + hero + gap + Math.floor((i - 1) / 2) * (cellH + gap),
          width: cellW,
          height: cellH,
        });
    }
  }
  const laid = photos.map((el, i) => {
    if (el.locked) return el;
    const s = slots[i],
      aspect = el.aspect || 1.3;
    let w = s.width,
      h = s.height;
    if (!s.bleed) {
      h = w / aspect / 1.414;
      if (h > s.height) {
        h = s.height;
        w = h * aspect * 1.414;
      }
      const scale = 0.92 + rnd() * 0.08;
      w *= scale;
      h *= scale;
    }
    const rotation = s.bleed ? 0 : (rnd() - 0.5) * 2 * t.rotation;
    return {
      ...el,
      x: Math.max(0, s.x + (s.width - w) * (loose ? rnd() : 0.5)),
      y: s.y + (s.height - h) * (loose ? rnd() : 0.5),
      width: w,
      height: h,
      rotation,
      zIndex: 10 + i,
      style: {
        ...el.style,
        frame: s.bleed
          ? 'none'
          : theme === 'film'
            ? 'film'
            : loose
              ? 'polaroid'
              : 'none',
        fit: s.bleed ? ('cover' as const) : ('contain' as const),
      },
    };
  });
  const date = new Date(seed > 1e12 ? seed : 1788739200000)
    .toLocaleDateString('en-CA')
    .replaceAll('-', '.');
  let serial = 0;
  function element(
    type: Element['type'],
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: Element['style'] = {},
    rotation = 0,
  ): Element {
    return {
      id: `auto-${page.id}-${seed}-${serial++}`,
      type,
      content,
      x: Math.max(0, Math.min(100 - width, x)),
      y: Math.max(0, Math.min(100 - height, y)),
      width,
      height,
      rotation,
      zIndex: type === 'text' ? 30 : 25,
      locked: false,
      style: { color: ink, auto: true, ...style },
    };
  }
  const retained = page.elements.filter(
    (e) => e.type !== 'photo' && (!e.style.auto || e.locked),
  );
  const title = retained.find(
    (e) => e.type === 'text' && (e.style.role === 'title' || page.isCover),
  );
  const text = retained.map((e) => {
    if (e.locked) return e;
    if (e.id === title?.id) {
      return {
        ...e,
        x: fullBleed ? 8 : margin,
        y: 7 + rnd() * 3,
        width: 84,
        height: 21,
        rotation: loose ? (rnd() - 0.5) * 4 : 0,
        zIndex: 40,
        style: {
          ...e.style,
          role: 'title' as const,
          fontSize: page.isCover ? (bold ? 58 : 45) : 40,
          fontFamily: bold ? 'Arial, sans-serif' : t.font,
          fontWeight: bold ? 900 : 700,
          color: fullBleed ? '#172447' : ink,
          background: fullBleed ? '#fffffff0' : undefined,
        },
      };
    }
    if (e.style.role === 'subtitle')
      return {
        ...e,
        x: margin,
        y: 92,
        width: 88,
        height: 5,
        style: {
          ...e.style,
          color: fullBleed ? '#ffffff' : ink,
          fontSize: 12,
          fontFamily: 'monospace',
        },
      };
    return e;
  });
  const automatic: Element[] = [];
  if (!page.isCover && !text.some((e) => e.type === 'text'))
    automatic.push(
      element(
        'text',
        bold
          ? 'DAY\n' + String(page.pageNumber).padStart(2, '0')
          : loose
            ? 'Little moments.'
            : 'DAY ' + String(page.pageNumber).padStart(2, '0'),
        margin,
        5,
        80,
        13,
        {
          fontSize: bold ? 42 : 26,
          fontWeight: bold ? 900 : 400,
          fontFamily: loose
            ? '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif'
            : t.font,
          background: fullBleed ? '#ffffffeb' : undefined,
          color: fullBleed ? '#14264b' : ink,
          role: 'caption',
        },
        loose ? -3 : 0,
      ),
    );
  if (n) {
    const main = laid[0],
      decorCount =
        theme === 'minimal' ? 0 : 1 + Math.floor(rnd() * (loose ? 3 : 2));
    const choices =
      theme === 'y2k'
        ? ['star', 'heart', 'ticket']
        : theme === 'film'
          ? ['date', 'tape']
          : theme === 'cinema'
            ? ['date']
            : theme === 'classic'
              ? ['seal', 'date']
              : theme === 'zine'
                ? ['day', 'arrow']
                : ['tape', 'location', 'star', 'arrow'];
    for (let i = 0; i < decorCount; i++) {
      const kind = i === 0 && loose ? 'tape' : pick(choices);
      let x = margin + rnd() * 62,
        y = 83 + rnd() * 6;
      const w =
          kind === 'tape'
            ? 22
            : kind === 'location' || kind === 'ticket' || kind === 'date'
              ? 31
              : 14,
        h =
          kind === 'tape'
            ? 5
            : kind === 'location' || kind === 'ticket' || kind === 'date'
              ? 6
              : 10;
      if (i === 0 && kind === 'tape') {
        x = Math.min(72, main.x + main.width * 0.32);
        y = Math.max(2, main.y - 2);
      }
      automatic.push(
        element(
          'sticker',
          kind,
          x,
          y,
          w,
          h,
          {
            fontSize: kind === 'date' ? 13 : 25,
            color: fullBleed ? '#172447' : ink,
            label: kind === 'date' ? date : undefined,
            background: kind === 'location' ? '#ffffff' : undefined,
          },
          (rnd() - 0.5) * (loose ? 16 : 5),
        ),
      );
    }
  }
  return {
    ...page,
    background,
    layoutSeed: seed,
    elements: [...text, ...laid, ...automatic],
  };
}

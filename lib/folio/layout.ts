import {
  themes,
  newElement,
  type Element,
  type Page,
  type ThemeId,
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
// A seeded, bounded composition: dominant photo plus a supporting row or column.
// Preserve source aspect ratios (contain by default), reserve margins and title space.
export function generateLayout(page: Page, theme: ThemeId, seed: number): Page {
  const rnd = random(seed),
    t = themes[theme],
    photos = page.elements.filter((e) => e.type === 'photo'),
    n = photos.length;
  const free = theme === 'scrap' || theme === 'pastel' || theme === 'y2k';
  const margin = free ? 9 : 7 + rnd() * 3;
  const top = page.isCover ? 34 + rnd() * 4 : 8 + rnd() * 5,
    bottom = page.isCover ? 77 - rnd() * 2 : 87,
    span = bottom - top;
  let slots: { x: number; y: number; width: number; height: number }[] = [];
  if (n === 1)
    slots = [{ x: margin, y: top, width: 100 - margin * 2, height: span }];
  else if (n === 2) {
    const vertical = rnd() > 0.45;
    slots = vertical
      ? [
          { x: margin, y: top, width: 100 - margin * 2, height: span * 0.56 },
          {
            x: margin + 8,
            y: top + span * 0.61,
            width: 84 - margin * 2,
            height: span * 0.39,
          },
        ]
      : [
          { x: margin, y: top, width: 48, height: span * 0.86 },
          {
            x: 60,
            y: top + span * 0.18,
            width: 100 - margin - 60,
            height: span * 0.7,
          },
        ];
  } else if (n >= 3) {
    const hero = span * (n > 3 ? 0.49 : 0.59);
    slots = [{ x: margin, y: top, width: 100 - margin * 2, height: hero }];
    const cols = 2,
      rows = Math.ceil((n - 1) / cols),
      gap = 4,
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
  const laid = photos.map((el, i) => {
    if (el.locked) return el;
    const s = slots[i],
      a = el.aspect || 1.3;
    let w = s.width,
      h = w / a / 1.414;
    if (h > s.height) {
      h = s.height;
      w = h * a * 1.414;
    }
    const rot = (rnd() - 0.5) * 2 * t.rotation;
    return {
      ...el,
      x: s.x + (s.width - w) / 2 + (free ? (rnd() - 0.5) * 2 : 0),
      y: s.y + (s.height - h) / 2,
      width: w,
      height: h,
      rotation: rot,
      zIndex: 10 + i,
      style: {
        ...el.style,
        frame: theme === 'film' ? 'film' : free ? 'polaroid' : 'none',
        fit: 'contain' as const,
      },
    };
  });
  const decorations: Element[] = [];
  if (t.decor && n) {
    const main = laid[0];
    decorations.push({
      ...newElement('sticker', t.decor),
      x: Math.min(70, main.x + main.width * 0.3),
      y: Math.max(3, main.y - 3),
      width: t.decor === 'tape' ? 28 : 20,
      height: 7,
      rotation: (rnd() - 0.5) * 14,
      style: { color: t.ink, auto: true, fontSize: 24 },
    });
  }
  return {
    ...page,
    layoutSeed: seed,
    elements: [
      ...page.elements.filter(
        (e) => e.type !== 'photo' && (!e.style.auto || e.locked),
      ),
      ...laid,
      ...decorations,
    ],
  };
}

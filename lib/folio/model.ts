export type ThemeId =
  | 'minimal'
  | 'scrap'
  | 'y2k'
  | 'film'
  | 'pastel'
  | 'zine'
  | 'cinema'
  | 'classic';
export type PaperId =
  | 'plain'
  | 'ruled'
  | 'grid'
  | 'dot'
  | 'notebook'
  | 'cream'
  | 'kraft'
  | 'washi'
  | 'white'
  | 'black';
export interface Paper {
  type: PaperId;
  color: string;
  lines: 'none' | 'ruled' | 'grid' | 'dot';
  opacity: number;
  texture: number;
}
export interface Element {
  id: string;
  type: 'photo' | 'text' | 'sticker';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  content: string;
  imageRef?: string;
  aspect?: number;
  style: {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    frame?: string;
    auto?: boolean;
    fit?: 'contain' | 'cover';
    role?: 'title' | 'subtitle' | 'caption';
    background?: string;
    label?: string;
    italic?: boolean;
    letterSpacing?: number;
  };
}
export interface Stroke {
  id: string;
  tool: 'pen' | 'marker' | 'eraser' | 'dotted';
  color: string;
  width: number;
  points: [number, number][];
}
export interface Page {
  id: string;
  folioId: string;
  pageNumber: number;
  isCover: boolean;
  background: Paper;
  layoutSeed: number;
  elements: Element[];
  doodles: Stroke[];
  doodlesVisible: boolean;
}
export interface Folio {
  id: string;
  title: string;
  subtitle: string;
  bookType: 'book' | 'binder';
  theme: ThemeId;
  paperType: PaperId;
  createdAt: number;
  updatedAt: number;
  coverPageId: string;
  pageOrder: string[];
  pageCount: number;
  pages: Page[];
  sample?: boolean;
}
export interface Photo {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
}
export const uid = () => crypto.randomUUID();
export const themes: Record<
  ThemeId,
  {
    name: string;
    en: string;
    color: string;
    paper: PaperId;
    ink: string;
    rotation: number;
    decor: string;
    font: string;
  }
> = {
  minimal: {
    name: 'ミニマル・モダン',
    en: 'MINIMAL',
    color: '#e7efff',
    paper: 'white',
    ink: '#222b26',
    rotation: 0,
    decor: '',
    font: 'sans-serif',
  },
  scrap: {
    name: 'スクラップブック',
    en: 'SCRAPBOOK',
    color: '#dceafb',
    paper: 'white',
    ink: '#233557',
    rotation: 7,
    decor: 'tape',
    font: '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif',
  },
  y2k: {
    name: 'レトロ・Y2K',
    en: 'Y2K POP',
    color: '#d2ddff',
    paper: 'grid',
    ink: '#3d35bc',
    rotation: 5,
    decor: 'star',
    font: 'monospace',
  },
  film: {
    name: 'エモ・フィルム',
    en: 'FILM DAYS',
    color: '#f4d8bb',
    paper: 'cream',
    ink: '#5c4c3f',
    rotation: 3,
    decor: 'date',
    font: 'monospace',
  },
  pastel: {
    name: 'パステル',
    en: 'SOFT MOMENTS',
    color: '#f1dbe3',
    paper: 'washi',
    ink: '#86566e',
    rotation: 4,
    decor: 'heart',
    font: 'Arial, "Hiragino Kaku Gothic ProN", sans-serif',
  },
  zine: {
    name: 'マガジン・ZINE',
    en: 'THE ZINE',
    color: '#f2f969',
    paper: 'white',
    ink: '#242724',
    rotation: 2,
    decor: 'arrow',
    font: 'sans-serif',
  },
  cinema: {
    name: 'シネマティック',
    en: 'AFTER HOURS',
    color: '#333c41',
    paper: 'black',
    ink: '#f5f2e9',
    rotation: 0,
    decor: 'date',
    font: 'sans-serif',
  },
  classic: {
    name: 'クラシック手帳',
    en: 'DEAR DIARY',
    color: '#d9d5bc',
    paper: 'ruled',
    ink: '#3b524c',
    rotation: 2,
    decor: 'seal',
    font: '"Hiragino Mincho ProN", "Yu Mincho", serif',
  },
};
export const paperNames: Record<PaperId, string> = {
  plain: '無地',
  ruled: '横罫',
  grid: '方眼',
  dot: 'ドット方眼',
  notebook: 'ノート風薄罫線',
  cream: '生成り紙',
  kraft: 'クラフト紙',
  washi: '和紙風',
  white: '白紙・写真向け',
  black: 'ダークペーパー',
};
export function paper(type: PaperId): Paper {
  return {
    type,
    color:
      type === 'black'
        ? '#24282a'
        : type === 'kraft'
          ? '#c7a77b'
          : type === 'cream'
            ? '#f8f2df'
            : type === 'washi'
              ? '#f5f3ed'
              : '#fffefb',
    lines:
      type === 'grid'
        ? 'grid'
        : type === 'dot'
          ? 'dot'
          : type === 'ruled' || type === 'notebook'
            ? 'ruled'
            : 'none',
    opacity: type === 'notebook' ? 0.1 : 0.18,
    texture: ['kraft', 'washi', 'cream'].includes(type) ? 0.25 : 0,
  };
}
export const stickers: Record<string, { name: string; symbol: string }> = {
  ticket: { name: 'チケット', symbol: 'GOOD TIMES' },
  location: { name: '場所ラベル', symbol: '⌖ MY PLACE' },
  day: { name: 'DAY ラベル', symbol: 'DAY 01' },
  tape: { name: 'マステ', symbol: ' ' },
  seal: { name: 'シール', symbol: '✿' },
  note: { name: '付箋', symbol: 'remember' },
  date: { name: '日付ラベル', symbol: 'SEP. 2026' },
  heart: { name: 'ハート', symbol: '♡' },
  star: { name: '星', symbol: '✦' },
  arrow: { name: '矢印', symbol: '↗' },
  circle: { name: '丸囲み', symbol: '◯' },
  film: { name: 'フィルム枠', symbol: '' },
  polaroid: { name: 'ポラロイド', symbol: '' },
};
export function newElement(type: Element['type'], content = ''): Element {
  return {
    id: uid(),
    type,
    content,
    x: 15,
    y: 25,
    width: type === 'text' ? 65 : 23,
    height: type === 'text' ? 16 : 16,
    rotation: 0,
    zIndex: type === 'text' ? 30 : 20,
    locked: false,
    style: { color: '#323b30', fontSize: 28 },
  };
}
export function newPage(
  folioId: string,
  index: number,
  paperType: PaperId,
): Page {
  return {
    id: uid(),
    folioId,
    pageNumber: index,
    isCover: index === 0,
    background: paper(paperType),
    layoutSeed: Date.now(),
    elements: [],
    doodles: [],
    doodlesVisible: true,
  };
}
export function newFolio(
  title: string,
  subtitle: string,
  bookType: Folio['bookType'],
  theme: ThemeId,
  paperType: PaperId,
): Folio {
  const id = uid(),
    cover = newPage(id, 0, paperType),
    inside = newPage(id, 1, paperType);
  cover.elements = [
    {
      ...newElement('text', title),
      x: 10,
      y: 13,
      width: 80,
      height: 22,
      style: {
        role: 'title',
        fontSize: 44,
        fontWeight: 700,
        color: readableInk(paper(paperType).color, themes[theme].ink),
        fontFamily: themes[theme].font,
      },
    },
    ...(subtitle
      ? [
          {
            ...newElement('text', subtitle),
            x: 10,
            y: 78,
            height: 10,
            style: {
              role: 'subtitle' as const,
              fontSize: 17,
              color: readableInk(paper(paperType).color, themes[theme].ink),
            },
          },
        ]
      : []),
  ];
  return {
    id,
    title,
    subtitle,
    bookType,
    theme,
    paperType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    coverPageId: cover.id,
    pageOrder: [cover.id, inside.id],
    pageCount: 2,
    pages: [cover, inside],
  };
}
export function normalize(f: Folio): Folio {
  return {
    ...f,
    updatedAt: Date.now(),
    pageCount: f.pages.length,
    pageOrder: f.pages.map((p) => p.id),
    pages: f.pages.map((p, i) => ({ ...p, pageNumber: i, isCover: i === 0 })),
  };
}

/** Keep automatic text readable on independently chosen paper colors. */
export function readableInk(background: string, preferred: string): string {
  function luminance(hex: string) {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const base = luminance(background),
    ink = luminance(preferred);
  if ((Math.max(base, ink) + 0.05) / (Math.min(base, ink) + 0.05) >= 4.5)
    return preferred;
  return base > 0.18 ? '#242922' : '#fffefa';
}

import { newFolio, newElement, newPage, normalize, type Folio } from './model';
import { generateLayout } from './layout';
export function samples(): Folio[] {
  return [
    {
      title: 'Summer days',
      heading: 'Summer\nDays',
      sub: 'AUGUST, 2026',
      theme: 'scrap' as const,
      img: 'coast',
      type: 'book' as const,
    },
    {
      title: 'Kyoto stories',
      heading: 'KYOTO\nSTORIES',
      sub: '09.01 — 09.03 / 2026',
      theme: 'zine' as const,
      img: 'city',
      type: 'book' as const,
    },
    {
      title: 'なんでもない日',
      heading: 'Little\njoys.',
      sub: 'COFFEE & A SLOW AFTERNOON',
      theme: 'pastel' as const,
      img: 'cafe',
      type: 'binder' as const,
    },
    {
      title: 'Night drive',
      heading: 'NIGHT\nDRIVE',
      sub: 'CITY LIGHTS / 22:40',
      theme: 'cinema' as const,
      img: 'city',
      type: 'binder' as const,
    },
    {
      title: 'Weekend notes',
      heading: 'WEEKEND\nNOTES',
      sub: 'COFFEE, MUSIC, SUNDAY',
      theme: 'minimal' as const,
      img: 'cafe',
      type: 'book' as const,
    },
    {
      title: 'Blue horizon',
      heading: 'BLUE\nHORIZON',
      sub: 'SUMMER FILM / 2026',
      theme: 'film' as const,
      img: 'coast',
      type: 'binder' as const,
    },
  ].map((s, i) => {
    const f = newFolio(s.title, s.sub, s.type, s.theme, 'white');
    f.sample = true;
    f.id = 'sample-' + i;
    f.pages.push(newPage(f.id, 2, 'white'), newPage(f.id, 3, 'white'));
    f.pages = f.pages.map((p, j) => {
      p.folioId = f.id;
      const refs =
        j === 0
          ? [s.img]
          : [
              s.img,
              ...['city', 'coast', 'cafe'].filter((v) => v !== s.img),
            ].slice(0, j === 1 ? 3 : j === 2 ? 2 : 1);
      p.elements = p.elements.map((e) =>
        e.style.role === 'title' ? { ...e, content: s.heading } : e,
      );
      for (const ref of refs)
        p.elements.push({
          ...newElement('photo'),
          imageRef: '/samples/' + ref + '.jpg',
          aspect: ref === 'cafe' ? 2 / 3 : 1.5,
        });
      const next = generateLayout(p, s.theme, 1788739200000 + i * 29 + j * 18, {
        varyPaper: true,
      });
      if (j === 0) {
        const photo = next.elements.find((e) => e.type === 'photo')!;
        const inset = i === 2 || i === 4;
        photo.x = inset ? 10 : 0;
        photo.y = inset ? 34 : 0;
        photo.width = inset ? 80 : 100;
        photo.height = inset ? 53 : 100;
        photo.rotation = i === 2 ? -5 : i === 4 ? 2 : 0;
        photo.style = {
          ...photo.style,
          fit: 'cover',
          frame: inset ? 'polaroid' : 'none',
        };
        const title = next.elements.find((e) => e.style.role === 'title')!;
        title.x = i === 1 ? 9 : 12;
        title.y = i === 1 ? 51 : i === 3 ? 62 : 10;
        title.width = i === 1 ? 69 : 80;
        title.height = 25;
        title.style = {
          ...title.style,
          color: [0, 3, 5].includes(i) ? '#ffffff' : '#172447',
          background: i === 1 || i === 4 ? '#fffffff0' : undefined,
          fontFamily:
            i === 1 || i === 3
              ? 'Arial, sans-serif'
              : i === 5
                ? '"Courier New", monospace'
                : '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif',
          fontSize: i === 1 || i === 3 ? 62 : 64,
          fontWeight: i === 1 || i === 3 || i === 5 ? 900 : 500,
        };
        next.elements = next.elements.filter(
          (e) =>
            e.type !== 'sticker' ||
            ['tape', 'date', 'ticket'].includes(e.content),
        );
        if (i === 2) next.background.color = '#ffeef6';
        if (i === 4) next.background.color = '#f8fbff';
      }
      return next;
    });
    return normalize(f);
  });
}

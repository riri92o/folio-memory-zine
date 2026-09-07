import { newFolio, newElement, type Folio } from './model';
import { generateLayout } from './layout';
export function samples(): Folio[] {
  return [
    {
      title: 'あの夏、海まで。',
      sub: 'A LITTLE SUMMER ESCAPE',
      theme: 'scrap' as const,
      img: 'coast',
      type: 'book' as const,
    },
    {
      title: '京都、よりみち。',
      sub: 'KYOTO / SLOW WEEKEND',
      theme: 'film' as const,
      img: 'city',
      type: 'binder' as const,
    },
    {
      title: 'なんでもない日',
      sub: 'THE BEAUTY OF ORDINARY DAYS',
      theme: 'zine' as const,
      img: 'cafe',
      type: 'book' as const,
    },
  ].map((s, i) => {
    const f = newFolio(
      s.title,
      s.sub,
      s.type,
      s.theme,
      i === 0 ? 'cream' : i === 1 ? 'kraft' : 'white',
    );
    f.id = 'sample-' + i;
    f.sample = true;
    f.pages = f.pages.map((p, j) => {
      p.folioId = f.id;
      const image = {
        ...newElement('photo'),
        imageRef: '/samples/' + s.img + '.jpg',
        aspect: i === 2 ? 2 / 3 : 1.5,
      };
      p.elements.push(image);
      const next = generateLayout(p, s.theme, 12345 + i * 35 + j);
      if (j === 0) {
        next.elements = next.elements.map((e) =>
          e.type === 'photo'
            ? {
                ...e,
                x: 9,
                y: 29,
                width: 82,
                height: 49,
                rotation: i === 0 ? -5 : 0,
                style: { ...e.style, fit: 'cover' },
              }
            : e.type === 'text' && e.content === s.title
              ? {
                  ...e,
                  x: 8,
                  y: 10,
                  width: 85,
                  height: 16,
                  style: { ...e.style, fontSize: i === 2 ? 48 : 34 },
                }
              : e,
        );
      } else {
        next.elements.push({
          ...newElement(
            'text',
            i === 0
              ? '波の音と、少しぬるい風。\nこの日の青を、覚えていたい。'
              : i === 1
                ? '知らない道を歩いて、\nいつもの自分に戻っていく。'
                : 'コーヒーが冷めるまで、\nもう少しだけ、ここに。',
          ),
          x: 12,
          y: 80,
          width: 76,
          height: 12,
          style: { fontSize: 18, color: '#424735' },
        });
      }
      return next;
    });
    return f;
  });
}

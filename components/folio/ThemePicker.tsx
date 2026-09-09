'use client';
import { useMemo } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageCanvas } from './PageCanvas';
import { generateLayout } from '@/lib/folio/layout';
import {
  themes,
  paper,
  type ThemeId,
  type Page,
  type Element,
} from '@/lib/folio/model';
const demoPhotos: Element[] = ['city', 'coast', 'cafe'].map((name, i) => ({
  id: 'preview-' + i,
  type: 'photo',
  content: '',
  imageRef: `${import.meta.env.BASE_URL}samples/${name}.jpg`,
  aspect: i === 2 ? 2 / 3 : 1.5,
  x: 0,
  y: 0,
  width: 30,
  height: 30,
  rotation: 0,
  zIndex: 10 + i,
  locked: false,
  style: {},
}));
const blank: Page = {
  id: 'theme-preview',
  folioId: 'preview',
  pageNumber: 1,
  isCover: false,
  background: paper('white'),
  layoutSeed: 1788739200000,
  elements: demoPhotos,
  doodles: [],
  doodlesVisible: true,
};
export function ThemePicker({
  value,
  onChange,
  page,
  compact = false,
}: {
  value: ThemeId;
  onChange: (t: ThemeId) => void;
  page?: Page;
  compact?: boolean;
}) {
  const previews = useMemo(
    () =>
      Object.entries(themes).map(([id, t]) => ({
        id: id as ThemeId,
        t,
        page: generateLayout(
          {
            ...(page || blank),
            id: 'preview-' + id,
            background: paper(t.paper),
          },
          id as ThemeId,
          1788739200000 + Object.keys(themes).indexOf(id) * 43,
          { varyPaper: true },
        ),
      })),
    [page],
  );
  return (
    <RadioGroup
      aria-label="ページの雰囲気"
      value={value}
      onValueChange={(v) => onChange(v as ThemeId)}
      className={`theme-carousel ${compact ? 'compact' : ''}`}
    >
      {previews.map(({ id, t, page: p }) => (
        <label
          className={`theme-option ${id === value ? 'active' : ''}`}
          key={id}
        >
          <div className="theme-paper">
            <PageCanvas page={p} thumb />
            <RadioGroupItem
              value={id}
              className="theme-radio"
              aria-label={t.name}
            />
          </div>
          <strong>
            {id === 'minimal'
              ? 'Minimal'
              : id === 'scrap'
                ? 'Scrapbook'
                : id === 'y2k'
                  ? 'Y2K Pop'
                  : id === 'film'
                    ? 'Film'
                    : id === 'pastel'
                      ? 'Soft'
                      : id === 'zine'
                        ? 'Magazine'
                        : id === 'cinema'
                          ? 'Cinema'
                          : 'Journal'}
          </strong>
          <span>{t.name}</span>
        </label>
      ))}
    </RadioGroup>
  );
}

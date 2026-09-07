'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { Folio, Page } from '@/lib/folio/model';
import { PageCanvas } from './PageCanvas';
export function Reader({
  folio,
  onEdit,
}: {
  folio: Folio;
  onEdit: () => void;
}) {
  const [index, setIndex] = useState(0),
    [wide, setWide] = useState(false),
    [turn, setTurn] = useState<{ page: Page; direction: number }>();
  const touch = useRef<[number, number] | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const mq = matchMedia(
      '(min-width: 800px), (orientation: landscape) and (min-width: 640px)',
    );
    const set = () => {
      setWide(mq.matches);
      setIndex(0);
    };
    set();
    mq.addEventListener('change', set);
    return () => {
      mq.removeEventListener('change', set);
      clearTimeout(timer.current);
    };
  }, []);
  const step = wide ? 2 : 1;
  function flip(direction: number) {
    if (turn) return;
    const next = index + direction * step;
    if (next < 0 || next >= folio.pages.length) return;
    setTurn({
      page: folio.pages[
        direction > 0
          ? Math.min(index + step - 1, folio.pages.length - 1)
          : index
      ],
      direction,
    });
    setIndex(next);
    timer.current = setTimeout(() => setTurn(undefined), 720);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        flip(1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        flip(-1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <main className="reader">
      <div className="reader-heading">
        <div className="eyebrow">A MOMENT TO LOOK BACK</div>
        <h1>{folio.title}</h1>
        {folio.subtitle && <p>{folio.subtitle}</p>}
        {folio.sample && (
          <span className="sample-label">
            サンプル · 編集すると自分の本棚にコピーされます
          </span>
        )}
      </div>
      <div className="reader-stage">
        <button
          className="turn-button prev"
          aria-label="前のページ"
          disabled={index === 0 || !!turn}
          onClick={() => flip(-1)}
        >
          <ChevronLeft />
        </button>
        <div
          className={`read-spread ${wide ? 'wide' : ''} ${folio.bookType}`}
          onPointerDown={(e) => {
            touch.current = [e.clientX, e.clientY];
          }}
          onPointerUp={(e) => {
            const s = touch.current;
            touch.current = null;
            if (
              s &&
              Math.abs(e.clientX - s[0]) > 45 &&
              Math.abs(e.clientX - s[0]) > Math.abs(e.clientY - s[1]) * 1.3
            )
              flip(e.clientX < s[0] ? 1 : -1);
          }}
          onPointerCancel={() => {
            touch.current = null;
          }}
        >
          {
            <div className="read-leaf">
              <PageCanvas page={folio.pages[index]} />
            </div>
          }
          {wide && (
            <div className="read-leaf">
              {folio.pages[index + 1] ? (
                <PageCanvas page={folio.pages[index + 1]} />
              ) : (
                <div className="endpaper">
                  <span>Folio®</span>
                  <p>またひとつ、思い出。</p>
                </div>
              )}
            </div>
          )}
          {folio.bookType === 'binder' && (
            <div className="binder-rings">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {turn && (
            <div className={`turning-page ${turn.direction < 0 ? 'back' : ''}`}>
              <PageCanvas page={turn.page} />
              <div className="turn-shade" />
            </div>
          )}
        </div>
        <button
          className="turn-button next"
          aria-label="次のページ"
          disabled={index + step >= folio.pages.length || !!turn}
          onClick={() => flip(1)}
        >
          <ChevronRight />
        </button>
      </div>
      <div className="reader-bottom">
        <span>
          {index === 0 ? '表紙' : index}{' '}
          {wide && folio.pages[index + 1] ? `— ${index + 1}` : ''}
          <span className="separator">/</span>
          {folio.pages.length - 1}
        </span>
        <p>横にスワイプして、ページをめくる</p>
        <button className="secondary" onClick={onEdit}>
          <Pencil size={16} />
          このFolioを編集
        </button>
      </div>
    </main>
  );
}

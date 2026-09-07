'use client';
import { useEffect, useRef, useState, memo, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Folio, type Page, paper } from '@/lib/folio/model';
import { PageCanvas } from './PageCanvas';
import { useWide } from './useWide';
import { readerDestination, turnGeometry, turnMotion } from '@/lib/folio/turn';
const blank: Page = {
  id: 'endpaper',
  folioId: 'reader',
  pageNumber: 0,
  isCover: true,
  background: paper('white'),
  layoutSeed: 0,
  elements: [],
  doodles: [],
  doodlesVisible: false,
};
const TurningFace = memo(function TurningFace({ page }: { page: Page }) {
  return <PageCanvas page={page} thumb />;
});
function BinderHoles({ edge }: { edge: 'left' | 'right' }) {
  return (
    <div className={`binder-page-holes edge-${edge}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

const strips = 12;
// Piecewise cylindrical bend. Adjacent segments share endpoints, so the page
// remains a continuous surface through the turn; both faces stay visible.
function CurledPage({
  front,
  back,
  progress,
  direction,
  width,
  wide,
  binder,
}: {
  front: Page;
  back: Page;
  progress: number;
  direction: number;
  width: number;
  wide: boolean;
  binder: boolean;
}) {
  const motion = turnMotion(progress, direction);
  const pieces = [];
  for (const { index: j, angle, left, z, origin } of turnGeometry(
    motion.geometryProgress,
    motion.geometryDirection,
    width,
    strips,
  )) {
    pieces.push(
      <div
        className="curl-strip"
        key={j}
        style={{
          width: `${100 / strips + 0.035}%`,
          left: `${left * 100}%`,
          transform: `translateZ(${z}px) rotateY(${angle}rad)`,
          transformOrigin: origin,
        }}
      >
        <div className="curl-front">
          <div
            className="curl-content"
            style={{ width: `${strips * 100}%`, left: `${-j * 100}%` }}
          >
            <TurningFace page={front} />
          </div>
          <div
            className="curl-light"
            style={{
              opacity:
                Math.sin(progress * Math.PI) * (0.08 + (j / strips) * 0.25),
            }}
          />
        </div>
        <div className="curl-back">
          <div
            className="curl-content"
            style={{
              width: `${strips * 100}%`,
              left: `${-(strips - 1 - j) * 100}%`,
            }}
          >
            <TurningFace page={back} />
          </div>
          <div
            className="curl-light"
            style={{ opacity: 0.06 + Math.sin(progress * Math.PI) * 0.15 }}
          />
        </div>
        {binder && j === 0 && (
          <div className="turn-punches">
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
      </div>,
    );
  }
  return (
    <div
      aria-hidden
      className={`curl-page ${wide ? 'from-right' : ''} ${direction < 0 ? 'returning-page' : 'forward-page'}`}
    >
      {pieces}
    </div>
  );
}
export function Reader({ folio }: { folio: Folio; onEdit: () => void }) {
  const desktop = useWide(),
    [index, setIndex] = useState(0),
    [turn, setTurn] = useState<{
      from: number;
      to: number;
      direction: number;
      progress: number;
    }>(),
    [bookWidth, setBookWidth] = useState(340);
  const ref = useRef<HTMLDivElement>(null),
    raf = useRef(0),
    gesture = useRef<
      | {
          x: number;
          y: number;
          direction: number;
          progress: number;
          active: boolean;
          width: number;
        }
      | undefined
    >(undefined),
    live = useRef<typeof turn>(undefined);
  const baseIndex = Math.min(index, folio.pages.length - 1),
    wide = baseIndex > 0,
    coverTransition =
      turn &&
      ((turn.from === 0 && turn.to === 1) || (turn.from === 1 && turn.to === 0))
        ? {
            opening: turn.direction > 0,
            openProgress:
              turn.direction > 0 ? turn.progress : 1 - turn.progress,
          }
        : undefined,
    openness = coverTransition?.openProgress ?? (wide ? 1 : 0),
    closedScale = desktop ? 1 : 1.82,
    bookScale = closedScale + (0.955 - closedScale) * openness,
    bookShift = -25 * bookScale * (1 - openness),
    pageWidth = bookWidth / 2,
    previousIndex = readerDestination(baseIndex, -1, folio.pages.length),
    nextIndex = readerDestination(baseIndex, 1, folio.pages.length);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) =>
      setBookWidth(entries[0].contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  function frame(value: typeof turn) {
    live.current = value;
    setTurn(value);
  }
  function animate(target: number) {
    const currentTurn = live.current;
    if (!currentTurn) return;
    const initial = currentTurn;
    cancelAnimationFrame(raf.current);
    const start = performance.now(),
      from = initial.progress,
      duration = matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : Math.max(180, 420 * Math.abs(target - from));
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration),
        eased = 1 - Math.pow(1 - t, 3);
      frame({ ...initial, progress: from + (target - from) * eased });
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else {
        if (target === 1) setIndex(initial.to);
        frame(undefined);
      }
    }
    raf.current = requestAnimationFrame(tick);
  }
  function begin(direction: number) {
    const to = readerDestination(baseIndex, direction, folio.pages.length);
    if (to === null) return false;
    frame({ from: baseIndex, to, direction, progress: 0 });
    return true;
  }
  function flip(direction: number) {
    if (live.current) return;
    if (begin(direction)) animate(1);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,button')) return;
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
  let left = baseIndex === 0 ? blank : folio.pages[baseIndex],
    right =
      baseIndex === 0 ? folio.pages[0] : folio.pages[baseIndex + 1] || blank;
  if (coverTransition) {
    left = blank;
    right = folio.pages[2] || blank;
  } else if (turn) {
    if (!wide) left = folio.pages[turn.direction > 0 ? turn.to : turn.from];
    else if (turn.direction > 0) right = folio.pages[turn.to + 1] || blank;
    else {
      left = folio.pages[turn.to];
      right = folio.pages[turn.to + 1] || blank;
    }
  }
  const front = turn
    ? folio.pages[
        turn.direction > 0
          ? Math.min(
              turn.from + Math.abs(turn.to - turn.from) - 1,
              folio.pages.length - 1,
            )
          : Math.min(
              turn.to + Math.abs(turn.to - turn.from) - 1,
              folio.pages.length - 1,
            )
      ]
    : blank;
  const back = turn
    ? folio.pages[turn.direction > 0 ? turn.to : turn.from]
    : blank;
  return (
    <main className="reader">
      <div className="reading-title">
        <span>{folio.title}</span>
        {folio.sample && <small>サンプル</small>}
      </div>
      <div className="reading-stage">
        <button
          className="reader-arrow prev"
          aria-label="前のページ"
          disabled={previousIndex === null || !!turn}
          onClick={() => flip(-1)}
        >
          <ChevronLeft size={21} />
        </button>
        <div
          ref={ref}
          className={`physical-book spread wide ${coverTransition ? 'cover-moving' : ''} ${openness === 0 ? 'cover-closed' : ''} ${folio.bookType}`}
          style={
            {
              transform: `translateX(${bookShift}%) translateY(${-9 - openness * 5}px) rotateX(1.2deg) scale(${bookScale})`,
            } as CSSProperties
          }
          onPointerDown={(e) => {
            if (live.current || e.button !== 0) return;
            gesture.current = {
              x: e.clientX,
              y: e.clientY,
              direction: 0,
              progress: 0,
              active: false,
              width: pageWidth,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            const dx = e.clientX - g.x,
              dy = e.clientY - g.y;
            if (!g.active) {
              if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
              g.direction = dx < 0 ? 1 : -1;
              if (!begin(g.direction)) {
                gesture.current = undefined;
                return;
              }
              g.active = true;
            }
            const progress = Math.max(
              0,
              Math.min(0.99, (-dx * g.direction) / (g.width * 0.9)),
            );
            g.progress = progress;
            if (live.current) frame({ ...live.current, progress });
          }}
          onPointerUp={(e) => {
            const g = gesture.current;
            gesture.current = undefined;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            if (g?.active) animate(g.progress > 0.17 ? 1 : 0);
          }}
          onPointerCancel={() => {
            gesture.current = undefined;
            if (live.current) animate(0);
          }}
        >
          <div
            className={`read-leaf ${left.id === blank.id ? 'cover-void' : ''}`}
          >
            {left.id === blank.id ? (
              <div className="cover-void-surface" />
            ) : (
              <PageCanvas page={left} />
            )}
            {folio.bookType === 'binder' && left.id !== blank.id && (
              <BinderHoles edge="left" />
            )}
          </div>
          <div className="read-leaf">
            {right.id === blank.id ? (
              <div className="endpaper">
                <span className="wordmark">Folio</span>
                <p className="handwritten">Until the next moment.</p>
              </div>
            ) : (
              <PageCanvas page={right} />
            )}
            {folio.bookType === 'binder' && <BinderHoles edge="left" />}
          </div>
          {folio.bookType === 'book' && (
            <div className="book-gutter" style={{ opacity: openness }} />
          )}
          {folio.bookType === 'binder' && (
            <div className="binder-binding">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {turn && (
            <>
              {coverTransition && (
                <div
                  className="next-page-shadow"
                  style={{
                    opacity:
                      Math.sin(coverTransition.openProgress * Math.PI) * 0.24,
                  }}
                />
              )}
              <div
                className="cast-page-shadow"
                style={{
                  opacity: Math.sin(turn.progress * Math.PI) * 0.2,
                  transform: `translateX(${turn.direction < 0 ? -16 + turn.progress * 16 : 0}%) scaleX(${0.25 + Math.sin(turn.progress * Math.PI) * 0.75})`,
                }}
              />
              <CurledPage
                front={front}
                back={back}
                progress={turn.progress}
                direction={turn.direction}
                width={pageWidth}
                wide
                binder={folio.bookType === 'binder'}
              />
            </>
          )}
          <div className="paper-stack" />
        </div>
        <button
          className="reader-arrow next"
          aria-label="次のページ"
          disabled={nextIndex === null || !!turn}
          onClick={() => flip(1)}
        >
          <ChevronRight size={21} />
        </button>
      </div>
      <div className="reading-footer">
        <span>
          {baseIndex === 0 ? 'Cover' : String(baseIndex).padStart(2, '0')}
          {wide && folio.pages[baseIndex + 1]
            ? ` — ${String(baseIndex + 1).padStart(2, '0')}`
            : ''}
          <i>/</i>
          {String(folio.pages.length - 1).padStart(2, '0')}
        </span>
        <p>ページの端を、ゆっくり横へ。</p>
      </div>
    </main>
  );
}

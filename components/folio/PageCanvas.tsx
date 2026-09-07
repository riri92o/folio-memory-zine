'use client';
/* eslint-disable next/no-img-element -- Local Blob URLs and generated thumbnails require no image server. */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { Lock, RotateCw } from 'lucide-react';
import {
  type Page,
  type Element,
  type Stroke,
  stickers,
  uid,
} from '@/lib/folio/model';
import { imageUrl } from '@/lib/folio/storage';
export function LocalImage({
  src,
  thumb = false,
  fit = 'contain',
}: {
  src: string;
  thumb?: boolean;
  fit?: 'contain' | 'cover';
}) {
  const [url, setUrl] = useState(src.startsWith('/') ? src : '');
  useEffect(() => {
    let alive = true;
    imageUrl(src, thumb)
      .then((v) => alive && setUrl(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src, thumb]);
  return url ? (
    <img
      src={url}
      alt="ページの写真"
      draggable={false}
      style={{ objectFit: fit }}
    />
  ) : (
    <div className="image-missing">写真を読み込み中</div>
  );
}
export type DrawSettings = {
  tool: Stroke['tool'];
  color: string;
  width: number;
};
function Doodles({ strokes, draft }: { strokes: Stroke[]; draft?: Stroke }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(2, 2);
    for (const s of [...strokes, ...(draft ? [draft] : [])]) {
      if (!s.points.length) continue;
      ctx.globalCompositeOperation =
        s.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.globalAlpha = s.tool === 'marker' ? 0.32 : 1;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.color;
      ctx.setLineDash(s.tool === 'dotted' ? [1, s.width * 2.5] : []);
      ctx.beginPath();
      ctx.moveTo(...s.points[0]);
      if (s.points.length === 1)
        ctx.lineTo(s.points[0][0] + 0.01, s.points[0][1]);
      s.points.slice(1).forEach((p) => ctx.lineTo(...p));
      ctx.stroke();
    }
    ctx.restore();
  }, [strokes, draft]);
  return (
    <canvas className="doodle-layer" width={1000} height={1414} ref={ref} />
  );
}
export function PageCanvas({
  page,
  selected,
  onSelect,
  onChange,
  draw,
  thumb = false,
}: {
  page: Page;
  selected?: string;
  onSelect?: (id?: string) => void;
  onChange?: (page: Page) => void;
  draw?: DrawSettings;
  thumb?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    gesture = useRef<
      | {
          kind: string;
          start: [number, number];
          el?: Element;
          rect: DOMRect;
          stroke?: Stroke;
          next?: Element;
        }
      | undefined
    >(undefined);
  const [draft, setDraft] = useState<Element>(),
    [stroke, setStroke] = useState<Stroke>();
  const editable = !!onChange;
  const p = page.background,
    line = `rgba(76,83,71,${p.opacity})`;
  const bg =
    p.lines === 'grid'
      ? `linear-gradient(${line} 1px,transparent 1px),linear-gradient(90deg,${line} 1px,transparent 1px)`
      : p.lines === 'ruled'
        ? `linear-gradient(transparent 95%,${line} 95%)`
        : p.lines === 'dot'
          ? `radial-gradient(${line} 1px,transparent 1px)`
          : 'none';
  function start(e: PointerEvent, el?: Element, kind = 'move') {
    if (!editable) return;
    e.stopPropagation();
    const rect = ref.current!.getBoundingClientRect();
    if (draw) {
      const st: Stroke = {
        id: uid(),
        ...draw,
        points: [
          [
            ((e.clientX - rect.left) / rect.width) * 500,
            ((e.clientY - rect.top) / rect.height) * 707,
          ],
        ],
      };
      gesture.current = {
        kind: 'draw',
        start: [e.clientX, e.clientY],
        rect,
        stroke: st,
      };
      setStroke(st);
    } else {
      onSelect?.(el?.id);
      if (!el || el.locked) return;
      gesture.current = { kind, start: [e.clientX, e.clientY], rect, el };
      setDraft(el);
    }
    ref.current!.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const dx = ((e.clientX - g.start[0]) / g.rect.width) * 100,
      dy = ((e.clientY - g.start[1]) / g.rect.height) * 100;
    if (g.stroke) {
      const pts = g.stroke.points;
      const next: [number, number] = [
        Math.max(
          0,
          Math.min(500, ((e.clientX - g.rect.left) / g.rect.width) * 500),
        ),
        Math.max(
          0,
          Math.min(707, ((e.clientY - g.rect.top) / g.rect.height) * 707),
        ),
      ];
      if (
        Math.hypot(
          next[0] - pts[pts.length - 1][0],
          next[1] - pts[pts.length - 1][1],
        ) < 0.8
      )
        return;
      g.stroke = { ...g.stroke, points: [...pts, next] };
      setStroke(g.stroke);
      return;
    }
    const el = g.el!;
    const next = { ...el };
    if (g.kind === 'move') {
      next.x = Math.max(0, Math.min(100 - el.width, el.x + dx));
      next.y = Math.max(0, Math.min(100 - el.height, el.y + dy));
    } else if (g.kind === 'resize') {
      const scale = Math.max(0.25, Math.min(3, 1 + dx / el.width));
      next.width = Math.min(100 - el.x, Math.max(6, el.width * scale));
      next.height = Math.min(
        100 - el.y,
        Math.max(4, el.height * (next.width / el.width)),
      );
    } else next.rotation = Math.round(el.rotation + dx * 3);
    g.next = next;
    setDraft(next);
  }
  function end(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    gesture.current = undefined;
    if (g.stroke)
      onChange?.({
        ...page,
        doodles: [...page.doodles, g.stroke],
        doodlesVisible: true,
      });
    else if (g.next)
      onChange?.({
        ...page,
        elements: page.elements.map((el) =>
          el.id === g.next!.id ? g.next! : el,
        ),
      });
    setDraft(undefined);
    setStroke(undefined);
    if (ref.current?.hasPointerCapture(e.pointerId))
      ref.current.releasePointerCapture(e.pointerId);
  }
  return (
    <div
      ref={ref}
      className={`page-canvas ${editable ? 'editable' : ''} ${draw ? 'drawing' : ''}`}
      style={{
        backgroundColor: p.color,
        backgroundImage: bg,
        backgroundSize: p.lines === 'dot' ? '4% 2.83%' : '5% 3.54%',
        color: p.type === 'black' ? '#fff' : '#303b2c',
      }}
      onPointerDown={(e) => start(e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        gesture.current = undefined;
        setDraft(undefined);
        setStroke(undefined);
      }}
    >
      <div className="paper-texture" style={{ opacity: p.texture }} />
      {[...page.elements]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((original) => {
          const el = draft?.id === original.id ? draft : original;
          const style: CSSProperties = {
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
            transform: `rotate(${el.rotation}deg)`,
            zIndex: el.zIndex,
            color: el.style.color,
            fontSize: `${(el.style.fontSize || 26) / 5}cqw`,
            fontFamily: el.style.fontFamily,
            fontWeight: el.style.fontWeight || 400,
          };
          return (
            <div
              key={el.id}
              tabIndex={editable && !draw ? 0 : undefined}
              role={editable ? 'button' : undefined}
              aria-label={
                el.type === 'photo'
                  ? '写真'
                  : el.type === 'text'
                    ? el.content
                    : stickers[el.content]?.name
              }
              onFocus={() => onSelect?.(el.id)}
              className={`page-element ${el.type} ${el.style.frame || ''} ${el.type === 'sticker' ? 'sticker-' + el.content : ''} ${selected === el.id ? 'selected' : ''} ${el.locked ? 'locked' : ''}`}
              style={style}
              onPointerDown={(e) => start(e, el)}
            >
              {el.type === 'photo' ? (
                <LocalImage
                  src={el.imageRef!}
                  thumb={thumb}
                  fit={el.style.fit}
                />
              ) : el.type === 'text' ? (
                <span>{el.content}</span>
              ) : (
                <span>
                  {el.content === 'date'
                    ? new Date(
                        page.layoutSeed > 1e12
                          ? page.layoutSeed
                          : 1788739200000,
                      ).toLocaleDateString('en-CA')
                    : stickers[el.content]?.symbol || el.content}
                </span>
              )}
              {selected === el.id && editable && !draw && (
                <>
                  {el.locked ? (
                    <span className="lock-indicator">
                      <Lock size={13} />
                    </span>
                  ) : (
                    <>
                      <i className="corner tl" />
                      <i className="corner tr" />
                      <i className="corner bl" />
                      <button
                        className="resize-handle"
                        aria-label="ドラッグしてサイズ変更"
                        onPointerDown={(e) => start(e, el, 'resize')}
                      />
                      <button
                        className="rotate-handle"
                        aria-label="ドラッグして回転"
                        onPointerDown={(e) => start(e, el, 'rotate')}
                      >
                        <RotateCw size={13} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      {page.doodlesVisible && <Doodles strokes={page.doodles} draft={stroke} />}
      {!page.isCover && (
        <div className="page-number">
          {String(page.pageNumber).padStart(2, '0')}
        </div>
      )}
    </div>
  );
}

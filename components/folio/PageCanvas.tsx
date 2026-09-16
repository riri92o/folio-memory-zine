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
import {
  angle,
  angleDelta,
  resizeFromCorner,
  transformFromPinch,
  type Point,
} from '@/lib/folio/gesture';
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
function Doodles({
  strokes,
  draft,
  thumb = false,
}: {
  strokes: Stroke[];
  draft?: Stroke;
  thumb?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(thumb ? 1 : 2, thumb ? 1 : 2);
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
  }, [strokes, draft, thumb]);
  return (
    <canvas
      className="doodle-layer"
      width={thumb ? 500 : 1000}
      height={thumb ? 707 : 1414}
      ref={ref}
    />
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
    pointers = useRef(new Map<number, Point>()),
    gesture = useRef<
      | {
          kind: string;
          pointerId: number;
          start: [number, number];
          el?: Element;
          rect: DOMRect;
          stroke?: Stroke;
          next?: Element;
          pinch?: {
            ids: [number, number];
            starts: [Point, Point];
            element: Element;
          };
          rotate?: {
            pointerAngle: number;
            elementRotation: number;
          };
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
      if (gesture.current) return;
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
        pointerId: e.pointerId,
        start: [e.clientX, e.clientY],
        rect,
        stroke: st,
      };
      setStroke(st);
    } else {
      const active = gesture.current;
      const target = el || active?.el;
      if (!active) onSelect?.(target?.id);
      if (!target || target.locked) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (
        kind === 'move' &&
        active?.kind === 'move' &&
        active.el?.id === target.id &&
        pointers.current.size === 2
      ) {
        const ids = [...pointers.current.keys()] as [number, number];
        active.pinch = {
          ids,
          starts: ids.map((id) => pointers.current.get(id)!) as [Point, Point],
          element: active.next || active.el,
        };
      } else if (!active) {
        const center = {
          x: rect.left + ((target.x + target.width / 2) / 100) * rect.width,
          y: rect.top + ((target.y + target.height / 2) / 100) * rect.height,
        };
        gesture.current = {
          kind,
          pointerId: e.pointerId,
          start: [e.clientX, e.clientY],
          rect,
          el: target,
          rotate:
            kind === 'rotate'
              ? {
                  pointerAngle: angle(center, {
                    x: e.clientX,
                    y: e.clientY,
                  }),
                  elementRotation: target.rotation,
                }
              : undefined,
        };
      }
      setDraft(target);
    }
    try {
      ref.current!.setPointerCapture(e.pointerId);
    } catch {
      // Some WebKit versions can end a touch between pointerdown and capture.
      // The gesture still works through the page-level pointer handlers.
    }
    e.preventDefault();
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    if (!g.stroke)
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch) {
      const [a, b] = g.pinch.ids.map((id) => pointers.current.get(id));
      if (!a || !b) return;
      const next = {
        ...g.pinch.element,
        ...transformFromPinch(
          g.pinch.element,
          g.pinch.starts[0],
          g.pinch.starts[1],
          a,
          b,
          g.rect.width,
          g.rect.height,
        ),
        style: { ...g.pinch.element.style, auto: false },
      };
      g.next = next;
      setDraft(next);
      return;
    }
    if (e.pointerId !== g.pointerId) return;
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
    const next = { ...el, style: { ...el.style, auto: false } };
    if (g.kind === 'move') {
      next.x = Math.max(0, Math.min(100 - el.width, el.x + dx));
      next.y = Math.max(0, Math.min(100 - el.height, el.y + dy));
    } else if (g.kind === 'resize') {
      Object.assign(next, resizeFromCorner(el, dx, dy));
    } else if (g.rotate) {
      const center = {
        x: g.rect.left + ((el.x + el.width / 2) / 100) * g.rect.width,
        y: g.rect.top + ((el.y + el.height / 2) / 100) * g.rect.height,
      };
      next.rotation = Math.round(
        g.rotate.elementRotation +
          angleDelta(
            g.rotate.pointerAngle,
            angle(center, { x: e.clientX, y: e.clientY }),
          ),
      );
    }
    g.next = next;
    setDraft(next);
  }
  function end(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    pointers.current.delete(e.pointerId);
    if (g.pinch && pointers.current.size > 0) return;
    if (!g.pinch && e.pointerId !== g.pointerId) return;
    gesture.current = undefined;
    pointers.current.clear();
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
      onPointerCancel={end}
      onLostPointerCapture={end}
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
            fontFamily: el.style.fontFamily?.includes('Snell Roundhand')
              ? '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif'
              : el.style.fontFamily,
            fontWeight: el.style.fontWeight || 400,
            background: el.style.background,
            fontStyle: el.style.italic ? 'italic' : undefined,
            letterSpacing: el.style.letterSpacing,
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
                  {el.style.label ||
                    (el.content === 'date'
                      ? new Date(
                          page.layoutSeed > 1e12
                            ? page.layoutSeed
                            : 1788739200000,
                        ).toLocaleDateString('en-CA')
                      : stickers[el.content]?.symbol || el.content)}
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
      {(page.doodlesVisible || !!draw) && (
        <Doodles strokes={page.doodles} draft={stroke} thumb={thumb} />
      )}
      {!page.isCover && (
        <div className="page-number">
          {String(page.pageNumber).padStart(2, '0')}
        </div>
      )}
    </div>
  );
}

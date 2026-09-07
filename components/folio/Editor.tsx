'use client';
import { useRef, useState, useEffect } from 'react';
import {
  Plus,
  ImagePlus,
  Shuffle,
  Type,
  Sticker,
  PenLine,
  Palette,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  Settings2,
  Sparkles,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  type Folio,
  type Page,
  type Photo,
  type Element,
  type ThemeId,
  paper,
  readableInk,
  newPage,
  newElement,
  normalize,
  themes,
  uid,
} from '@/lib/folio/model';
import { generateLayout } from '@/lib/folio/layout';
import { importPhoto } from '@/lib/folio/storage';
import { PageCanvas, type DrawSettings } from './PageCanvas';
import { Confirm } from './controls';
import { ToolContent, ElementPanel, BookSettings } from './EditorPanels';
import { useWide } from './useWide';
export function Editor({
  folio,
  onChange,
  onView,
  onError,
  initialIndex = 0,
}: {
  folio: Folio;
  onChange: (f: Folio, p?: Photo[]) => Promise<void>;
  onView: () => void;
  onError: (s: string) => void;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex),
    [selected, setSelected] = useState<string>(),
    [tool, setTool] = useState('photos'),
    [panelOpen, setPanelOpen] = useState(false),
    [draw, setDraw] = useState<DrawSettings>({
      tool: 'pen',
      color: '#2463eb',
      width: 4,
    }),
    [drawing, setDrawing] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [history, setHistory] = useState<Folio[]>([]),
    [future, setFuture] = useState<Folio[]>([]);
  const input = useRef<HTMLInputElement>(null),
    current = useRef(folio);
  useEffect(() => {
    current.current = folio;
  }, [folio]);
  const wide = useWide();
  const page = folio.pages[Math.min(index, folio.pages.length - 1)],
    el = page.elements.find((e) => e.id === selected),
    photoCount = page.elements.filter((e) => e.type === 'photo').length;
  function commit(next: Folio, photos: Photo[] = []) {
    setHistory((h) => [...h.slice(-39), current.current]);
    setFuture([]);
    void onChange(normalize(next), photos);
  }
  function updatePage(p: Page) {
    commit({
      ...current.current,
      pages: current.current.pages.map((v) => (v.id === p.id ? p : v)),
    });
  }
  function updatePaper(background: Page['background']) {
    updatePage({
      ...page,
      background,
      elements: page.elements.map((element) =>
        element.type === 'text'
          ? {
              ...element,
              style: {
                ...element.style,
                color: readableInk(
                  background.color,
                  element.style.color || themes[folio.theme].ink,
                ),
              },
            }
          : element,
      ),
    });
  }
  function patchElement(change: Partial<Element>) {
    if (!el || (el.locked && !('locked' in change))) return;
    updatePage({
      ...page,
      elements: page.elements.map((e) =>
        e.id === el.id
          ? {
              ...e,
              ...change,
              style: { ...e.style, ...change.style, auto: false },
            }
          : e,
      ),
    });
  }
  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setFuture((v) => [folio, ...v]);
    setIndex(Math.min(index, prev.pages.length - 1));
    void onChange(prev);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture(future.slice(1));
    setHistory((v) => [...v, folio]);
    setIndex(Math.min(index, next.pages.length - 1));
    void onChange(next);
  }
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,[role=slider],[role=combobox],[role=tab]',
        )
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (el && !el.locked) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          updatePage({
            ...page,
            elements: page.elements.filter((x) => x.id !== el.id),
          });
          setSelected(undefined);
        }
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (directions[e.key]) {
          e.preventDefault();
          const [x, y] = directions[e.key];
          patchElement({
            x: Math.max(
              0,
              Math.min(100 - el.width, el.x + x * (e.shiftKey ? 3 : 0.5)),
            ),
            y: Math.max(
              0,
              Math.min(100 - el.height, el.y + y * (e.shiftKey ? 3 : 0.5)),
            ),
          });
        }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });
  async function photos(files: FileList | null) {
    if (!files?.length) return;
    const room = 5 - photoCount;
    if (files.length > room) {
      onError(`このページにはあと${room}枚追加できます。1ページ最大5枚です。`);
      if (input.current) input.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const imported: Photo[] = [];
      for (const file of Array.from(files))
        imported.push(await importPhoto(file));
      const additions = imported.map((p) => ({
        ...newElement('photo'),
        imageRef: p.id,
        aspect: p.width / p.height,
      }));
      const latest = current.current;
      const target = latest.pages.find((p) => p.id === page.id);
      if (!target)
        throw new Error(
          '写真の準備中にページが削除されました。追加先のページを選び直してください。',
        );
      if (
        target.elements.filter((e) => e.type === 'photo').length +
          additions.length >
        5
      )
        throw new Error(
          '写真は1ページ最大5枚です。追加する枚数を減らしてください。',
        );
      const next = generateLayout(
        { ...target, elements: [...target.elements, ...additions] },
        latest.theme,
        Date.now(),
      );
      commit(
        {
          ...latest,
          pages: latest.pages.map((p) => (p.id === target.id ? next : p)),
        },
        imported,
      );
      setPanelOpen(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  function addElement(e: Element) {
    e.zIndex = Math.max(30, ...page.elements.map((v) => v.zIndex + 1));
    e.style = { ...e.style, auto: false };
    updatePage({ ...page, elements: [...page.elements, e] });
    setSelected(e.id);
    setDrawing(false);
    if (e.type === 'text') {
      setTool('element');
      setPanelOpen(true);
    } else setPanelOpen(false);
  }
  function duplicate() {
    if (el && !el.locked)
      addElement({
        ...el,
        id: uid(),
        x: Math.min(100 - el.width, el.x + 3),
        y: Math.min(100 - el.height, el.y + 3),
      });
  }
  function removeElement() {
    if (!el || el.locked) return;
    updatePage({
      ...page,
      elements: page.elements.filter((e) => e.id !== el.id),
    });
    setSelected(undefined);
    setPanelOpen(false);
  }
  function layer(direction: number) {
    if (!el || el.locked) return;
    const ordered = page.elements
      .filter((e) => e.id !== el.id)
      .sort((a, b) => a.zIndex - b.zIndex);
    if (direction > 0) ordered.push(el);
    else ordered.unshift(el);
    updatePage({
      ...page,
      elements: ordered.map((e, i) => ({ ...e, zIndex: 10 + i })),
    });
  }
  function patch(change: Partial<Element>) {
    if (change.zIndex !== undefined && el) {
      layer(change.zIndex > el.zIndex ? 1 : -1);
      return;
    }
    patchElement(change);
  }
  function openTool(name: string) {
    setTool(name);
    setPanelOpen(true);
    if (name !== 'draw') setDrawing(false);
  }
  function changeTheme(theme: ThemeId) {
    commit({
      ...folio,
      theme,
      paperType: themes[theme].paper,
      pages: folio.pages.map((p) =>
        p.id === page.id
          ? generateLayout(
              { ...p, background: paper(themes[theme].paper) },
              theme,
              Date.now(),
              { varyPaper: true },
            )
          : p,
      ),
    });
    setSelected(undefined);
  }
  function addPage() {
    if (folio.pages.length >= 15) return;
    const p = newPage(folio.id, folio.pages.length, folio.paperType);
    commit({ ...folio, pages: [...folio.pages, p] });
    setIndex(folio.pages.length);
    setSelected(undefined);
    setPanelOpen(false);
  }
  function reorder(from: number, to: number) {
    if (from === 0 || to === 0 || from === to || to >= folio.pages.length)
      return;
    const pages = [...folio.pages],
      moved = pages.splice(from, 1)[0];
    pages.splice(to, 0, moved);
    commit({ ...folio, pages });
    setIndex(pages.findIndex((p) => p.id === page.id));
  }
  const indices = wide
    ? [Math.floor(index / 2) * 2, Math.floor(index / 2) * 2 + 1]
    : [index];
  const titles: Record<string, string> = {
    photos: '写真を追加',
    text: '文字を追加',
    stickers: 'ステッカーを追加',
    draw: 'ページに描く',
    paper: '紙を変更',
    theme: 'テーマを変更',
    pages: 'ページ一覧',
    book: 'このFolioについて',
    element: '自分らしく調整。',
  };
  const inspector = el ? (
    <ElementPanel
      el={el}
      photoCount={photoCount}
      onPatch={patch}
      onDuplicate={duplicate}
      onDelete={removeElement}
    />
  ) : (
    <div className="inspector-empty">
      <span className="handwritten">自由に調整できます</span>
      <span className="empty-selection-icon">
        <Settings2 size={25} />
      </span>
      <p>
        写真や文字に触れて、
        <br />
        好きなところへ。
      </p>
      <small>
        角を引いて大きさを変えたり、
        <br />
        少し傾けたり。きっちりじゃなくていい。
      </small>
    </div>
  );
  return (
    <div className={`studio ${drawing ? 'pen-active' : ''}`}>
      <input
        hidden
        ref={input}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => photos(e.target.files)}
      />
      <div className="studio-workspace">
        <aside className="page-rail">
          <div className="rail-title">
            <span>Pages</span>
            <small>{folio.pageCount}/15</small>
          </div>
          <PageRail
            folio={folio}
            index={index}
            onSelect={(i) => {
              setIndex(i);
              setSelected(undefined);
            }}
            onReorder={reorder}
          />
          <button
            className="rail-add"
            disabled={folio.pageCount >= 15}
            onClick={addPage}
          >
            <Plus size={18} />
            <span>ページを追加</span>
          </button>
          <button className="rail-book" onClick={() => openTool('book')}>
            <BookOpen size={17} />
            冊子の設定
          </button>
        </aside>
        <div className="studio-center">
          <div className="canvas-controls">
            <button
              className="current-page-label"
              onClick={() => openTool('pages')}
            >
              <Layers size={16} />
              {page.isCover
                ? 'Cover'
                : `Page ${String(index).padStart(2, '0')}`}
              <span>⌄</span>
            </button>
            <div className="history-controls">
              <button
                className="icon-button"
                aria-label="元に戻す"
                disabled={!history.length}
                onClick={undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="やり直す"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
            </div>
            <button
              className="regenerate-page"
              disabled={!photoCount}
              onClick={() => {
                setSelected(undefined);
                updatePage(
                  generateLayout(page, folio.theme, Date.now(), {
                    varyPaper: true,
                  }),
                );
              }}
            >
              <Shuffle size={15} />
              <span>別のデザイン</span>
            </button>
          </div>
          <div className="studio-stage">
            <div
              className={`editing-spread ${wide ? 'wide' : ''} ${folio.bookType}`}
            >
              {indices.map((i) =>
                folio.pages[i] ? (
                  <div
                    className={`editing-leaf ${i === index ? 'active' : ''}`}
                    key={folio.pages[i].id}
                  >
                    <PageCanvas
                      page={folio.pages[i]}
                      selected={i === index ? selected : undefined}
                      onSelect={(id) => {
                        setIndex(i);
                        setSelected(id);
                      }}
                      onChange={updatePage}
                      draw={drawing ? draw : undefined}
                    />
                  </div>
                ) : (
                  <button
                    key="blank"
                    className="blank-leaf"
                    onClick={addPage}
                    disabled={folio.pageCount >= 15}
                  >
                    <Plus size={25} />
                    <span>次のページをつくる</span>
                  </button>
                ),
              )}
              {folio.bookType === 'binder' && (
                <div className="binder-binding">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              )}
              {!page.elements.length && (
                <button
                  className="empty-page-action"
                  onClick={() => openTool('photos')}
                >
                  <ImagePlus size={27} />
                  <span>ここから、はじめよう。</span>
                  <small>写真を追加する</small>
                </button>
              )}
            </div>
          </div>
          <div className="canvas-status">
            <button
              className="icon-button"
              aria-label="前のページを編集"
              disabled={index === 0}
              onClick={() => {
                setIndex(index - 1);
                setSelected(undefined);
              }}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {drawing
                ? '写真の上にも、余白にも。そのまま描けます。'
                : selected
                  ? '好きなところへ、自由に。'
                  : '写真や文字にタップして、アレンジ。'}
            </span>
            <button
              className="icon-button"
              aria-label="次のページを編集"
              disabled={index === folio.pages.length - 1}
              onClick={() => {
                setIndex(index + 1);
                setSelected(undefined);
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <aside className="selection-panel">
          {inspector}
          <div className="selection-footer">
            <span>{themes[folio.theme].en}</span>
            <button onClick={onView}>
              <BookOpen size={16} />
              めくってみる
            </button>
          </div>
        </aside>
      </div>
      {selected && !drawing && el && (
        <div className="floating-selection">
          <button
            aria-label="選択中の要素を編集"
            onClick={() => openTool('element')}
          >
            <Settings2 size={18} />
          </button>
          <button
            aria-label="前面へ"
            disabled={el.locked}
            onClick={() => layer(1)}
          >
            <ArrowUp size={18} />
          </button>
          <button
            aria-label="背面へ"
            disabled={el.locked}
            onClick={() => layer(-1)}
          >
            <ArrowDown size={18} />
          </button>
          <button
            aria-label="複製"
            disabled={el.locked || (el.type === 'photo' && photoCount >= 5)}
            onClick={duplicate}
          >
            <Copy size={17} />
          </button>
          <button
            aria-label={el.locked ? 'ロック解除' : 'ロック'}
            onClick={() => patchElement({ locked: !el.locked })}
          >
            {el.locked ? <Lock size={17} /> : <Unlock size={17} />}
          </button>
          <button
            aria-label="要素を削除"
            disabled={el.locked}
            onClick={removeElement}
          >
            <Trash2 size={17} />
          </button>
          <button
            aria-label="選択を解除"
            onClick={() => setSelected(undefined)}
          >
            <Check size={18} />
          </button>
        </div>
      )}
      {drawing && (
        <div className="drawing-ribbon">
          <button className="current-pen" onClick={() => openTool('draw')}>
            <PenLine size={18} />
            <i style={{ background: draw.color }} />
            <span>{draw.width}px</span>
          </button>
          <button
            onClick={() =>
              setDraw({
                ...draw,
                tool: draw.tool === 'eraser' ? 'pen' : 'eraser',
              })
            }
          >
            {draw.tool === 'eraser' ? 'ペンに戻る' : '消しゴム'}
          </button>
          <button onClick={() => setDrawing(false)}>
            <Check size={16} />
            できた
          </button>
        </div>
      )}
      <nav className="creative-dock" aria-label="編集ツール">
        {[
          ['photos', ImagePlus, '写真'],
          ['text', Type, '文字'],
          ['stickers', Sticker, 'ステッカー'],
          ['draw', PenLine, 'ペン'],
          ['paper', Palette, '紙'],
          ['theme', Sparkles, 'テーマ'],
          ['book', BookOpen, '冊子'],
        ].map(([id, Icon, label]) => {
          const I = Icon as typeof ImagePlus;
          return (
            <button
              className={
                (panelOpen && tool === id) || (drawing && id === 'draw')
                  ? 'active'
                  : ''
              }
              key={id as string}
              onClick={() => openTool(id as string)}
            >
              <I size={22} />
              <span>{label as string}</span>
            </button>
          );
        })}
      </nav>
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent
          side={wide ? 'right' : 'bottom'}
          className={`studio-sheet ${wide ? 'desktop-sheet' : ''}`}
        >
          <div className="sheet-grip" />
          <SheetTitle>{titles[tool]}</SheetTitle>
          <SheetDescription className="sr-only">
            必要な道具を選んで、ページを自由に編集できます。
          </SheetDescription>
          <div className="sheet-body">
            {tool === 'element' ? (
              inspector
            ) : tool === 'book' ? (
              <BookSettings folio={folio} onChange={commit} />
            ) : tool === 'pages' ? (
              <>
                <PageRail
                  folio={folio}
                  index={index}
                  onSelect={(i) => {
                    setIndex(i);
                    setSelected(undefined);
                    setPanelOpen(false);
                  }}
                  onReorder={reorder}
                  inSheet
                />
                <div className="page-sheet-actions">
                  <button
                    className="secondary"
                    disabled={folio.pageCount >= 15}
                    onClick={addPage}
                  >
                    <Plus size={17} />
                    追加
                  </button>
                  <button
                    className="secondary"
                    disabled={page.isCover}
                    onClick={() => setConfirm(true)}
                  >
                    <Trash2 size={17} />
                    このページを削除
                  </button>
                </div>
                <details className="fine-adjust">
                  <summary>タイトル・本の形式</summary>
                  <BookSettings folio={folio} onChange={commit} />
                </details>
              </>
            ) : (
              <ToolContent
                tool={tool}
                folio={folio}
                page={page}
                photoCount={photoCount}
                busy={busy}
                onPhotos={() => input.current?.click()}
                onAdd={addElement}
                onPaper={updatePaper}
                onTheme={changeTheme}
                draw={draw}
                onDraw={setDraw}
                onDrawStart={() => {
                  setDrawing(true);
                  setSelected(undefined);
                  setPanelOpen(false);
                  if (!page.doodlesVisible)
                    updatePage({ ...page, doodlesVisible: true });
                }}
                onPage={updatePage}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </div>
          {['paper', 'theme', 'element', 'book'].includes(tool) && (
            <button
              className="primary full sheet-done"
              onClick={() => setPanelOpen(false)}
            >
              <Check size={17} />
              できた
            </button>
          )}
        </SheetContent>
      </Sheet>
      {confirm && (
        <Confirm
          title="このページを削除しますか？"
          description="写真や落書きを含めて削除します。「元に戻す」で復元できます。"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            commit({
              ...folio,
              pages: folio.pages.filter((p) => p.id !== page.id),
            });
            setIndex(Math.max(0, index - 1));
            setSelected(undefined);
            setPanelOpen(false);
          }}
        />
      )}
    </div>
  );
}
function PageRail({
  folio,
  index,
  onSelect,
  onReorder,
  inSheet = false,
}: {
  folio: Folio;
  index: number;
  onSelect: (i: number) => void;
  onReorder: (from: number, to: number) => void;
  inSheet?: boolean;
}) {
  return (
    <nav
      className={`page-miniatures ${inSheet ? 'in-sheet' : ''}`}
      aria-label="ページ一覧"
    >
      {folio.pages.map((p, i) => (
        <div key={p.id} className={index === i ? 'active' : ''}>
          <button
            className="miniature"
            onClick={() => onSelect(i)}
            draggable={i > 0}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(i));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (i > 0) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (
                Number.isInteger(from) &&
                from > 0 &&
                from < folio.pages.length
              )
                onReorder(from, i);
            }}
          >
            <PageCanvas page={p} thumb />
            <span>{i === 0 ? 'Cover' : String(i).padStart(2, '0')}</span>
          </button>
          {inSheet && i > 0 && (
            <div className="reorder-buttons">
              <button
                aria-label={`ページ${i}を前へ`}
                disabled={i === 1}
                onClick={() => onReorder(i, i - 1)}
              >
                <MoveUp size={14} />
              </button>
              <button
                aria-label={`ページ${i}を後ろへ`}
                disabled={i === folio.pages.length - 1}
                onClick={() => onReorder(i, i + 1)}
              >
                <MoveDown size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

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
  MousePointer2,
  BookOpen,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  type Folio,
  type Page,
  type Photo,
  type Element,
  type ThemeId,
  type PaperId,
  themes,
  paperNames,
  readableInk,
  paper,
  newPage,
  newElement,
  normalize,
  stickers,
  uid,
} from '@/lib/folio/model';
import { generateLayout } from '@/lib/folio/layout';
import { importPhoto } from '@/lib/folio/storage';
import { PageCanvas, type DrawSettings } from './PageCanvas';
import { Choice, Range, Confirm } from './controls';
export function Editor({
  folio,
  onChange,
  onView,
  onError,
}: {
  folio: Folio;
  onChange: (f: Folio, p?: Photo[]) => Promise<void>;
  onView: () => void;
  onError: (s: string) => void;
}) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string>(),
    [tab, setTab] = useState('photos'),
    [draw, setDraw] = useState<DrawSettings>({
      tool: 'pen',
      color: '#f45d35',
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
        e.id === el.id ? { ...e, ...change } : e,
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
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  function addElement(e: Element) {
    e.zIndex = Math.max(e.zIndex, ...page.elements.map((v) => v.zIndex + 1));
    updatePage({ ...page, elements: [...page.elements, e] });
    setSelected(e.id);
    setDrawing(false);
  }
  return (
    <div className="editor-layout">
      <div className="editor-work">
        <div className="canvas-top">
          <span>
            {page.isCover ? '表紙' : `PAGE ${String(index).padStart(2, '0')}`}{' '}
            <small> / {folio.pageCount - 1} ページ</small>
          </span>
          <div className="icon-row">
            <button
              className="icon-button"
              aria-label="元に戻す"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="やり直す"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={19} />
            </button>
            <button
              className="icon-button danger"
              aria-label="ページを削除"
              disabled={page.isCover}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <div className={`edit-spread ${folio.bookType}`}>
          <div className="current-page">
            <PageCanvas
              page={page}
              selected={selected}
              onSelect={setSelected}
              onChange={updatePage}
              draw={drawing ? draw : undefined}
            />
          </div>
          {folio.pages[index + 1] && (
            <button
              className="neighbor-page"
              aria-label="次のページを編集"
              onClick={() => {
                setIndex(index + 1);
                setSelected(undefined);
              }}
            >
              <PageCanvas page={folio.pages[index + 1]} thumb />
            </button>
          )}
          {folio.bookType === 'binder' && (
            <div className="binder-rings">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <div className="canvas-hint">
          {drawing
            ? '写真の上にも、そのまま描けます。'
            : el
              ? 'ドラッグで移動。右下でサイズ、上のハンドルで回転。'
              : '写真を追加して、自分だけのページに。'}
        </div>
        <nav className="page-strip" aria-label="ページ一覧">
          {folio.pages.map((p, i) => (
            <button
              key={p.id}
              className={index === i ? 'active' : ''}
              onClick={() => {
                setIndex(i);
                setSelected(undefined);
              }}
            >
              <div>
                <PageCanvas page={p} thumb />
              </div>
              <span>{i === 0 ? '表紙' : String(i).padStart(2, '0')}</span>
            </button>
          ))}
          <button
            className="add-page"
            disabled={folio.pages.length >= 15}
            onClick={() => {
              const p = newPage(folio.id, folio.pages.length, folio.paperType);
              commit({ ...folio, pages: [...folio.pages, p] });
              setIndex(folio.pages.length);
              setSelected(undefined);
            }}
          >
            <Plus size={22} />
            <span>追加</span>
          </button>
        </nav>
        <div className="page-limit">
          表紙を含め {folio.pages.length} / 15 ページ
        </div>
      </div>
      <aside className="tool-panel">
        <div className="panel-title">
          <h2>自分らしく、アレンジ。</h2>
          <p>ぴったり収めなくても、いい感じ。</p>
        </div>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(String(v));
            setDrawing(v === 'draw');
            setSelected(undefined);
          }}
        >
          <TabsList className="tool-tabs">
            {[
              ['photos', ImagePlus, '写真'],
              ['text', Type, '文字'],
              ['stickers', Sticker, '装飾'],
              ['draw', PenLine, '落書き'],
              ['design', Palette, '紙・テーマ'],
            ].map(([id, Icon, label]) => {
              const I = Icon as typeof ImagePlus;
              return (
                <TabsTrigger value={id as string} key={id as string}>
                  <I size={19} />
                  <span>{label as string}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="photos">
            <input
              hidden
              ref={input}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => photos(e.target.files)}
            />
            <button
              className="upload-zone"
              disabled={busy || photoCount >= 5}
              onClick={() => input.current?.click()}
            >
              <ImagePlus size={30} />
              <strong>{busy ? '写真を準備しています…' : '写真を追加'}</strong>
              <span>{photoCount} / 5 枚 · このページに追加</span>
            </button>
            <button
              className="secondary full"
              disabled={!photoCount}
              onClick={() => {
                setSelected(undefined);
                updatePage(generateLayout(page, folio.theme, Date.now()));
              }}
            >
              <Shuffle size={18} />
              別のデザインにする
            </button>
            <p className="help">
              自動で配置したら、写真をタップして自由に調整。写真の全体を表示するので、顔も切れにくくなります。
            </p>
          </TabsContent>
          <TabsContent value="text">
            <button
              className="secondary full"
              onClick={() =>
                addElement({
                  ...newElement('text', 'あの日のこと。'),
                  style: {
                    fontSize: 28,
                    color: readableInk(
                      page.background.color,
                      themes[folio.theme].ink,
                    ),
                  },
                })
              }
            >
              <Plus size={18} />
              テキストを追加
            </button>
            <p className="help">
              タイトルも、短いひとことも。追加した文字を選ぶと編集できます。
            </p>
          </TabsContent>
          <TabsContent value="stickers">
            <p className="mini-label">このテーマにおすすめ</p>
            <div className="sticker-grid">
              {Object.entries(stickers)
                .sort(
                  ([a], [b]) =>
                    (b === themes[folio.theme].decor ? 1 : 0) -
                    (a === themes[folio.theme].decor ? 1 : 0),
                )
                .map(([id, s]) => (
                  <button
                    key={id}
                    onClick={() =>
                      addElement({
                        ...newElement('sticker', id),
                        width: ['tape', 'date'].includes(id)
                          ? 32
                          : id === 'film' || id === 'polaroid'
                            ? 55
                            : 25,
                        height: id === 'film' || id === 'polaroid' ? 45 : 16,
                        style: {
                          color: readableInk(
                            page.background.color,
                            themes[folio.theme].ink,
                          ),
                          fontSize: 32,
                        },
                      })
                    }
                  >
                    <span>
                      {id === 'film'
                        ? '▣'
                        : id === 'polaroid'
                          ? '▤'
                          : id === 'tape'
                            ? '▰'
                            : s.symbol}
                    </span>
                    <small>{s.name}</small>
                  </button>
                ))}
            </div>
          </TabsContent>
          <TabsContent value="draw">
            <div className="draw-modes">
              {[
                ['pen', 'ペン'],
                ['marker', 'マーカー'],
                ['eraser', '消しゴム'],
                ['dotted', '点線'],
              ].map(([id, name]) => (
                <button
                  className={drawing && draw.tool === id ? 'active' : ''}
                  key={id}
                  onClick={() => {
                    setDrawing(true);
                    setDraw({ ...draw, tool: id as DrawSettings['tool'] });
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <label className="color-field">
              インクの色
              <input
                type="color"
                value={draw.color}
                onChange={(e) => setDraw({ ...draw, color: e.target.value })}
              />
            </label>
            <div className="swatches">
              {[
                '#f45d35',
                '#2f3931',
                '#fffefa',
                '#718bd1',
                '#e79abc',
                '#a4be5d',
                '#f5d94a',
              ].map((c) => (
                <button
                  key={c}
                  style={{ background: c }}
                  aria-label={`ペンの色 ${c}`}
                  onClick={() => setDraw({ ...draw, color: c })}
                />
              ))}
            </div>
            <Range
              label="太さ"
              value={draw.width}
              min={1}
              max={30}
              onChange={(v) => setDraw({ ...draw, width: v })}
            />
            <div className="switch-line">
              落書きを表示
              <Switch
                aria-label="落書きを表示"
                checked={page.doodlesVisible}
                onCheckedChange={(v) =>
                  updatePage({ ...page, doodlesVisible: v })
                }
              />
            </div>
            <button
              className="secondary full"
              onClick={() => setDrawing(!drawing)}
            >
              <MousePointer2 size={18} />
              {drawing ? '要素の調整に戻る' : 'ページに描く'}
            </button>
            <p className="help">
              消しゴムは落書きだけを消します。上の矢印で元に戻す・やり直すができます。
            </p>
          </TabsContent>
          <TabsContent value="design">
            <div className="field-label">
              冊子のテーマ
              <Choice
                label="テーマ"
                value={folio.theme}
                options={Object.entries(themes).map(([value, t]) => ({
                  value,
                  label: t.name,
                }))}
                onChange={(v) => {
                  const theme = v as ThemeId;
                  commit({
                    ...folio,
                    theme,
                    paperType: themes[theme].paper,
                    pages: folio.pages.map((p) => ({
                      ...p,
                      background: paper(themes[theme].paper),
                      elements: p.elements.map((e) =>
                        e.type === 'text'
                          ? {
                              ...e,
                              style: {
                                ...e.style,
                                color: themes[theme].ink,
                                fontFamily: themes[theme].font,
                              },
                            }
                          : e,
                      ),
                    })),
                  });
                }}
              />
            </div>
            <p className="help">
              テーマ変更で全ページの紙と文字色を更新。写真の位置はそのままです。
            </p>
            <div className="field-label">
              このページの紙
              <Choice
                label="紙の種類"
                value={page.background.type}
                options={Object.entries(paperNames).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(v) => updatePaper(paper(v as PaperId))}
              />
            </div>
            <label className="color-field">
              紙の色
              <input
                type="color"
                value={page.background.color}
                onChange={(e) =>
                  updatePaper({ ...page.background, color: e.target.value })
                }
              />
            </label>
            <Choice
              label="線の種類"
              value={page.background.lines}
              options={[
                { value: 'none', label: '線なし' },
                { value: 'ruled', label: '横罫' },
                { value: 'grid', label: '方眼' },
                { value: 'dot', label: 'ドット' },
              ]}
              onChange={(v) =>
                updatePage({
                  ...page,
                  background: {
                    ...page.background,
                    lines: v as Page['background']['lines'],
                  },
                })
              }
            />
            <Range
              label="線の濃さ"
              value={page.background.opacity * 100}
              onChange={(v) =>
                updatePage({
                  ...page,
                  background: { ...page.background, opacity: v / 100 },
                })
              }
            />
            <Range
              label="紙の質感"
              value={page.background.texture * 100}
              onChange={(v) =>
                updatePage({
                  ...page,
                  background: { ...page.background, texture: v / 100 },
                })
              }
            />
            <div className="field-label">
              冊子の形式
              <Choice
                label="冊子の形式"
                value={folio.bookType}
                options={[
                  { value: 'book', label: '本型' },
                  { value: 'binder', label: 'バインダー型' },
                ]}
                onChange={(v) =>
                  commit({ ...folio, bookType: v as Folio['bookType'] })
                }
              />
            </div>
            <label className="field-label">
              本棚のタイトル
              <input
                value={folio.title}
                maxLength={80}
                onChange={(e) => commit({ ...folio, title: e.target.value })}
              />
            </label>
          </TabsContent>
        </Tabs>
        {el && !drawing && (
          <section className="element-inspector">
            <div className="inspector-heading">
              <strong>
                {el.type === 'photo'
                  ? '写真を調整'
                  : el.type === 'text'
                    ? '文字を編集'
                    : '装飾を調整'}
              </strong>
              <button
                className="icon-button"
                aria-label={el.locked ? 'ロック解除' : 'ロック'}
                onClick={() => patchElement({ locked: !el.locked })}
              >
                {el.locked ? <Lock size={17} /> : <Unlock size={17} />}
              </button>
            </div>
            {el.locked ? (
              <p className="help">ロック中です。鍵を押すと調整できます。</p>
            ) : (
              <>
                {el.type === 'text' && (
                  <>
                    <textarea
                      aria-label="テキストの内容"
                      rows={3}
                      value={el.content}
                      maxLength={500}
                      onChange={(e) =>
                        patchElement({ content: e.target.value })
                      }
                    />
                    <Range
                      label="文字サイズ"
                      min={10}
                      max={80}
                      value={el.style.fontSize || 28}
                      onChange={(v) =>
                        patchElement({ style: { ...el.style, fontSize: v } })
                      }
                    />
                    <label className="color-field">
                      文字の色
                      <input
                        type="color"
                        value={el.style.color || '#323b30'}
                        onChange={(e) =>
                          patchElement({
                            style: { ...el.style, color: e.target.value },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {el.type === 'photo' && (
                  <Choice
                    label="写真のフレーム"
                    value={el.style.frame || 'none'}
                    options={[
                      { value: 'none', label: 'フレームなし' },
                      { value: 'polaroid', label: 'ポラロイド' },
                      { value: 'film', label: 'フィルム' },
                    ]}
                    onChange={(v) =>
                      patchElement({ style: { ...el.style, frame: v } })
                    }
                  />
                )}
                <Range
                  label="回転"
                  min={-180}
                  max={180}
                  value={el.rotation}
                  onChange={(v) => patchElement({ rotation: v })}
                />
                <Range
                  label="サイズ"
                  min={6}
                  max={Math.max(6, 100 - el.x)}
                  value={el.width}
                  onChange={(v) =>
                    patchElement({
                      width: v,
                      height: Math.min(100 - el.y, (el.height * v) / el.width),
                    })
                  }
                />
                <div className="element-actions">
                  <button
                    onClick={() =>
                      patchElement({
                        zIndex:
                          Math.max(...page.elements.map((e) => e.zIndex)) + 1,
                      })
                    }
                  >
                    <ArrowUp size={17} />
                    前面
                  </button>
                  <button
                    onClick={() =>
                      patchElement({
                        zIndex:
                          Math.min(...page.elements.map((e) => e.zIndex)) - 1,
                      })
                    }
                  >
                    <ArrowDown size={17} />
                    背面
                  </button>
                  <button
                    disabled={el.type === 'photo' && photoCount >= 5}
                    onClick={() =>
                      addElement({
                        ...el,
                        id: uid(),
                        x: Math.min(100 - el.width, el.x + 3),
                        y: Math.min(100 - el.height, el.y + 3),
                      })
                    }
                  >
                    <Copy size={17} />
                    複製
                  </button>
                  <button
                    onClick={() => {
                      updatePage({
                        ...page,
                        elements: page.elements.filter((e) => e.id !== el.id),
                      });
                      setSelected(undefined);
                    }}
                  >
                    <Trash2 size={17} />
                    削除
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        <button className="preview-button" onClick={onView}>
          <BookOpen size={18} />
          本をめくってみる <span>↗</span>
        </button>
      </aside>
      {confirm && (
        <Confirm
          title="このページを削除しますか？"
          description="写真、文字、落書きを含むページを削除します。編集画面の「元に戻す」で復元できます。"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            commit({
              ...folio,
              pages: folio.pages.filter((p) => p.id !== page.id),
            });
            setIndex(Math.max(0, index - 1));
            setSelected(undefined);
          }}
        />
      )}
    </div>
  );
}

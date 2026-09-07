'use client';
import {
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Plus,
  ImagePlus,
  PenLine,
  BookOpen,
  NotebookPen,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Range } from './controls';
import { PageCanvas, type DrawSettings } from './PageCanvas';
import { ThemePicker } from './ThemePicker';
import {
  themes,
  paper,
  paperNames,
  stickers,
  newElement,
  readableInk,
  type Element,
  type Page,
  type Folio,
  type Paper,
  type ThemeId,
} from '@/lib/folio/model';
export function Segments({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <RadioGroup
      className="segments"
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(String(v))}
    >
      {items.map((item) => (
        <label
          key={item.value}
          className={value === item.value ? 'active' : ''}
        >
          <RadioGroupItem value={item.value} aria-label={item.label} />
          <span>{item.label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
export function ElementPanel({
  el,
  photoCount,
  onPatch,
  onDuplicate,
  onDelete,
}: {
  el: Element;
  photoCount: number;
  onPatch: (p: Partial<Element>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="element-panel">
      <div className="inspector-heading">
        <strong>
          {el.type === 'photo'
            ? 'Photo'
            : el.type === 'text'
              ? 'Your words'
              : 'A little extra'}
        </strong>
        <button
          className="icon-button"
          onClick={() => onPatch({ locked: !el.locked })}
          aria-label={el.locked ? 'ロック解除' : 'ロック'}
        >
          {el.locked ? <Lock size={18} /> : <Unlock size={18} />}
        </button>
      </div>
      {el.locked ? (
        <p className="help">この要素はロック中。鍵をタップして解除できます。</p>
      ) : (
        <>
          {el.type === 'text' && (
            <>
              <textarea
                aria-label="テキストの内容"
                value={el.content}
                rows={3}
                maxLength={500}
                onChange={(e) => onPatch({ content: e.target.value })}
              />
              <Segments
                label="文字の雰囲気"
                value={
                  el.style.fontFamily?.includes('cursive')
                    ? 'hand'
                    : el.style.fontFamily === 'serif'
                      ? 'serif'
                      : 'sans'
                }
                items={[
                  { value: 'sans', label: 'Aa' },
                  { value: 'serif', label: 'Serif' },
                  { value: 'hand', label: '手書き' },
                ]}
                onChange={(v) =>
                  onPatch({
                    style: {
                      ...el.style,
                      fontFamily:
                        v === 'hand'
                          ? '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif'
                          : v === 'serif'
                            ? 'serif'
                            : 'Arial, sans-serif',
                    },
                  })
                }
              />
              <Range
                label="文字の大きさ"
                value={el.style.fontSize || 28}
                min={10}
                max={85}
                onChange={(v) =>
                  onPatch({ style: { ...el.style, fontSize: v } })
                }
              />
              <label className="color-field">
                文字の色
                <input
                  type="color"
                  value={el.style.color || '#263957'}
                  onChange={(e) =>
                    onPatch({ style: { ...el.style, color: e.target.value } })
                  }
                />
              </label>
            </>
          )}
          {el.type === 'photo' && (
            <>
              <Segments
                label="写真のフレーム"
                value={el.style.frame || 'none'}
                items={[
                  { value: 'none', label: 'そのまま' },
                  { value: 'polaroid', label: 'ポラロイド' },
                  { value: 'film', label: 'フィルム' },
                ]}
                onChange={(v) => onPatch({ style: { ...el.style, frame: v } })}
              />
              <Segments
                label="写真の収め方"
                value={el.style.fit || 'contain'}
                items={[
                  { value: 'contain', label: '写真全体' },
                  { value: 'cover', label: 'いっぱいに' },
                ]}
                onChange={(v) =>
                  onPatch({
                    style: { ...el.style, fit: v as 'cover' | 'contain' },
                  })
                }
              />
            </>
          )}
          {el.type === 'sticker' &&
            ['location', 'ticket', 'date', 'day', 'note'].includes(
              el.content,
            ) && (
              <label className="field-label">
                ラベルの文字
                <input
                  aria-label="ラベルの文字"
                  value={el.style.label || stickers[el.content]?.symbol || ''}
                  maxLength={40}
                  onChange={(e) =>
                    onPatch({ style: { ...el.style, label: e.target.value } })
                  }
                />
              </label>
            )}
          <p className="touch-tip">
            ページの上でドラッグして移動。
            <br />
            角を引くとサイズ、上の丸で回転。
          </p>
          <details className="fine-adjust">
            <summary>細かく調整</summary>
            <Range
              label="回転"
              min={-180}
              max={180}
              value={el.rotation}
              onChange={(v) => onPatch({ rotation: v })}
            />
            <Range
              label="サイズ"
              min={6}
              max={Math.max(6, 100 - el.x)}
              value={el.width}
              onChange={(v) =>
                onPatch({
                  width: v,
                  height: Math.min(100 - el.y, (el.height * v) / el.width),
                })
              }
            />
          </details>
          <div className="inspector-actions">
            <button onClick={() => onPatch({ zIndex: el.zIndex + 100 })}>
              <ArrowUp size={17} />
              前面へ
            </button>
            <button
              onClick={() => onPatch({ zIndex: Math.max(1, el.zIndex - 100) })}
            >
              <ArrowDown size={17} />
              背面へ
            </button>
            <button
              disabled={el.type === 'photo' && photoCount >= 5}
              onClick={onDuplicate}
            >
              <Copy size={17} />
              複製
            </button>
            <button onClick={onDelete}>
              <Trash2 size={17} />
              削除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
export function PaperPicker({
  value,
  onChange,
}: {
  value: Paper;
  onChange: (p: Paper) => void;
}) {
  return (
    <div>
      <RadioGroup
        className="paper-options"
        aria-label="紙の種類"
        value={value.type}
        onValueChange={(v) => onChange(paper(v as Paper['type']))}
      >
        {Object.entries(paperNames).map(([id, label]) => (
          <label key={id} className={value.type === id ? 'active' : ''}>
            <div className="paper-swatch">
              <PageCanvas
                thumb
                page={{
                  id: 'paper-' + id,
                  folioId: 'preview',
                  pageNumber: 0,
                  isCover: true,
                  background: paper(id as Paper['type']),
                  layoutSeed: 0,
                  elements: [],
                  doodles: [],
                  doodlesVisible: false,
                }}
              />
              <RadioGroupItem aria-label={label} value={id} />
            </div>
            <span>
              {label
                .replace('・写真向け', '')
                .replace('ドット方眼', 'ドット')
                .replace('ノート風薄罫線', 'ノート線')}
            </span>
          </label>
        ))}
      </RadioGroup>
      <details className="fine-adjust">
        <summary>紙色・線・質感を調整</summary>
        <label className="color-field">
          紙の色
          <input
            type="color"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
          />
        </label>
        <Segments
          label="線の種類"
          value={value.lines}
          items={[
            { value: 'none', label: '無地' },
            { value: 'ruled', label: '横罫' },
            { value: 'grid', label: '方眼' },
            { value: 'dot', label: 'ドット' },
          ]}
          onChange={(v) => onChange({ ...value, lines: v as Paper['lines'] })}
        />
        <Range
          label="線の濃さ"
          value={value.opacity * 100}
          onChange={(v) => onChange({ ...value, opacity: v / 100 })}
        />
        <Range
          label="紙の質感"
          value={value.texture * 100}
          onChange={(v) => onChange({ ...value, texture: v / 100 })}
        />
      </details>
    </div>
  );
}
export function PenPanel({
  draw,
  onDraw,
  onStart,
  page,
  onPage,
}: {
  draw: DrawSettings;
  onDraw: (d: DrawSettings) => void;
  onStart: () => void;
  page: Page;
  onPage: (p: Page) => void;
}) {
  return (
    <div className="pen-panel">
      <Segments
        label="ペンの種類"
        value={draw.tool}
        items={[
          { value: 'pen', label: 'ペン' },
          { value: 'marker', label: 'マーカー' },
          { value: 'eraser', label: '消しゴム' },
          { value: 'dotted', label: '点線' },
        ]}
        onChange={(v) => onDraw({ ...draw, tool: v as DrawSettings['tool'] })}
      />
      <div className="ink-colors">
        {[
          '#ffffff',
          '#2463eb',
          '#59b4d6',
          '#a6cd72',
          '#f5ca63',
          '#f272a1',
          '#323953',
        ].map((color) => (
          <button
            aria-label={`インク ${color}`}
            aria-pressed={draw.color === color}
            className={draw.color === color ? 'active' : ''}
            style={{ background: color }}
            key={color}
            onClick={() => onDraw({ ...draw, color })}
          />
        ))}
        <label className="custom-color">
          <input
            aria-label="自由なインクの色"
            type="color"
            value={draw.color}
            onChange={(e) => onDraw({ ...draw, color: e.target.value })}
          />
          <Plus size={15} />
        </label>
      </div>
      <Range
        label="太さ"
        min={1}
        max={30}
        value={draw.width}
        onChange={(v) => onDraw({ ...draw, width: v })}
      />
      <div className="switch-line">
        <span>落書きを表示</span>
        <Switch
          aria-label="落書きを表示"
          checked={page.doodlesVisible}
          onCheckedChange={(v) => onPage({ ...page, doodlesVisible: v })}
        />
      </div>
      <button className="primary full" onClick={onStart}>
        <PenLine size={18} />
        ページに描く
      </button>
    </div>
  );
}
export function ToolContent({
  tool,
  folio,
  page,
  photoCount,
  busy,
  onPhotos,
  onAdd,
  onPaper,
  onTheme,
  draw,
  onDraw,
  onDrawStart,
  onPage,
  onClose,
}: {
  tool: string;
  folio: Folio;
  page: Page;
  photoCount: number;
  busy: boolean;
  onPhotos: () => void;
  onAdd: (el: Element) => void;
  onPaper: (p: Paper) => void;
  onTheme: (t: ThemeId) => void;
  draw: DrawSettings;
  onDraw: (d: DrawSettings) => void;
  onDrawStart: () => void;
  onPage: (p: Page) => void;
  onClose: () => void;
}) {
  if (tool === 'photos')
    return (
      <div>
        <button
          className="sheet-upload"
          disabled={busy || photoCount >= 5}
          onClick={onPhotos}
        >
          <ImagePlus size={29} />
          <strong>{busy ? '写真を準備中…' : '写真を追加する'}</strong>
          <span>このページに {photoCount} / 5 枚</span>
        </button>
        <p className="help">
          写真を足すと、このページを自動でレイアウトします。
        </p>
      </div>
    );
  if (tool === 'text')
    return (
      <div className="text-styles">
        {[
          {
            name: 'ひとこと、添えて。',
            font: '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif',
            size: 35,
            weight: 400,
          },
          { name: 'DAY 01', font: 'Arial, sans-serif', size: 60, weight: 900 },
          {
            name: 'あの日のこと。',
            font: '"Yomogi", "Hiragino Kaku Gothic ProN", sans-serif',
            size: 25,
            weight: 400,
          },
        ].map((item) => (
          <button
            style={{ fontFamily: item.font, fontWeight: item.weight }}
            key={item.name}
            onClick={() =>
              onAdd({
                ...newElement('text', item.name),
                style: {
                  color: readableInk(
                    page.background.color,
                    themes[folio.theme].ink,
                  ),
                  fontSize: item.size,
                  fontFamily: item.font,
                  fontWeight: item.weight,
                },
              })
            }
          >
            {item.name}
            <Plus size={17} />
          </button>
        ))}
      </div>
    );
  if (tool === 'stickers')
    return (
      <div className="sticker-grid">
        {Object.entries(stickers).map(([id, s]) => (
          <button
            key={id}
            onClick={() => {
              onAdd({
                ...newElement('sticker', id),
                width: ['ticket', 'location', 'date', 'tape'].includes(id)
                  ? 31
                  : ['film', 'polaroid'].includes(id)
                    ? 55
                    : 22,
                height: ['film', 'polaroid'].includes(id)
                  ? 45
                  : ['ticket', 'location', 'date', 'tape'].includes(id)
                    ? 8
                    : 16,
                style: {
                  color: readableInk(
                    page.background.color,
                    themes[folio.theme].ink,
                  ),
                  fontSize: 32,
                },
              });
              onClose();
            }}
          >
            <span className={'sticker-icon-' + id}>
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
    );
  if (tool === 'paper')
    return <PaperPicker value={page.background} onChange={onPaper} />;
  if (tool === 'theme')
    return (
      <>
        <ThemePicker
          value={folio.theme}
          onChange={onTheme}
          page={page}
          compact
        />
        <p className="help">
          この冊子の雰囲気を変えて、表示中のページを再配置します。ほかのページの手動編集はそのままです。
        </p>
      </>
    );
  if (tool === 'draw')
    return (
      <PenPanel
        draw={draw}
        onDraw={onDraw}
        onStart={onDrawStart}
        page={page}
        onPage={onPage}
      />
    );
  return null;
}
export function BookSettings({
  folio,
  onChange,
}: {
  folio: Folio;
  onChange: (f: Folio) => void;
}) {
  function rename(title: string, subtitle = folio.subtitle) {
    const cover = folio.pages[0];
    const firstTitle = cover.elements.find(
      (e) => e.style.role === 'title' || e.type === 'text',
    );
    const existingSub = cover.elements.find(
      (e) =>
        e.style.role === 'subtitle' ||
        (e.type === 'text' && e.content === folio.subtitle),
    );
    let elements = cover.elements.map((e) =>
      e.id === firstTitle?.id
        ? {
            ...e,
            content: title,
            style: { ...e.style, role: 'title' as const },
          }
        : e.id === existingSub?.id
          ? { ...e, content: subtitle }
          : e,
    );
    if (!existingSub && subtitle)
      elements = [
        ...elements,
        {
          ...newElement('text', subtitle),
          x: 8,
          y: 91,
          width: 83,
          height: 6,
          style: {
            fontSize: 13,
            role: 'subtitle',
            color: readableInk(cover.background.color, themes[folio.theme].ink),
          },
        },
      ];
    onChange({
      ...folio,
      title,
      subtitle,
      pages: folio.pages.map((p) =>
        p.id === cover.id ? { ...p, elements } : p,
      ),
    });
  }
  return (
    <div className="book-settings">
      <RadioGroup
        className="binding-options"
        aria-label="冊子の形式"
        value={folio.bookType}
        onValueChange={(v) =>
          onChange({ ...folio, bookType: v as Folio['bookType'] })
        }
      >
        {[
          ['book', '本型', BookOpen],
          ['binder', 'バインダー', NotebookPen],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof BookOpen;
          return (
            <label
              key={id as string}
              className={folio.bookType === id ? 'active' : ''}
            >
              <I size={25} />
              <span>{label as string}</span>
              <RadioGroupItem
                value={id as string}
                aria-label={label as string}
              />
            </label>
          );
        })}
      </RadioGroup>
      <label className="field-label">
        タイトル
        <input
          value={folio.title}
          maxLength={80}
          onChange={(e) => rename(e.target.value)}
        />
      </label>
      <label className="field-label">
        サブタイトル
        <input
          value={folio.subtitle}
          maxLength={120}
          onChange={(e) => rename(folio.title, e.target.value)}
        />
      </label>
    </div>
  );
}

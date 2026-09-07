'use client';
import { useState } from 'react';
import { Plus, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  themes,
  paperNames,
  newFolio,
  type Folio,
  type Photo,
  type ThemeId,
  type PaperId,
  newElement,
} from '@/lib/folio/model';
import { importPhoto } from '@/lib/folio/storage';
import { generateLayout } from '@/lib/folio/layout';
import { Choice } from './controls';
export function CreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (f: Folio, p: Photo[]) => Promise<void>;
}) {
  const [title, setTitle] = useState(''),
    [subtitle, setSubtitle] = useState(''),
    [theme, setTheme] = useState<ThemeId>('scrap'),
    [paperType, setPaper] = useState<PaperId>('cream'),
    [type, setType] = useState<Folio['bookType']>('book'),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function create(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const f = newFolio(title.trim(), subtitle.trim(), type, theme, paperType);
      const ps: Photo[] = [];
      if (file) {
        const p = await importPhoto(file);
        ps.push(p);
        f.pages[0].elements.push({
          ...newElement('photo'),
          imageRef: p.id,
          aspect: p.width / p.height,
        });
        f.pages[0] = generateLayout(f.pages[0], theme, Date.now());
      }
      await onCreate(f, ps);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="create-dialog">
        <div className="eyebrow">LET’S MAKE A LITTLE BOOK</div>
        <DialogTitle className="dialog-title">
          新しい思い出を、一冊に。
        </DialogTitle>
        <DialogDescription>
          まずは雰囲気を選ぼう。表紙も中身も、あとから自由に。
        </DialogDescription>
        <form onSubmit={create}>
          <label className="field-label">
            タイトル <span>*</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="例：あの夏、海まで。"
            />
          </label>
          <label className="field-label">
            サブタイトル <small>任意</small>
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={120}
              placeholder="日付や、残しておきたいひとこと"
            />
          </label>
          <div className="form-row">
            <div className="field-label">
              冊子の形式
              <Choice
                label="冊子の形式"
                value={type}
                options={[
                  { value: 'book', label: '本型' },
                  { value: 'binder', label: 'バインダー型' },
                ]}
                onChange={(v) => setType(v as Folio['bookType'])}
              />
            </div>
            <div className="field-label">
              紙の種類
              <Choice
                label="紙の種類"
                value={paperType}
                options={Object.entries(paperNames).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(v) => setPaper(v as PaperId)}
              />
            </div>
          </div>
          <div className="field-label">
            テーマ
            <Choice
              label="テーマ"
              value={theme}
              options={Object.entries(themes).map(([value, t]) => ({
                value,
                label: t.name,
              }))}
              onChange={(v) => {
                setTheme(v as ThemeId);
                setPaper(themes[v as ThemeId].paper);
              }}
            />
          </div>
          <div
            className="theme-preview"
            style={{
              background: themes[theme].color,
              color: themes[theme].ink,
            }}
          >
            <span style={{ fontFamily: themes[theme].font }}>
              {themes[theme].en}
            </span>
            <small>{themes[theme].name} · おすすめの紙を設定しました</small>
          </div>
          <label className="cover-upload">
            <ImagePlus size={21} />
            <span>
              {file ? file.name : '表紙の写真を選ぶ'}
              <small>任意 · あとから追加できます</small>
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button
            className="primary full"
            disabled={busy || !title.trim()}
            type="submit"
          >
            <Plus size={19} />
            {busy ? '一冊を準備しています…' : 'Folioをつくる'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

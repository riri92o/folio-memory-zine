'use client';
import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Plus,
  X,
  Shuffle,
  Pencil,
  Check,
  LoaderCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  newFolio,
  newElement,
  themes,
  normalize,
  type Folio,
  type Photo,
  type ThemeId,
} from '@/lib/folio/model';
import { importPhoto } from '@/lib/folio/storage';
import { generateLayout } from '@/lib/folio/layout';
import { PageCanvas, LocalImage } from './PageCanvas';
import { ThemePicker } from './ThemePicker';
export function CreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (f: Folio, p: Photo[]) => Promise<void>;
}) {
  const [step, setStep] = useState(0),
    [photos, setPhotos] = useState<Photo[]>([]),
    [theme, setTheme] = useState<ThemeId>('scrap'),
    [draft, setDraft] = useState<Folio>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > 5) {
      setError('最初のページに使う写真を、1〜5枚選んでください。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const selected: Photo[] = [];
      for (const file of Array.from(files))
        selected.push(await importPhoto(file));
      setPhotos((p) => [...p, ...selected]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  function compose(t = theme, existing = draft) {
    const seed = Date.now();
    const f =
      (existing ? structuredClone(existing) : undefined) ||
      newFolio(
        'My little moments',
        new Date(seed).toLocaleDateString('en-CA').replaceAll('-', '.'),
        'book',
        t,
        themes[t].paper,
      );
    if (!existing) {
      f.pages[0].elements = f.pages[0].elements.map((e) =>
        e.style.role === 'title' ? { ...e, content: 'LITTLE\nMOMENTS' } : e,
      );
      f.pages[0].elements.push({
        ...newElement('photo'),
        imageRef: photos[0].id,
        aspect: photos[0].width / photos[0].height,
      });
      f.pages[1].elements = photos.map((p) => ({
        ...newElement('photo'),
        imageRef: p.id,
        aspect: p.width / p.height,
      }));
    }
    const next = normalize({
      ...f,
      theme: t,
      paperType: themes[t].paper,
      pages: f.pages.map((p, i) =>
        generateLayout(p, t, seed + i * 91, { varyPaper: true }),
      ),
    });
    setDraft(next);
    return next;
  }
  async function finish() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(draft, photos);
      onClose();
    } catch {
      setError(
        '保存できませんでした。端末の空き容量を確認して、もう一度お試しください。',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="creation-flow" showCloseButton={false}>
        <header className="flow-header">
          <button
            className="icon-button"
            aria-label={step === 0 ? '作成を閉じる' : '前のステップ'}
            disabled={busy}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step === 0 ? <X size={21} /> : <ArrowLeft size={21} />}
          </button>
          <span className="wordmark">Folio</span>
          <span className="step-count">
            0{step + 1} <i>/</i> 03
          </span>
        </header>
        <div className="flow-progress">
          {['写真を選ぶ', '雰囲気を選ぶ', 'ページができる'].map((label, i) => (
            <span
              key={label}
              className={i === step ? 'active' : i < step ? 'done' : ''}
            >
              {i < step ? <Check size={13} /> : <b>0{i + 1}</b>}
              <span>{label}</span>
            </span>
          ))}
        </div>
        <div className={`flow-body step-${step}`}>
          <div className="flow-heading">
            <DialogTitle>
              {step === 0
                ? '写真を選ぶ'
                : step === 1
                  ? '雰囲気を選ぶ'
                  : 'ページができました'}
            </DialogTitle>
            <DialogDescription>
              {step === 0
                ? 'お気に入りの写真を1〜5枚選んでください。'
                : step === 1
                  ? '写真に合うデザインを、プレビューから選べます。'
                  : '別の配置を試すか、そのまま自由に編集できます。'}
            </DialogDescription>
          </div>
          {step === 0 && (
            <div className="photo-step">
              <input
                ref={input}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => pick(e.target.files)}
              />
              {photos.length ? (
                <div className="chosen-photos">
                  {photos.map((p, i) => (
                    <div className="chosen-photo" key={p.id}>
                      <LocalImage src={p.id} thumb />
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <button
                        aria-label={`写真${i + 1}を外す`}
                        className="remove-photo"
                        onClick={() =>
                          setPhotos((ps) => ps.filter((x) => x.id !== p.id))
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {photos.length < 5 && (
                    <button
                      className="add-photo-tile"
                      disabled={busy}
                      onClick={() => input.current?.click()}
                    >
                      <Plus size={28} />
                      <span>追加する</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  className="photo-invitation"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                >
                  <div className="invitation-icon">
                    <ImagePlus size={36} />
                    <span>✦</span>
                  </div>
                  <strong>写真を選ぶ</strong>
                  <span>カメラロールから、好きな瞬間を。</span>
                  <small>1〜5枚 · 写真は端末の中に保存</small>
                </button>
              )}
              <p className="handwritten flow-handnote">
                好きな写真から、はじめよう。
              </p>
            </div>
          )}
          {step === 1 && draft && (
            <div className="theme-step">
              <div className="theme-main-preview">
                <PageCanvas page={draft.pages[1]} />
                <span className="paper-caption">
                  YOUR PHOTOS, {themes[theme].en} MOOD.
                </span>
              </div>
              <ThemePicker
                value={theme}
                onChange={(t) => {
                  setTheme(t);
                  compose(t);
                }}
                page={draft.pages[1]}
              />
            </div>
          )}
          {step === 2 && draft && (
            <div className="generated-result">
              <div className="result-paper" key={draft.pages[1].layoutSeed}>
                <PageCanvas page={draft.pages[1]} />
              </div>
              <span className="result-note">
                ✦　{photos.length}枚の写真が、ひとつのページに。
              </span>
            </div>
          )}
        </div>
        {error && (
          <p className="flow-error" role="alert">
            {error}
          </p>
        )}
        <footer className="flow-actions">
          {step === 0 ? (
            <>
              <span>
                {busy ? '写真を準備中…' : `${photos.length}枚 選択中`}
              </span>
              <button
                className="primary"
                disabled={!photos.length || busy}
                onClick={() => {
                  compose();
                  setStep(1);
                }}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    次へ
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </>
          ) : step === 1 ? (
            <button className="primary" onClick={() => setStep(2)}>
              この雰囲気でつくる
              <ArrowRight size={18} />
            </button>
          ) : (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => compose()}
              >
                <Shuffle size={18} />
                別のデザイン
              </button>
              <button className="primary" disabled={busy} onClick={finish}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Pencil size={18} />
                )}
                自分でアレンジ
              </button>
            </>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

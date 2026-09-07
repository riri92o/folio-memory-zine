'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  BookOpen,
  ArrowUpRight,
  Pencil,
  Trash2,
  ArrowLeft,
  LoaderCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  type Folio,
  type Photo,
  normalize,
  uid,
  themes,
} from '@/lib/folio/model';
import {
  loadFolios,
  saveFolio,
  deleteFolio,
  importPhoto,
  releaseImages,
} from '@/lib/folio/storage';
import { samples } from '@/lib/folio/samples';
import { PageCanvas } from '@/components/folio/PageCanvas';
import { CreateDialog } from '@/components/folio/CreateDialog';
import { Editor } from '@/components/folio/Editor';
import { Reader } from '@/components/folio/Reader';
import { Confirm } from '@/components/folio/controls';
export default function Home() {
  const [books, setBooks] = useState<Folio[]>([]),
    [examples, setExamples] = useState<Folio[]>([]),
    [active, setActive] = useState<Folio>(),
    [view, setView] = useState<'home' | 'edit' | 'read'>('home'),
    [create, setCreate] = useState(false),
    [remove, setRemove] = useState<Folio>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(0),
    [saveFailed, setSaveFailed] = useState(false),
    [sampleBusy, setSampleBusy] = useState(false);
  const pendingPhotos = useRef(new Map<string, Photo>());
  const queue = useRef(Promise.resolve()),
    latest = useRef<Folio | undefined>(undefined);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    loadFolios()
      .then(setBooks)
      .catch(() =>
        setError(
          '保存データを開けませんでした。ブラウザの保存設定を確認して、再読み込みしてください。',
        ),
      )
      .finally(() => {
        setExamples(samples());
        setReady(true);
      });
    return releaseImages;
  }, []);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (saving || saveFailed) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [saving, saveFailed]);
  function change(f: Folio, photos: Photo[] = []) {
    f = normalize(f);
    photos.forEach((p) => pendingPhotos.current.set(p.id, p));
    const photoBatch = Array.from(pendingPhotos.current.values());
    latest.current = f;
    setActive(f);
    setBooks((bs) => [f, ...bs.filter((b) => b.id !== f.id)]);
    setSaving((v) => v + 1);
    const next = queue.current.then(() => saveFolio(f, photoBatch));
    queue.current = next.catch(() => {});
    return next
      .then(() => {
        photoBatch.forEach((p) => pendingPhotos.current.delete(p.id));
        setSaveFailed(false);
        setError((message) =>
          message.startsWith('保存できませんでした') ? '' : message,
        );
      })
      .catch(() => {
        setSaveFailed(true);
        setError(
          '保存できませんでした。端末の空き容量とブラウザの保存設定を確認し、再保存してください。',
        );
      })
      .finally(() => setSaving((v) => v - 1));
  }
  async function createBook(f: Folio, p: Photo[]) {
    await saveFolio(f, p);
    setBooks((bs) => [f, ...bs]);
    setActive(f);
    latest.current = f;
    setView('edit');
  }
  async function edit(f: Folio) {
    if (!f.sample) {
      setActive(f);
      latest.current = f;
      setView('edit');
      return;
    }
    setSampleBusy(true);
    try {
      const copy = structuredClone(f);
      copy.id = uid();
      copy.sample = false;
      copy.title = f.title + '（コピー）';
      const ps: Photo[] = [];
      const map = new Map<string, string>();
      for (const p of copy.pages) {
        p.id = uid();
        p.folioId = copy.id;
        for (const e of p.elements) {
          e.id = uid();
          if (e.imageRef) {
            if (!map.has(e.imageRef)) {
              const response = await fetch(e.imageRef);
              if (!response.ok) throw new Error();
              const photo = await importPhoto(await response.blob());
              ps.push(photo);
              map.set(e.imageRef, photo.id);
            }
            e.imageRef = map.get(e.imageRef);
          }
        }
      }
      copy.coverPageId = copy.pages[0].id;
      const copied = normalize(copy);
      copied.createdAt = copied.updatedAt;
      await createBook(copied, ps);
    } catch {
      setError('サンプルをコピーできませんでした。もう一度お試しください。');
    } finally {
      setSampleBusy(false);
    }
  }
  function read(f: Folio) {
    setActive(f);
    setView('read');
  }
  return (
    <div className="app">
      <header className="header">
        <button
          className="brand brand-button"
          aria-label="Folio 本棚に戻る"
          onClick={() => setView('home')}
        >
          Folio<span>®</span>
        </button>
        {view === 'home' ? (
          <span className="header-note">LITTLE MOMENTS, BOUND TOGETHER.</span>
        ) : (
          <div className="header-book">
            <button
              className="icon-button"
              onClick={() => setView('home')}
              aria-label="本棚へ戻る"
            >
              <ArrowLeft size={19} />
            </button>
            <span>{active?.title}</span>
          </div>
        )}
        <span className="local-badge">
          {saving ? (
            <LoaderCircle size={14} className="spin" />
          ) : saveFailed ? (
            <span>!</span>
          ) : (
            <i />
          )}
          {saving
            ? '保存中…'
            : saveFailed
              ? '未保存の変更あり'
              : view === 'edit'
                ? '保存しました'
                : 'このデバイスに保存'}
        </span>
        {view === 'edit' && (
          <button
            className="header-preview secondary"
            onClick={() => setView('read')}
          >
            <BookOpen size={17} />
            閲覧
          </button>
        )}
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {saveFailed && (
            <button
              onClick={() => {
                if (latest.current) void change(latest.current);
              }}
            >
              再保存
            </button>
          )}
          <button
            className="icon-button"
            aria-label="通知を閉じる"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {view === 'home' ? (
        <>
          <main className="home">
            <div className="home-heading">
              <div>
                <div className="eyebrow">YOUR PERSONAL BOOKSHELF</div>
                <h1>
                  思い出を、<span>一冊に。</span>
                </h1>
                <p>何気ない日も、忘れたくない日も。あなたらしく残そう。</p>
              </div>
              <button
                className="primary"
                disabled={!ready}
                onClick={() => setCreate(true)}
              >
                <Plus size={20} />
                新しいFolioをつくる
              </button>
            </div>
            <div className="section-line">
              <h2>
                <BookOpen size={20} />
                マイ Folio <span>{String(books.length).padStart(2, '0')}</span>
              </h2>
              <span>
                {books.length ? '更新した順に表示' : 'あなたの小さな本棚'}
              </span>
            </div>
            {!ready ? (
              <p className="loading-message">本棚を開いています…</p>
            ) : (
              <>
                <div className="book-grid">
                  {books.map((f, i) => (
                    <BookCard
                      key={f.id}
                      folio={f}
                      index={i}
                      onRead={() => read(f)}
                      onEdit={() => edit(f)}
                      onDelete={() => setRemove(f)}
                    />
                  ))}
                  {!books.length &&
                    examples.map((f, i) => (
                      <BookCard
                        key={f.id}
                        folio={f}
                        index={i}
                        onRead={() => read(f)}
                        onEdit={() => edit(f)}
                      />
                    ))}
                  <button className="new-card" onClick={() => setCreate(true)}>
                    <div className="new-sheet">
                      <Plus size={34} />
                      <span>次の思い出は、ここから。</span>
                    </div>
                    <strong>
                      新しいFolioをつくる
                      <ArrowUpRight size={18} />
                    </strong>
                    <small>写真を選んで、あなただけの一冊に</small>
                  </button>
                </div>
                {!books.length && (
                  <p className="sample-note">
                    はじめての一冊のヒントに。サンプルは開いて、自由に編集できます。
                  </p>
                )}
                <div className="home-note">
                  <div>
                    <span className="note-number">01 — 02 — 03</span>
                    <h3>選ぶ。まかせる。自分らしく。</h3>
                    <p>
                      写真を選んで、いい感じに自動レイアウト。
                      <br />
                      文字や落書きを重ねたら、世界にひとつのFolioに。
                    </p>
                  </div>
                  <div className="privacy-note">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>大切な思い出は、あなたの手元に。</strong>
                      <p>
                        写真はサーバーに送信されません。
                        <br />
                        このブラウザ・このデバイスに保存されます。
                      </p>
                      <small>
                        ブラウザのデータを消すと、Folioも削除されます。
                      </small>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
          <footer>
            <span className="brand">
              Folio<span>®</span>
            </span>
            <span>Made of moments. Made by you.</span>
            <span>写真も思い出も、このデバイスの中に。</span>
          </footer>
        </>
      ) : active && view === 'edit' ? (
        <Editor
          key={active.id}
          folio={active}
          onChange={change}
          onView={() => setView('read')}
          onError={setError}
        />
      ) : active ? (
        <Reader key={active.id} folio={active} onEdit={() => edit(active)} />
      ) : null}
      {create && (
        <CreateDialog onClose={() => setCreate(false)} onCreate={createBook} />
      )}{' '}
      {sampleBusy && (
        <output className="busy-overlay">
          <LoaderCircle className="spin" />
          サンプルを本棚にコピーしています…
        </output>
      )}
      {remove && (
        <Confirm
          title={`「${remove.title}」を削除しますか？`}
          description="この冊子の全ページと保存した写真を削除します。この操作は元に戻せません。"
          onClose={() => setRemove(undefined)}
          onConfirm={() => {
            void queue.current
              .then(() => deleteFolio(remove))
              .then(() =>
                setBooks((bs) => bs.filter((b) => b.id !== remove.id)),
              )
              .catch(() =>
                setError('削除できませんでした。もう一度お試しください。'),
              );
          }}
        />
      )}
    </div>
  );
}
function BookCard({
  folio: f,
  index,
  onRead,
  onEdit,
  onDelete,
}: {
  folio: Folio;
  index: number;
  onRead: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="book-card">
      <button
        className={`cover-stage cover-stage-${index % 3}`}
        aria-label={`${f.title}を開く`}
        onClick={onRead}
      >
        <div className={`cover-book cover-book-${index % 3} ${f.bookType}`}>
          <PageCanvas page={f.pages[0]} thumb />
          {f.bookType === 'binder' && (
            <div className="cover-rings">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <span className="cover-badge">
          {f.sample ? 'SAMPLE' : themes[f.theme].en}
        </span>
        <span className="open-book">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <div className="book-info">
        <button className="book-title" onClick={onRead}>
          {f.title}
        </button>
        <div className="card-actions">
          <button aria-label={`${f.title}を編集`} onClick={onEdit}>
            <Pencil size={15} />
          </button>
          {onDelete && (
            <button aria-label={`${f.title}を削除`} onClick={onDelete}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="book-meta">
        <span>
          {f.sample
            ? themes[f.theme].name
            : new Date(f.updatedAt).toLocaleDateString('ja-JP')}
        </span>
        <i />
        <span>{f.pageCount} ページ</span>
      </div>
    </article>
  );
}

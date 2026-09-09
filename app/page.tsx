'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  ArrowLeft,
  LoaderCircle,
  X,
  House,
  Settings,
  HardDrive,
} from 'lucide-react';
import { type Folio, type Photo, normalize, uid } from '@/lib/folio/model';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
export default function Home() {
  const [books, setBooks] = useState<Folio[]>([]),
    [examples, setExamples] = useState<Folio[]>([]),
    [active, setActive] = useState<Folio>(),
    [view, setView] = useState<'home' | 'edit' | 'read'>('home'),
    [create, setCreate] = useState(false),
    [settings, setSettings] = useState(false),
    [editIndex, setEditIndex] = useState(0),
    [remove, setRemove] = useState<Folio>(),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(0),
    [saveFailed, setSaveFailed] = useState(false),
    [sampleBusy, setSampleBusy] = useState(false);
  const pendingPhotos = useRef(new Map<string, Photo>()),
    queue = useRef(Promise.resolve()),
    latest = useRef<Folio | undefined>(undefined);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => {});
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
      if (saving || saveFailed) e.preventDefault();
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
    setEditIndex(Math.min(1, f.pages.length - 1));
    setView('edit');
  }
  async function edit(f: Folio) {
    if (!f.sample) {
      setActive(f);
      latest.current = f;
      setEditIndex(0);
      setView('edit');
      return;
    }
    setSampleBusy(true);
    try {
      const copy = structuredClone(f);
      copy.id = uid();
      copy.sample = false;
      copy.title = f.title + '（コピー）';
      const ps: Photo[] = [],
        map = new Map<string, string>();
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
    <div className={`app view-${view}`}>
      <header className="app-header">
        {view === 'home' ? (
          <div className="home-brand">
            <span className="wordmark">Folio</span>
            <p>思い出を、自分だけの一冊に。</p>
          </div>
        ) : (
          <button
            className="icon-button"
            aria-label="本棚へ戻る"
            onClick={() => setView('home')}
          >
            <ArrowLeft size={22} />
          </button>
        )}
        {view !== 'home' && (
          <div className="document-heading">
            <span className="wordmark">Folio</span>
            <span>{active?.title}</span>
          </div>
        )}
        <div className="header-actions">
          <span className={`save-indicator ${saveFailed ? 'failed' : ''}`}>
            {saving ? <LoaderCircle size={15} className="spin" /> : <i />}
            <span>
              {saving ? '保存中' : saveFailed ? '未保存' : 'このデバイスに保存'}
            </span>
          </span>
          {view !== 'home' &&
            (view === 'edit' ? (
              <button
                className="icon-button view-book"
                aria-label="閲覧モードにする"
                onClick={() => setView('read')}
              >
                <BookOpen size={21} />
              </button>
            ) : (
              <button
                className="icon-button"
                aria-label="このFolioを編集"
                onClick={() => active && edit(active)}
              >
                <Pencil size={20} />
              </button>
            ))}
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {saveFailed && (
            <button
              onClick={() => latest.current && void change(latest.current)}
            >
              再保存
            </button>
          )}
          <button
            className="icon-button"
            aria-label="通知を閉じる"
            onClick={() => setError('')}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {view === 'home' ? (
        <main className="bookshelf">
          <div className="shelf-heading">
            <div>
              <h1>
                My Folios<span>{String(books.length).padStart(2, '0')}</span>
              </h1>
              <p>
                {books.length
                  ? 'ふと開きたくなる、あなたの本棚。'
                  : 'まだ名前のない思い出も、一冊になる。'}
              </p>
            </div>
            <span className="handwritten shelf-note">
              思い出を一冊ずつ <span>↙</span>
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
                <button className="new-book" onClick={() => setCreate(true)}>
                  <div>
                    <span className="new-book-plus">
                      <Plus size={27} />
                    </span>
                    <strong>New Folio</strong>
                    <span>次の思い出を、ここに。</span>
                    <i>✦</i>
                  </div>
                  <span>写真を選んで、はじめよう</span>
                </button>
              </div>
              <section className="sample-shelf">
                <div className="sample-shelf-heading">
                  <div>
                    <h2>Sample Folios</h2>
                    <p>開いて、めくって、好きな一冊をコピーできます。</p>
                  </div>
                  <span>{String(examples.length).padStart(2, '0')}</span>
                </div>
                <div className="book-grid sample-grid">
                  {examples.map((f, i) => (
                    <BookCard
                      key={f.id}
                      folio={f}
                      index={i}
                      onRead={() => read(f)}
                      onEdit={() => edit(f)}
                    />
                  ))}
                </div>
              </section>
              <div className="shelf-footer">
                <p>
                  写真も思い出も、このデバイスの中に。
                  <br />
                  <small>
                    ブラウザのデータを消すと、保存したFolioも削除されます。
                  </small>
                </p>
              </div>
            </>
          )}
        </main>
      ) : active && view === 'edit' ? (
        <Editor
          key={active.id}
          folio={active}
          initialIndex={editIndex}
          onChange={change}
          onView={() => setView('read')}
          onError={setError}
        />
      ) : active ? (
        <Reader key={active.id} folio={active} onEdit={() => edit(active)} />
      ) : null}
      {view === 'home' && (
        <nav className="app-bottom-nav" aria-label="メインナビゲーション">
          <button
            className="active"
            aria-current="page"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <House size={21} />
            <span>ホーム</span>
          </button>
          <button
            className="nav-create"
            aria-label="新しいFolioを作る"
            disabled={!ready}
            onClick={() => setCreate(true)}
          >
            <Plus size={28} />
          </button>
          <button onClick={() => setSettings(true)}>
            <Settings size={21} />
            <span>設定</span>
          </button>
        </nav>
      )}
      {create && (
        <CreateDialog onClose={() => setCreate(false)} onCreate={createBook} />
      )}{' '}
      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent side="bottom" className="settings-sheet">
          <SheetTitle>設定</SheetTitle>
          <SheetDescription>
            Folioのデータは、この端末のブラウザに保存されます。
          </SheetDescription>
          <div className="settings-storage">
            <span>
              <HardDrive size={21} />
            </span>
            <div>
              <strong>ローカル保存</strong>
              <p>写真や冊子データは外部へ送信されません。</p>
            </div>
          </div>
          <p className="settings-note">
            ブラウザのデータを消すと、保存したFolioも削除されます。
          </p>
        </SheetContent>
      </Sheet>
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
        className="book-cover-button"
        onClick={onRead}
        aria-label={`${f.title}を開く`}
      >
        <div className={`shelf-book book-angle-${index % 3} ${f.bookType}`}>
          <PageCanvas page={f.pages[0]} thumb />
          {f.bookType === 'binder' && (
            <div className="cover-rings">
              <i />
              <i />
              <i />
            </div>
          )}
          <span className="book-thickness" />
        </div>
      </button>
      <div className="book-details">
        <div>
          <button className="book-title" onClick={onRead}>
            {f.title}
          </button>
          <p>
            {f.sample
              ? 'SAMPLE'
              : new Date(f.updatedAt).toLocaleDateString('ja-JP')}
            <span>·</span>
            {f.pageCount} pages
          </p>
        </div>
        <div className="book-actions">
          <button aria-label={`${f.title}を編集`} onClick={onEdit}>
            <Pencil size={16} />
          </button>
          {onDelete && (
            <button aria-label={`${f.title}を削除`} onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

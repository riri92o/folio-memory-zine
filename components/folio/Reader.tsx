'use client';
import { useEffect, useRef, useState } from 'react';
import { type Folio } from '@/lib/folio/model';
import { PageCanvas } from './PageCanvas';
import { capturePages, type BookElement } from '@/lib/folio/book/content';

export function Reader({ folio }: { folio: Folio; onEdit?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('冊子を準備しています…');
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const pages = folio.pageOrder
    .map((id) => folio.pages.find((p) => p.id === id))
    .filter((p) => !!p);
  const cover =
    folio.pages.find((p) => p.id === folio.coverPageId) || folio.pages[0];
  const ordered = [cover, ...pages.filter((p) => p.id !== cover.id)];

  useEffect(() => {
    const controller = new AbortController();
    let book: BookElement | undefined;
    setFailed(false);
    setStatus('冊子を準備しています…');
    async function prepare() {
      await import('@/lib/folio/book/folio-book.js');
      if (controller.signal.aborted || !source.current) return;
      const textures = await capturePages(source.current, controller.signal);
      if (controller.signal.aborted || !host.current) return;
      book = document.createElement('folio-book') as BookElement;
      book.setContent({
        cover: textures[0],
        title: folio.title,
        bookType: folio.bookType,
        pages: textures.slice(1).map((texture, i) => ({
          texture,
          title: `${i + 1}ページ`,
          body: ordered[i + 1].elements
            .filter((e) => e.type === 'text')
            .map((e) => e.content)
            .join('\n'),
        })),
      });
      host.current.replaceChildren(book);
      setStatus('');
    }
    prepare().catch(() => {
      if (!controller.signal.aborted) {
        setFailed(true);
        setStatus('紙面を読み込めませんでした。もう一度お試しください。');
      }
    });
    return () => {
      controller.abort();
      book?.remove();
    };
    // A new Folio revision must create a new, closed book with fresh textures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folio, attempt]);

  return (
    <main className="reader folio-canvas-reader">
      <div className="reading-title">
        <span>{folio.title}</span>
        {folio.sample && <small>サンプル</small>}
      </div>
      <div className="folio-book-host" ref={host} />
      {status && (
        <div className="folio-reader-status" role="status">
          {status}
          {failed && (
            <button onClick={() => setAttempt((n) => n + 1)}>再試行</button>
          )}
        </div>
      )}
      {status && (
        <div className="folio-texture-source" ref={source} aria-hidden="true">
          {ordered.map((page) => (
            <div key={page.id}>
              <PageCanvas page={page} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

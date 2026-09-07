import type { Folio, Photo } from './model';

let connection: Promise<IDBDatabase> | undefined;
const urls = new Map<string, string>();

function db() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('folio-local', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('folios', { keyPath: 'id' });
      database.createObjectStore('pages', { keyPath: 'id' });
      database.createObjectStore('photos', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error('別のタブを閉じて再読み込みしてください。'));
    };
  }));
}

function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('保存が中断されました'));
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadFolios(): Promise<Folio[]> {
  const database = await db();
  const transaction = database.transaction(['folios', 'pages'], 'readonly');
  const [folios, pages] = await Promise.all([
    result(transaction.objectStore('folios').getAll()),
    result(transaction.objectStore('pages').getAll()),
  ]);
  return folios
    .map((folio) => ({
      ...folio,
      pages: folio.pageOrder
        .map((id: string) => pages.find((page) => page.id === id))
        .filter(Boolean),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Metadata, pages and new image Blobs commit together. Failed writes must never
// leave a book pointing at images that were not saved.
export async function saveFolio(folio: Folio, photos: Photo[] = []) {
  const database = await db();
  const transaction = database.transaction(
    ['folios', 'pages', 'photos'],
    'readwrite',
  );
  const finished = done(transaction);
  try {
    const { pages, sample: _sample, ...metadata } = folio;
    transaction.objectStore('folios').put(metadata);
    pages.forEach((page) => transaction.objectStore('pages').put(page));
    photos.forEach((photo) => transaction.objectStore('photos').put(photo));
    const request = transaction.objectStore('pages').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (
        cursor.value.folioId === folio.id &&
        !folio.pageOrder.includes(cursor.value.id)
      )
        cursor.delete();
      cursor.continue();
    };
  } catch (error) {
    transaction.abort();
    await finished.catch(() => {});
    throw error;
  }
  await finished;
}

export async function deleteFolio(folio: Folio) {
  const database = await db();
  const transaction = database.transaction(
    ['folios', 'pages', 'photos'],
    'readwrite',
  );
  const finished = done(transaction);
  transaction.objectStore('folios').delete(folio.id);
  folio.pages.forEach((page) =>
    transaction.objectStore('pages').delete(page.id),
  );
  const request = transaction.objectStore('pages').getAll();
  request.onsuccess = () => {
    const referenced = new Set<string>();
    for (const page of request.result)
      for (const element of page.elements) {
        if (element.imageRef) referenced.add(element.imageRef);
      }
    const images = transaction.objectStore('photos').openCursor();
    images.onsuccess = () => {
      const cursor = images.result;
      if (!cursor) return;
      if (!referenced.has(cursor.value.id)) cursor.delete();
      cursor.continue();
    };
  };
  await finished;
}

export async function imageUrl(id: string, thumbnail = false) {
  if (id.startsWith('/samples/')) return id;
  const key = id + (thumbnail ? ':thumb' : '');
  if (urls.has(key)) return urls.get(key)!;
  const database = await db();
  const photo = await result<Photo | undefined>(
    database.transaction('photos').objectStore('photos').get(id),
  );
  if (!photo) return '';
  const url = URL.createObjectURL(thumbnail ? photo.thumbnail : photo.blob);
  urls.set(key, url);
  return url;
}

export function releaseImages() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
}

export async function importPhoto(file: Blob): Promise<Photo> {
  if (file.size > 35 * 1024 * 1024)
    throw new Error('写真は1枚35MB以下で選んでください。');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error(
            'この写真を開けません。JPEG・PNG・WebPに変換して再度お試しください。',
          ),
        );
      image.src = url;
    });
    async function resize(max: number) {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error('画像の変換に失敗しました')),
          'image/jpeg',
          0.9,
        ),
      );
    }
    const photo = {
      id: crypto.randomUUID(),
      blob: await resize(2200),
      thumbnail: await resize(420),
      width: image.width,
      height: image.height,
    };
    urls.set(photo.id, URL.createObjectURL(photo.blob));
    urls.set(photo.id + ':thumb', URL.createObjectURL(photo.thumbnail));
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

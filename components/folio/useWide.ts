'use client';
import { useSyncExternalStore } from 'react';
const query =
  '(min-width: 900px), (min-width: 640px) and (orientation: landscape)';
function subscribe(callback: () => void) {
  const media = matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function snapshot() {
  return matchMedia(query).matches;
}
export function useWide() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

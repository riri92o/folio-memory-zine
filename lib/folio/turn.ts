/** Connected cylindrical strips in page-relative coordinates. */
export function turnGeometry(
  progress: number,
  direction: number,
  width: number,
  count = 7,
) {
  const result = [];
  let x = direction > 0 ? 0 : 1,
    z = 0;
  for (let i = 0; i < count; i++) {
    const index = direction > 0 ? i : count - 1 - i,
      edge = i / (count - 1),
      local = Math.max(0, Math.min(1, (progress - (1 - edge) * 0.22) / 0.78)),
      eased = local * local * (3 - 2 * local),
      curl = Math.sin(local * Math.PI) * (0.08 + edge * 0.2),
      angle = direction * (-Math.PI * eased - curl);
    result.push({
      index,
      angle,
      left: direction > 0 ? x : x - 1 / count,
      z,
      origin: direction > 0 ? 'left center' : 'right center',
    });
    x += (direction * Math.cos(angle)) / count;
    z += (-direction * Math.sin(angle) * width) / count;
  }
  return result;
}

/**
 * A previous page is a leaf returning from the left, rather than the current
 * leaf being turned forwards again. Its resting geometry therefore runs from
 * fully folded (outside the page) back to flat.
 */
export function turnMotion(progress: number, direction: number) {
  return direction < 0
    ? { geometryProgress: 1 - progress, geometryDirection: 1 }
    : { geometryProgress: progress, geometryDirection: 1 };
}

/** Cover is a single leaf; every interior position advances as a spread. */
export function readerDestination(
  index: number,
  direction: number,
  pageCount: number,
) {
  if (direction > 0) {
    const next = index === 0 ? 1 : index + 2;
    return next < pageCount ? next : null;
  }
  if (index === 0) return null;
  return index <= 1 ? 0 : Math.max(1, index - 2);
}

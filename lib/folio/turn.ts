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
  const bend = Math.sin(progress * Math.PI) * 0.7;
  for (let i = 0; i < count; i++) {
    const index = direction > 0 ? i : count - 1 - i,
      angle = direction * (-Math.PI * progress + bend * (i / (count - 1)));
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

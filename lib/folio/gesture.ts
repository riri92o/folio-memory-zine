export type Point = { x: number; y: number };

export type ElementGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angle(a: Point, b: Point) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function angleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resizeFromCorner(
  element: ElementGeometry,
  dx: number,
  dy: number,
  minWidth = 6,
  minHeight = 4,
): ElementGeometry {
  const widthScale = 1 + dx / Math.max(element.width, 1);
  const heightScale = 1 + dy / Math.max(element.height, 1);
  const scale = clamp(
    Math.abs(widthScale - 1) > Math.abs(heightScale - 1)
      ? widthScale
      : heightScale,
    0.2,
    4,
  );
  const maxScale = Math.min(
    (100 - element.x) / Math.max(element.width, 1),
    (100 - element.y) / Math.max(element.height, 1),
  );
  const fitted = Math.min(scale, maxScale);
  const width = Math.max(minWidth, element.width * fitted);
  const height = Math.max(minHeight, element.height * fitted);
  return {
    ...element,
    width: Math.min(100 - element.x, width),
    height: Math.min(100 - element.y, height),
  };
}

export function transformFromPinch(
  element: ElementGeometry,
  startA: Point,
  startB: Point,
  currentA: Point,
  currentB: Point,
  pageWidth: number,
  pageHeight: number,
): ElementGeometry {
  const startDistance = Math.max(distance(startA, startB), 1);
  const requestedScale = distance(currentA, currentB) / startDistance;
  const scale = clamp(
    requestedScale,
    Math.max(6 / Math.max(element.width, 1), 4 / Math.max(element.height, 1)),
    Math.min(96 / Math.max(element.width, 1), 96 / Math.max(element.height, 1)),
  );
  const startCenter = midpoint(startA, startB);
  const center = midpoint(currentA, currentB);
  const width = element.width * scale;
  const height = element.height * scale;
  const originalCenterX = element.x + element.width / 2;
  const originalCenterY = element.y + element.height / 2;
  const movedCenterX =
    originalCenterX + ((center.x - startCenter.x) / pageWidth) * 100;
  const movedCenterY =
    originalCenterY + ((center.y - startCenter.y) / pageHeight) * 100;
  return {
    ...element,
    x: clamp(movedCenterX - width / 2, 0, 100 - width),
    y: clamp(movedCenterY - height / 2, 0, 100 - height),
    width,
    height,
    rotation:
      element.rotation +
      angleDelta(angle(startA, startB), angle(currentA, currentB)),
  };
}

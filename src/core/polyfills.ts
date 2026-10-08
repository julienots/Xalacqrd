// Compatibility shims for older Android System WebViews.

const proto = (globalThis as any).CanvasRenderingContext2D?.prototype;
if (proto && !proto.roundRect) {
  proto.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[] = 0) {
    const rad = Math.max(0, Math.min(Array.isArray(r) ? r[0] ?? 0 : r, w / 2, h / 2));
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}
if (typeof (globalThis as any).structuredClone !== 'function') {
  (globalThis as any).structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}
export {};

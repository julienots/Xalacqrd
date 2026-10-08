// Shared Three.js renderer (one WebGL context for the whole app), quality
// presets, a scene loop and a small tween engine.

import * as THREE from 'three';
import type { Quality } from '../systems/state';

export interface QualityPreset { dpr: number; particles: number; shadows: boolean; antialias: boolean; overlay: boolean; env: boolean }

export const QUALITY: Record<Quality, QualityPreset> = {
  LOW: { dpr: 1, particles: 0.3, shadows: false, antialias: false, overlay: false, env: false },
  MEDIUM: { dpr: 1.5, particles: 0.6, shadows: false, antialias: true, overlay: true, env: true },
  HIGH: { dpr: 2, particles: 1, shadows: true, antialias: true, overlay: true, env: true },
  ULTRA: { dpr: 3, particles: 1.6, shadows: true, antialias: true, overlay: true, env: true },
};

let quality: Quality = 'HIGH';
let renderer: THREE.WebGLRenderer | null = null;
let webglOk: boolean | null = null;

export function setQuality(q: Quality) {
  quality = q;
  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[q].dpr));
    renderer.shadowMap.enabled = QUALITY[q].shadows;
  }
}
export function preset(): QualityPreset { return QUALITY[quality]; }
export function currentQuality() { return quality; }

export function webglAvailable(): boolean {
  if (webglOk != null) return webglOk;
  try {
    const c = document.createElement('canvas');
    webglOk = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { webglOk = false; }
  return webglOk;
}

export function getRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: QUALITY[quality].antialias, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[quality].dpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = QUALITY[quality].shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('[VFX] context lost'); });
  }
  return renderer;
}

export type Updater = (dt: number, t: number) => void;

/** Owns the shared renderer while mounted in a container. */
export class SceneHost {
  scene = new THREE.Scene();
  camera: THREE.Camera;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private last = 0;
  private updaters = new Set<Updater>();
  private tweens: Tween[] = [];
  timeScale = 1;
  time = 0;
  width = 1; height = 1;
  running = false;
  onResize?: (w: number, h: number) => void;
  fpsEl: HTMLElement | null = null;
  private frames = 0; private fpsT = 0;

  constructor(public container: HTMLElement, camera?: THREE.Camera) {
    this.camera = camera ?? new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  }

  start() {
    const r = getRenderer();
    this.container.appendChild(r.domElement);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    this.resize();
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const rawDt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const dt = rawDt * this.timeScale;
      this.time += dt;
      for (let i = this.tweens.length - 1; i >= 0; i--) if (this.tweens[i].step(dt)) this.tweens.splice(i, 1);
      for (const u of this.updaters) u(dt, this.time);
      if (r.domElement.parentNode !== this.container) this.container.appendChild(r.domElement);
      r.render(this.scene, this.camera);
      if (this.fpsEl) { this.frames++; this.fpsT += rawDt; if (this.fpsT > 0.5) { this.fpsEl.textContent = `${Math.round(this.frames / this.fpsT)} fps`; this.frames = 0; this.fpsT = 0; } }
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.width = w; this.height = h;
    getRenderer().setSize(w, h, false);
    if (this.camera instanceof THREE.PerspectiveCamera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.camera instanceof THREE.OrthographicCamera) { this.camera.left = 0; this.camera.right = w; this.camera.top = 0; this.camera.bottom = -h; this.camera.updateProjectionMatrix(); }
    this.onResize?.(w, h);
  }

  add(u: Updater) { this.updaters.add(u); return () => this.updaters.delete(u); }

  tween(duration: number, fn: (k: number) => void, ease: (x: number) => number = easeInOut): Promise<void> {
    return new Promise((res) => this.tweens.push(new Tween(duration, fn, ease, res)));
  }
  wait(sec: number) { return this.tween(sec, () => {}); }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    const r = getRenderer();
    if (r.domElement.parentNode === this.container) this.container.removeChild(r.domElement);
    for (const t of this.tweens) t.finish();
    this.tweens = [];
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
  }
}

class Tween {
  t = 0;
  constructor(private d: number, private fn: (k: number) => void, private ease: (x: number) => number, private done: () => void) {}
  step(dt: number): boolean {
    this.t += dt;
    const k = Math.min(1, this.d > 0 ? this.t / this.d : 1);
    this.fn(this.ease(k));
    if (k >= 1) { this.done(); return true; }
    return false;
  }
  finish() { this.fn(this.ease(1)); this.done(); }
}

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number) => x * x * x;
export const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const linear = (x: number) => x;
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Soft round sprite texture for particles and glows. */
let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function makeGlowSprite(color: THREE.ColorRepresentation, size: number, opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

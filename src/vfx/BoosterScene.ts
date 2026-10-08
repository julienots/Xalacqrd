// The booster opening experience: 3D pack you can inspect, swipe-to-tear,
// cards emerging, quick commons, and escalating rarity reveal sequences.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Finish } from '../core/types';
import { PACKS, type PackId } from '../data/content';
import { FINISHES, RARITIES } from '../data/rarities';
import { SET_BY_CODE } from '../data/sets';
import type { PulledCard } from '../systems/BoosterSystem';
import { canvasTexture, easeIn, easeInOut, easeOut, easeOutBack, getRenderer, lerp, makeGlowSprite, preset, SceneHost } from './core';
import { createCardObject, type CardObject } from './cardMesh';
import { Particles } from './particles';

export interface BoosterHooks {
  sfx(name: string, arg?: any): void;
  music(mode: 'none' | 'menu' | 'battle' | 'tension'): void;
  haptic(level: 'light' | 'medium' | 'heavy'): void;
  epic(): void;
  hint(text: string): void;
  phase(p: 'idle' | 'opening' | 'reveal'): void;
  title(card: PulledCard | null): void;
  flash(color: string): void;
  shake(): void;
  done(): void;
}

const RARITY_COLORS: Record<number, string[]> = {
  0: ['#ffffff'], 1: ['#8affb0', '#ffffff'], 2: ['#4aa8ff', '#8fd0ff', '#ffffff'], 3: ['#b45cff', '#d9a6ff', '#ffffff'],
  4: ['#ffb52e', '#ffe08a', '#fff6cf'], 5: ['#ff4f8b', '#b45cff', '#6a7bff', '#ffffff'], 6: ['#3de0c8', '#9dfff0', '#1a6a8a'],
  7: ['#ffffff', '#c9e4ff', '#fff3b0'], 8: ['#ff2e2e', '#ff8080', '#ffffff', '#300000'], 9: ['#ff4fd8', '#ffe24f', '#4fd8ff', '#4fff8a', '#ffffff'],
};

function packCanvas(packId: PackId, setCode: string): HTMLCanvasElement {
  const p = PACKS[packId];
  const set = SET_BY_CODE[setCode];
  const W = 512, H = 760;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, p.colors[0]); gr.addColorStop(0.5, p.colors[1]); gr.addColorStop(1, p.colors[0]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // deep vignette so the foil reads rich instead of washed-out
  const vg = g.createRadialGradient(W / 2, H * 0.45, W * 0.2, W / 2, H * 0.5, W * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,3,20,0.75)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // foil stripes
  g.globalAlpha = 0.12; g.fillStyle = '#fff';
  for (let x = -H; x < W; x += 26) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.lineTo(x + H + 10, 0); g.lineTo(x + 10, H); g.fill(); }
  g.globalAlpha = 1;
  // radial burst
  g.save(); g.translate(W / 2, H * 0.45);
  for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-40, -600); g.lineTo(40, -600); g.fill(); }
  g.restore();
  const rg = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H * 0.45, 220);
  rg.addColorStop(0, 'rgba(255,255,255,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(W / 2, H * 0.45, 220, 0, Math.PI * 2); g.fill();
  g.font = '170px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 30; g.fillText(p.glyph, W / 2, H * 0.45);
  g.shadowBlur = 12;
  g.font = '900 64px Georgia, serif'; g.fillStyle = '#fff'; g.fillText('XALACARDS', W / 2, H * 0.14);
  g.font = '800 40px Georgia, serif'; g.fillText(p.name.toUpperCase(), W / 2, H * 0.72);
  g.font = '700 26px system-ui'; g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText(packId === 'EVENT' ? 'FESTIVAL EDITION' : `${set?.symbol ?? ''} ${set?.name.toUpperCase() ?? ''}`, W / 2, H * 0.79);
  g.fillText(`${p.cards} CARDS`, W / 2, H * 0.85);
  // crimped edges
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x < W; x += 16) { g.fillRect(x, 0, 8, 26); g.fillRect(x + 8, H - 26, 8, 26); }
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 4; g.setLineDash([14, 10]);
  g.beginPath(); g.moveTo(0, 70); g.lineTo(W, 70); g.stroke();
  return c;
}

function raysMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uTime: { value: 0 }, uAmt: { value: 0 }, uHue: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uAmt; uniform float uHue; varying vec2 vUv;
      vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0.,2./3.,1./3.))*6.-3.); return c.z * mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
      void main(){ vec2 p = vUv - 0.5; float r = length(p); float a = atan(p.y, p.x);
        float rays = pow(0.5 + 0.5 * sin(a * 14.0 + uTime * 0.8), 6.0) + pow(0.5 + 0.5 * sin(a * 7.0 - uTime * 0.5), 8.0) * 0.6;
        float fall = smoothstep(0.5, 0.0, r);
        vec3 col = mix(uColor, hsv2rgb(vec3(fract(a / 6.2831 + uTime * 0.1), 0.7, 1.0)), uHue);
        float core = smoothstep(0.18, 0.0, r);
        gl_FragColor = vec4(col * (rays * fall + core * 1.5) * uAmt, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

export class BoosterScene {
  host: SceneHost;
  private cam: THREE.PerspectiveCamera;
  private pack = new THREE.Group();
  private packBody!: THREE.Mesh;
  private packTop!: THREE.Mesh;
  private tearLine!: THREE.Mesh;
  private cards: CardObject[] = [];
  private particles: Particles;
  private dust: Particles;
  private rays: THREE.Mesh;
  private ring: THREE.Mesh;
  private ambient: THREE.AmbientLight;
  private key: THREE.DirectionalLight;
  private rim: THREE.PointLight;
  private bgColor = new THREE.Color('#05030f');
  private phase: 'idle' | 'tearing' | 'emerging' | 'ready' | 'busy' | 'showing' | 'finished' = 'idle';
  private index = 0;
  private camTheta = 0; private camPhi = 0; private camDist = 6;
  private drag = { active: false, x: 0, y: 0, sx: 0, sy: 0, moved: false, tear: 0, tearing: false };
  private packRot = { x: 0, y: 0, vx: 0, vy: 0 };
  private showing: CardObject | null = null;
  private pile: CardObject[] = [];
  private disposed = false;

  constructor(container: HTMLElement, private result: { packId: PackId; set: string; cards: PulledCard[] }, private cardBackId: string, private hooks: BoosterHooks, private fast = false) {
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.host = new SceneHost(container, this.cam);
    const s = this.host.scene;
    s.background = this.bgColor;
    s.fog = new THREE.Fog('#05030f', 8, 20);
    if (preset().env) {
      const pm = new THREE.PMREMGenerator(getRenderer());
      s.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    this.ambient = new THREE.AmbientLight('#8a7bff', 0.6);
    this.key = new THREE.DirectionalLight('#ffffff', 2.2);
    this.key.position.set(2, 4, 5);
    this.key.castShadow = preset().shadows;
    this.rim = new THREE.PointLight('#8a6bff', 30, 12);
    this.rim.position.set(-2, 1, -2);
    s.add(this.ambient, this.key, this.rim);
    // floor
    // soft spotlight halo behind the pack (no floor: cleaner, centred composition)
    const halo = makeGlowSprite('#6a4cff', 7, 0.35); halo.position.set(0, 0.1, -3); s.add(halo);
    // god rays + shockwave ring
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), raysMaterial(new THREE.Color('#ffffff')));
    this.rays.position.z = -1.5; s.add(this.rays);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    s.add(this.ring);
    this.particles = new Particles(2400);
    this.dust = new Particles(300);
    s.add(this.particles.points, this.dust.points);
    this.buildPack();
    this.host.onResize = (_w, h) => { this.particles.setScale(h); this.dust.setScale(h); this.fitCamera(); };
    this.host.add((dt, t) => this.update(dt, t));
    this.bindInput(container);
  }

  private fitCamera() {
    // frame the scene so a card fills ~65% of the width on phones and never overflows vertically
    const k = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * 2;
    this.camDist = Math.max(4.6, 1.15 / (0.65 * k * this.cam.aspect));
  }

  private buildPack() {
    const tex = canvasTexture(packCanvas(this.result.packId, this.result.set));
    const W = 1.3, H = 1.9, D = 0.14;
    const geo = new THREE.BoxGeometry(W, H * 0.9, D, 12, 18, 1);
    // pillow bulge
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (W / 2), y = pos.getY(i) / (H * 0.45), z = pos.getZ(i);
      pos.setZ(i, z * (0.25 + 0.75 * (1 - x * x) * (1 - Math.pow(Math.abs(y), 6))));
    }
    geo.computeVertexNormals();
    // remap front UVs to the lower 90% of the texture
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.9);
    const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.45, roughness: 0.35, envMapIntensity: 0.3 });
    this.packBody = new THREE.Mesh(geo, mat);
    this.packBody.position.y = -H * 0.05;
    this.packBody.castShadow = true;
    const topGeo = new THREE.BoxGeometry(W, H * 0.1, D * 0.3, 8, 2, 1);
    const tuv = topGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < tuv.count; i++) tuv.setY(i, 0.9 + tuv.getY(i) * 0.1);
    this.packTop = new THREE.Mesh(topGeo, mat.clone());
    this.packTop.position.y = H * 0.45;
    this.tearLine = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.025), new THREE.MeshBasicMaterial({ color: '#fff6c9', transparent: true, blending: THREE.AdditiveBlending }));
    this.tearLine.position.set(-W / 2, H * 0.4, D / 2 + 0.01);
    this.tearLine.scale.x = 0.0001;
    this.tearLine.geometry.translate(W / 2, 0, 0);
    this.pack.add(this.packBody, this.packTop, this.tearLine);
    this.host.scene.add(this.pack);
  }

  start() {
    this.host.start();
    this.fitCamera();
    this.hooks.music('menu');
    this.hooks.hint('Tap the pack (or swipe across it) to open');
    this.hooks.phase('idle');
    this.pack.position.set(0, -3, 0);
    this.pack.rotation.y = -Math.PI;
    this.host.tween(1.1, (k) => { this.pack.position.y = lerp(-3, 0, k); this.pack.rotation.y = lerp(-Math.PI * 1.5, 0, k); }, easeOutBack);
    this.dust.emit({ count: 120, spread: 3, speed: [0.02, 0.1], life: [4, 9], size: [0.02, 0.05], colors: ['#8a7bff', '#ffcf6b', '#ffffff'], drag: 0 });
  }

  // ---------------- input ----------------
  private bindInput(el: HTMLElement) {
    const down = (e: PointerEvent) => {
      this.drag = { ...this.drag, active: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, tearing: false };
    };
    const move = (e: PointerEvent) => {
      if (!this.drag.active) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      const tx = e.clientX - this.drag.sx, ty = e.clientY - this.drag.sy;
      if (Math.hypot(tx, ty) > 8) this.drag.moved = true;
      if (this.phase === 'idle') {
        const w = this.host.width;
        // horizontal swipe = tear, otherwise rotate to inspect
        if (this.drag.tearing || (Math.abs(tx) > 24 && Math.abs(tx) > Math.abs(ty) * 1.6)) {
          if (!this.drag.tearing) { this.drag.tearing = true; this.hooks.sfx('packShake'); }
          this.drag.tear = Math.min(1, Math.max(this.drag.tear, Math.abs(tx) / (w * 0.5)));
          this.tearLine.scale.x = Math.max(0.0001, this.drag.tear);
          if (Math.random() < 0.3) this.hooks.haptic('light');
          if (this.drag.tear >= 1) this.tear();
        } else {
          this.packRot.vy = dx * 0.01; this.packRot.vx = dy * 0.01;
        }
      } else if (this.phase === 'showing' && this.showing) {
        this.showing.group.rotation.y += dx * 0.01;
        this.showing.group.rotation.x += dy * 0.01;
      }
    };
    const up = () => {
      if (!this.drag.active) return;
      this.drag.active = false;
      if (this.phase === 'idle' && this.drag.tearing && this.drag.tear < 1) {
        const from = this.drag.tear;
        this.host.tween(0.25, (k) => { this.tearLine.scale.x = Math.max(0.0001, lerp(from, 0, k)); });
        this.drag.tear = 0;
      }
      if (!this.drag.moved || (this.phase === 'showing' && Math.hypot(this.drag.x - this.drag.sx, this.drag.y - this.drag.sy) < 30)) this.tap();
    };
    const cancel = () => { this.drag.active = false; this.drag.tear = 0; this.tearLine.scale.x = 0.0001; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    this.unbind = () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }
  private unbind = () => {};

  private tap() {
    if (this.phase === 'idle') this.open();
    else if (this.phase === 'ready') this.revealNext();
    else if (this.phase === 'showing') this.dismissShowing();
  }

  // ---------------- tear & emerge ----------------
  /** Opens the pack (tap, button or completed swipe). */
  async open() {
    if (this.phase !== 'idle') return;
    this.phase = 'tearing';
    this.hooks.phase('opening');
    this.hooks.hint('');
    this.hooks.sfx('packShake');
    // quick anticipation shake + tear line sweep
    await this.host.tween(0.45, (k) => {
      this.pack.rotation.z = Math.sin(k * Math.PI * 6) * 0.05 * (1 - k);
      this.tearLine.scale.x = Math.max(0.0001, k);
    });
    this.phase = 'idle';
    await this.tear();
  }

  private async tear() {
    if (this.phase !== 'idle') return;
    this.phase = 'tearing';
    this.hooks.phase('opening');
    this.hooks.hint('');
    this.hooks.sfx('packTear');
    this.hooks.haptic('medium');
    this.tearLine.visible = false;
    const top = this.packTop;
    const start = top.position.clone();
    this.particles.emit({ count: 140, pos: new THREE.Vector3(0, 0.85, 0.1), spread: 0.5, speed: [0.5, 3], dir: new THREE.Vector3(0, 1, 0.3), cone: 0.6, colors: ['#ffffff', '#fff6c9', PACKS[this.result.packId].colors[1]], life: [0.5, 1.4], size: [0.04, 0.12], gravity: 2 });
    this.host.tween(0.9, (k) => {
      top.position.set(start.x + k * 2.2, start.y + Math.sin(k * Math.PI) * 0.8 + k * 0.5, start.z + k * 1.5);
      top.rotation.set(k * 2.5, k * 1.2, -k * 4);
    }, easeOut).then(() => (top.visible = false));
    await this.host.wait(0.25);
    await this.emerge();
  }

  private async emerge() {
    this.phase = 'emerging';
    const n = this.result.cards.length;
    // create the cards in reveal order; the stack's top card is revealed first
    this.cards = this.result.cards.map((p, i) => {
      const tier = RARITIES[p.rarity].tier;
      const obj = createCardObject(p.card, p.finish as Finish, this.cardBackId, { hiRes: tier >= 2, popOut: tier >= 2 });
      obj.group.position.set(0, 0, -0.02 - i * 0.004);
      obj.group.rotation.y = Math.PI; // face down (back toward camera)
      obj.group.scale.setScalar(0.9);
      obj.group.visible = false;
      this.host.scene.add(obj.group);
      return obj;
    });
    this.hooks.sfx('cardSlide');
    // cards rise out of the pack
    const rise = this.cards.map((c, i) => {
      c.group.visible = true;
      return this.host.wait(i * 0.04).then(() => this.host.tween(0.6, (k) => { c.group.position.y = lerp(-0.6, 0.1 + (n - i) * 0.004, k); }, easeOut));
    });
    // pack drops away
    this.host.tween(0.8, (k) => { this.pack.position.y = lerp(0, -4.5, k); this.pack.rotation.x = k * 0.6; }, easeIn).then(() => (this.pack.visible = false));
    await Promise.all(rise);
    this.hooks.hint('Tap to reveal');
    this.phase = 'ready';
    this.hooks.phase('reveal');
    this.prepareTop();
  }

  /** Anticipation: the next card glows in its rarity colour through the card back. */
  private prepareTop() {
    const c = this.cards[this.index];
    if (!c) return;
    const tier = RARITIES[c.card.rarity].tier;
    if (tier >= 2) {
      this.hooks.music('tension');
      this.rim.color.set(RARITIES[c.card.rarity].color);
      this.host.tween(0.8, (k) => { this.ambient.intensity = lerp(0.6, tier >= 4 ? 0.12 : 0.3, k); this.rim.intensity = lerp(30, 60 + tier * 10, k); });
      this.hooks.hint(tier >= 4 ? 'Something powerful stirs… Tap' : 'Tap to reveal');
    } else if (!this.fast) this.hooks.hint('Tap to reveal');
    if (this.fast && tier < 2) setTimeout(() => { if (this.phase === 'ready' && this.cards[this.index] === c) this.revealNext(); }, 120);
  }

  // ---------------- reveal ----------------
  private async revealNext() {
    const c = this.cards[this.index];
    if (!c || this.phase !== 'ready') return;
    this.phase = 'busy';
    this.hooks.hint('');
    const p = this.result.cards[this.index];
    const tier = RARITIES[p.rarity].tier;
    const specialFinish = FINISHES[p.finish as Finish].tier >= 2;
    if (tier <= 1 && !specialFinish) await this.revealQuick(c, p);
    else await this.revealBig(c, p, tier);
  }

  private async revealQuick(c: CardObject, p: PulledCard) {
    const g = c.group;
    this.hooks.sfx('cardFlip');
    const z0 = g.position.z;
    const y0 = g.position.y;
    await this.host.tween(0.28, (k) => { g.rotation.y = lerp(Math.PI, 0, k); g.position.y = lerp(y0, 0.22, k); g.position.z = z0 + Math.sin(k * Math.PI) * 0.4; g.scale.setScalar(lerp(0.9, 1.05, k)); }, easeOut);
    this.hooks.sfx('reveal', RARITIES[p.rarity].tier);
    if (p.isNew) this.particles.emit({ count: 20, pos: g.position.clone(), spread: 0.4, speed: [0.3, 1], colors: ['#ffffff', '#8affb0'], size: [0.03, 0.07] });
    this.hooks.title(p);
    await this.host.wait(this.fast ? 0.25 : 0.5);
    this.hooks.title(null);
    await this.toPile(c);
    this.advance();
  }

  private async revealBig(c: CardObject, p: PulledCard, tier: number) {
    const g = c.group;
    const colors = RARITIES[p.rarity];
    const pc = RARITY_COLORS[tier] ?? RARITY_COLORS[2];
    const raysMat = this.rays.material as THREE.ShaderMaterial;
    raysMat.uniforms.uColor.value.set(colors.color === '#ffffff' ? '#fff6c9' : colors.color);
    raysMat.uniforms.uHue.value = tier === 9 ? 1 : 0;
    const ultra = tier >= 5;
    const slow = this.fast ? 0.5 : 1;

    // 1) anticipation: card lifts, camera slows & darkens, light builds behind
    this.hooks.sfx('buildup', ultra ? 2 : tier >= 4 ? 1.3 : 0.7);
    if (tier >= 3) this.host.timeScale = 0.85;
    const lift = ultra ? 0.7 : 0.45;
    const z0 = g.position.z;
    const buildT = (ultra ? 1.8 : tier >= 4 ? 1.2 : 0.6) * slow;
    const shakeAmp = tier >= 4 ? 0.03 : 0.01;
    await this.host.tween(buildT, (k) => {
      g.position.z = lerp(z0, lift, easeOut(k));
      g.position.y = lerp(0.1, 0.22, k);
      g.position.x = (Math.random() - 0.5) * shakeAmp * k;
      raysMat.uniforms.uAmt.value = k * 0.5;
      this.ambient.intensity = lerp(this.ambient.intensity, tier >= 8 ? 0.0 : 0.15, k * 0.1);
      c.setGlow(k * 1.5);
    });
    if (tier >= 8) { this.hooks.shake(); this.rim.color.set(tier === 8 ? '#ff0000' : '#ffffff'); }
    if (tier >= 4) this.hooks.haptic('medium');

    // 2) the flip — ultra rares spin several times
    const spins = tier >= 8 ? 3 : ultra ? 2 : tier >= 4 ? 1 : 0;
    const flipT = (0.6 + spins * 0.35) * slow;
    this.hooks.sfx('whoosh');
    await this.host.tween(flipT, (k) => {
      g.rotation.y = lerp(Math.PI, -Math.PI * 2 * spins, k);
      g.rotation.z = Math.sin(k * Math.PI) * (ultra ? 0.25 : 0.1);
      g.scale.setScalar(lerp(0.9, ultra ? 1.12 : 1.06, k));
    }, ultra ? easeInOut : easeOut);
    g.rotation.y = 0;
    this.host.timeScale = 1;

    // 3) the burst
    this.hooks.sfx('reveal', tier);
    if (tier >= 8) this.hooks.epic(); else this.hooks.haptic(tier >= 5 ? 'heavy' : tier >= 4 ? 'medium' : 'light');
    if (tier >= 4) this.hooks.flash(tier === 8 ? '#ff3030' : tier === 9 ? '#ffffff' : colors.glow);
    c.uniforms.uReveal.value = 1;
    this.host.tween(0.6, (k) => (c.uniforms.uReveal.value = 1 - k));
    const pos = g.position.clone();
    const burst = (n: number, extra: Partial<Parameters<Particles['emit']>[0]> = {}) => this.particles.emit({ count: n, pos, spread: 0.3, speed: [1, 4 + tier * 0.4], colors: pc, life: [0.6, 1.8], size: [0.04, 0.14 + tier * 0.01], drag: 1.2, ...extra });
    burst(60 + tier * 25);
    this.shockwave(pos, colors.glow, ultra ? 2.2 : 1.3);
    if (tier === 4) burst(80, { dir: new THREE.Vector3(0, 1, 0), cone: 0.5, gravity: -0.5 });
    if (tier === 5) burst(220, { swirl: 3, speed: [0.5, 2], life: [1.5, 3], spread: 1.2 });
    if (tier === 6) { for (let i = 1; i <= 3; i++) setTimeout(() => !this.disposed && this.shockwave(pos, '#3de0c8', 2 + i), i * 220); burst(220, { attract: 2.5, swirl: 4, spread: 2.5, speed: [0.1, 0.4], life: [1.5, 2.5] }); }
    if (tier === 7) burst(200, { pos: new THREE.Vector3(pos.x, pos.y + 2.5, pos.z), spread: 1.5, dir: new THREE.Vector3(0, -1, 0), cone: 0.2, speed: [0.4, 1.2], gravity: 0.5, life: [2, 3.5] });
    if (tier === 8) { burst(300, { speed: [2, 7] }); for (let i = 0; i < 4; i++) setTimeout(() => { if (this.disposed) return; this.rim.intensity = 200; this.hooks.flash('#ff2020'); setTimeout(() => (this.rim.intensity = 40), 80); }, 300 + i * 260); }
    if (tier === 9) burst(320, { swirl: 2, speed: [1.5, 5], life: [1, 2.6] });
    raysMat.uniforms.uAmt.value = tier >= 4 ? 1.4 : 0.8;

    // 4) name & rarity appear, card comes to center; camera orbits
    this.hooks.title(p);
    const orbit = tier >= 3 ? (ultra ? 0.5 : 0.3) : 0.12;
    await this.host.tween(1.2 * slow, (k) => {
      g.position.x = lerp(g.position.x, 0, k);
      g.position.y = lerp(g.position.y, 0.22, k);
      this.camTheta = Math.sin(k * Math.PI) * orbit;
      this.camPhi = Math.sin(k * Math.PI) * orbit * 0.4;
      raysMat.uniforms.uAmt.value = lerp(tier >= 4 ? 1.4 : 0.8, 0.55, k);
    }, easeInOut);
    this.showing = c;
    this.phase = 'showing';
    this.hooks.hint('Drag to admire · Tap to continue');
  }

  private shockwave(pos: THREE.Vector3, color: string, size: number) {
    const ring = this.ring.clone();
    ring.material = (this.ring.material as THREE.MeshBasicMaterial).clone();
    const m = ring.material as THREE.MeshBasicMaterial;
    m.color.set(color);
    ring.position.copy(pos);
    this.host.scene.add(ring);
    this.host.tween(0.9, (k) => { ring.scale.setScalar(0.3 + k * size * 2); m.opacity = (1 - k) * 0.9; }, easeOut).then(() => { this.host.scene.remove(ring); m.dispose(); });
  }

  private async dismissShowing() {
    const c = this.showing;
    if (!c) return;
    this.phase = 'busy';
    this.showing = null;
    this.hooks.title(null);
    this.hooks.hint('');
    const raysMat = this.rays.material as THREE.ShaderMaterial;
    const a0 = raysMat.uniforms.uAmt.value;
    this.host.tween(0.5, (k) => { raysMat.uniforms.uAmt.value = lerp(a0, 0, k); this.ambient.intensity = lerp(this.ambient.intensity, 0.6, k); this.rim.intensity = lerp(this.rim.intensity, 30, k); });
    this.rim.color.set('#8a6bff');
    c.setGlow(RARITIES[c.card.rarity].tier >= 4 ? 0.5 : 0.2);
    this.hooks.music('menu');
    await this.toPile(c);
    this.advance();
  }

  private async toPile(c: CardObject) {
    const g = c.group;
    const i = this.pile.length;
    this.pile.push(c);
    this.hooks.sfx('cardSlide');
    const from = g.position.clone(), r0 = g.rotation.clone(), s0 = g.scale.x;
    // tidy row(s) of revealed cards at the bottom of the screen, facing the player
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.camDist;
    const halfW = halfH * this.cam.aspect;
    const perRow = 5, sc = Math.min(0.26, (halfW * 2 - 0.2) / perRow / 1.08);
    const col = i % perRow, row = Math.floor(i / perRow);
    const rowCount = Math.min(perRow, this.cards.length - row * perRow);
    const tx = (col - (rowCount - 1) / 2) * sc * 1.08;
    const rows = Math.ceil(this.cards.length / perRow);
    const ty = 0.1 - halfH + 0.22 + sc * 0.7 + (rows - 1 - row) * sc * 1.5;
    const tz = 0.02 * i;
    await this.host.tween(0.35, (k) => {
      g.position.set(lerp(from.x, tx, k), lerp(from.y, ty, k), lerp(from.z, tz, k));
      g.rotation.set(lerp(r0.x, 0, k), lerp(r0.y, 0, k), lerp(r0.z, 0, k));
      g.scale.setScalar(lerp(s0, sc, k));
    }, easeInOut);
  }

  private advance() {
    this.index++;
    if (this.index >= this.cards.length) {
      this.phase = 'finished';
      this.hooks.music('menu');
      setTimeout(() => !this.disposed && this.hooks.done(), 350);
      return;
    }
    this.phase = 'ready';
    this.prepareTop();
  }

  /** Skips straight to the summary. */
  skip() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.hooks.title(null);
    this.hooks.music('menu');
    this.hooks.done();
  }

  // ---------------- frame update ----------------
  private update(dt: number, t: number) {
    // camera orbit
    const d = this.camDist;
    this.cam.position.set(Math.sin(this.camTheta) * d, 0.1 + Math.sin(this.camPhi) * d * 0.3, Math.cos(this.camTheta) * d);
    this.cam.lookAt(0, 0.1, 0);
    // idle pack float + inertia rotation
    if (this.phase === 'idle' || this.phase === 'tearing') {
      if (!this.drag.active) { this.packRot.vx *= 0.92; this.packRot.vy *= 0.92; }
      this.packRot.y += this.packRot.vy; this.packRot.x += this.packRot.vx;
      this.packRot.x *= 0.95;
      if (!this.drag.active) this.packRot.y *= 0.97;
      this.pack.rotation.set(this.packRot.x + Math.sin(t * 1.2) * 0.05, this.packRot.y + Math.sin(t * 0.7) * 0.15, Math.sin(t * 0.9) * 0.03);
      this.pack.position.y += (Math.sin(t * 1.5) * 0.06 - this.pack.position.y) * 0.05;
    }
    if (this.showing) {
      const g = this.showing.group;
      if (!this.drag.active) { g.rotation.y += (Math.sin(t * 0.8) * 0.25 - g.rotation.y) * 0.04; g.rotation.x += (Math.sin(t * 0.6) * 0.08 - g.rotation.x) * 0.04; }
      if (Math.random() < 0.3) this.particles.emit({ count: 2, pos: g.position.clone(), spread: 0.7, speed: [0.1, 0.5], colors: RARITY_COLORS[RARITIES[this.showing.card.rarity].tier], size: [0.02, 0.06], life: [1, 2] });
    }
    for (const c of this.cards) c.update(t);
    (this.rays.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.rays.lookAt(this.cam.position);
    this.particles.update(dt);
    this.dust.update(dt);
    if (Math.random() < 0.05) this.dust.emit({ count: 2, spread: 3, speed: [0.02, 0.1], life: [5, 9], size: [0.02, 0.05], colors: ['#8a7bff', '#ffcf6b'], drag: 0 });
  }

  dispose() {
    this.disposed = true;
    this.unbind();
    for (const c of this.cards) c.dispose();
    this.host.dispose();
  }
}

export function makeGlow(color: string, size: number) { return makeGlowSprite(color, size); }

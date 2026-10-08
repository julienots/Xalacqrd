// Battle overlay: 3D creatures materialise above their cards on the 2.5D
// table. Uses an orthographic camera mapped to screen pixels so models follow
// DOM card positions exactly.

import * as THREE from 'three';
import type { CardDef } from '../core/types';
import { SceneHost, easeOutBack, easeIn, makeGlowSprite } from './core';
import { createCreature, type Creature3D } from './creatures';
import { Particles } from './particles';

interface Entry { c: Creature3D; el: HTMLElement; holder: THREE.Group; dying: boolean; size: number }

export class CreatureOverlay {
  host: SceneHost;
  private entries = new Map<number, Entry>();
  private particles = new Particles(600);

  constructor(private container: HTMLElement) {
    const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
    this.host = new SceneHost(container, cam);
    const s = this.host.scene;
    s.add(new THREE.AmbientLight('#9a8bff', 1.3));
    const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(0.4, 1, 1.2); s.add(key);
    s.add(this.particles.points);
    (this.particles.points.material as THREE.ShaderMaterial).uniforms.scale.value = 400;
    this.host.add((dt, t) => this.update(dt, t));
  }

  start() { this.host.start(); }

  has(uid: number) { return this.entries.has(uid); }

  spawn(uid: number, card: CardDef, el: HTMLElement) {
    if (this.entries.has(uid)) return;
    const c = createCreature(card);
    if (!c) return;
    const holder = new THREE.Group();
    holder.add(c.root);
    const r = el.getBoundingClientRect();
    const size = r.width * 0.62;
    holder.scale.setScalar(0.001);
    this.host.scene.add(holder);
    const e: Entry = { c, el, holder, dying: false, size };
    this.entries.set(uid, e);
    this.place(e);
    const glow = makeGlowSprite('#ffffff', size * 2, 0.9);
    glow.position.copy(holder.position);
    this.host.scene.add(glow);
    this.host.tween(0.6, (k) => { holder.scale.setScalar(size * k); (glow.material as THREE.SpriteMaterial).opacity = 1 - k; }, easeOutBack).then(() => this.host.scene.remove(glow));
    this.burst(holder.position, ['#ffffff', '#ffcf6b', '#8a6bff'], 40);
    setTimeout(() => c.roar(), 350);
  }

  rebind(uid: number, el: HTMLElement) { const e = this.entries.get(uid); if (e) e.el = el; }

  attack(uid: number) { this.entries.get(uid)?.c.attack(); }
  roar(uid: number) { this.entries.get(uid)?.c.roar(); }

  kill(uid: number) {
    const e = this.entries.get(uid);
    if (!e || e.dying) return;
    e.dying = true;
    this.burst(e.holder.position, ['#ffffff', '#ff5370', '#2a1a4a'], 50);
    this.host.tween(0.5, (k) => { e.holder.scale.setScalar(e.size * (1 - k)); e.holder.rotation.y += 0.2; }, easeIn).then(() => {
      this.host.scene.remove(e.holder); e.c.dispose(); this.entries.delete(uid);
    });
  }

  /** Drop entries whose DOM element disappeared (bounced, etc.). */
  sync(alive: Set<number>) { for (const uid of [...this.entries.keys()]) if (!alive.has(uid)) this.kill(uid); }

  private burst(p: THREE.Vector3, colors: string[], n: number) {
    this.particles.emit({ count: n, pos: p.clone(), spread: 10, speed: [60, 220], colors, life: [0.4, 1], size: [6, 14], drag: 2.5 });
  }

  private place(e: Entry) {
    const cr = this.container.getBoundingClientRect();
    const r = e.el.getBoundingClientRect();
    const x = r.left - cr.left + r.width / 2, y = r.top - cr.top + r.height * 0.42;
    e.holder.position.set(x, -y, -400);
  }

  private update(dt: number, t: number) {
    for (const e of this.entries.values()) {
      if (!e.el.isConnected) continue;
      this.place(e);
      e.holder.rotation.x = 0.35;
      if (!e.dying) e.holder.rotation.y = Math.sin(t * 0.6 + e.size) * 0.3;
      e.c.update(dt, t);
    }
    this.particles.update(dt);
  }

  dispose() { for (const e of this.entries.values()) e.c.dispose(); this.entries.clear(); this.host.dispose(); }
}

// 3D chest opening: shake, hinge, light pillar and loot burst.

import * as THREE from 'three';
import { CHESTS, type ChestId } from '../data/content';
import { easeOut, easeOutBack, lerp, makeGlowSprite, SceneHost } from './core';
import { Particles } from './particles';

export class ChestScene {
  host: SceneHost;
  private lid = new THREE.Group();
  private chest = new THREE.Group();
  private particles = new Particles(800);
  private glow: THREE.Sprite;
  private opened = false;

  constructor(container: HTMLElement, private id: ChestId) {
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    cam.position.set(0, 1.6, 5); cam.lookAt(0, 0.2, 0);
    this.host = new SceneHost(container, cam);
    const s = this.host.scene;
    const def = CHESTS[id];
    s.add(new THREE.AmbientLight('#8a7bff', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(2, 4, 3); s.add(key);
    const wood = new THREE.MeshStandardMaterial({ color: def.color, roughness: id === 'WOODEN' ? 0.8 : 0.3, metalness: id === 'WOODEN' ? 0.05 : 0.7, flatShading: true });
    const band = new THREE.MeshStandardMaterial({ color: def.color2, metalness: 0.9, roughness: 0.25, emissive: new THREE.Color(def.color2), emissiveIntensity: id === 'CELESTIAL' || id === 'CRYSTAL' ? 0.4 : 0.05 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1), wood); base.position.y = 0.4; this.chest.add(base);
    for (const x of [-0.6, 0.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.84, 1.04), band); b.position.set(x, 0.4, 0); this.chest.add(b); }
    const lidBox = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 12, 1, false, 0, Math.PI), wood);
    lidBox.rotation.z = Math.PI / 2; lidBox.position.set(0, 0, 0.5);
    for (const x of [-0.6, 0.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.12, 12, 1, false, 0, Math.PI), band); b.rotation.z = Math.PI / 2; b.position.set(x, 0, 0.5); this.lid.add(b); }
    this.lid.add(lidBox);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.08), band); lock.position.set(0, -0.05, 1.02); this.lid.add(lock);
    this.lid.position.set(0, 0.8, -0.5);
    this.chest.add(this.lid);
    this.glow = makeGlowSprite(def.color2, 0.01, 0.95); this.glow.position.set(0, 0.9, 0); this.chest.add(this.glow);
    s.add(this.chest);
    s.add(this.particles.points);
    this.host.onResize = (_w, h) => this.particles.setScale(h);
    this.host.add((dt, t) => { this.particles.update(dt); if (!this.opened) this.chest.rotation.y = Math.sin(t * 0.8) * 0.25; this.chest.position.y = Math.sin(t * 1.5) * 0.04; });
  }

  start() {
    this.host.start();
    this.chest.scale.setScalar(0.01);
    this.host.tween(0.7, (k) => this.chest.scale.setScalar(k), easeOutBack);
  }

  async open(onBurst: () => void) {
    if (this.opened) return;
    this.opened = true;
    const def = CHESTS[this.id];
    for (let i = 0; i < 3; i++) await this.host.tween(0.12, (k) => (this.chest.rotation.z = Math.sin(k * Math.PI * 2) * 0.08));
    this.host.tween(0.3, (k) => (this.chest.rotation.y = lerp(this.chest.rotation.y, 0, k)));
    onBurst();
    await this.host.tween(0.6, (k) => { this.lid.rotation.x = -k * 1.9; this.glow.scale.setScalar(k * 4); }, easeOutBack);
    this.particles.emit({ count: 260, pos: new THREE.Vector3(0, 0.9, 0), spread: 0.4, dir: new THREE.Vector3(0, 1, 0), cone: 0.45, speed: [2, 5], gravity: 3, life: [0.8, 2], size: [0.05, 0.14], colors: [def.color2, '#ffffff', '#ffcf6b'] });
    this.host.tween(2, (k) => this.glow.scale.setScalar(4 + Math.sin(k * 10) * 0.3), easeOut);
  }

  dispose() { this.host.dispose(); }
}

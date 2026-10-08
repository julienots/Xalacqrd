// Animated main-menu backdrop: a guardian creature, floating premium cards,
// particles and slow camera drift.

import * as THREE from 'three';
import type { CardDef, Finish } from '../core/types';
import { preset, SceneHost } from './core';
import { createCardObject, type CardObject } from './cardMesh';
import { createCreature, type Creature3D } from './creatures';
import { Particles } from './particles';

export class MenuScene {
  host: SceneHost;
  private cards: { obj: CardObject; r: number; a: number; y: number; speed: number }[] = [];
  private creature: Creature3D | null = null;
  private particles = new Particles(500);
  private cam: THREE.PerspectiveCamera;
  private pointer = { x: 0, y: 0 };
  private onMove = (e: PointerEvent) => { this.pointer.x = e.clientX / window.innerWidth - 0.5; this.pointer.y = e.clientY / window.innerHeight - 0.5; };

  constructor(container: HTMLElement, showcase: { card: CardDef; finish: Finish }[], guardian: CardDef | null, cardBack: string) {
    this.cam = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    this.host = new SceneHost(container, this.cam);
    const s = this.host.scene;
    s.fog = new THREE.FogExp2('#0b0820', 0.07);
    s.add(new THREE.AmbientLight('#6a5bff', 0.9));
    const key = new THREE.DirectionalLight('#fff3d0', 2.4); key.position.set(3, 5, 4); s.add(key);
    const rim = new THREE.PointLight('#ff9f2e', 40, 14); rim.position.set(-2.5, 1.5, -1); s.add(rim);
    const rim2 = new THREE.PointLight('#4fd8ff', 30, 14); rim2.position.set(2.5, 0.5, -1.5); s.add(rim2);
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.3, 32), new THREE.MeshStandardMaterial({ color: '#1b1638', metalness: 0.7, roughness: 0.3 }));
    ped.position.y = -1.35; s.add(ped);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffcf6b', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.015, 6, 64), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = -1.19; s.add(ring);
    if (guardian) {
      this.creature = createCreature(guardian);
      if (this.creature) { this.creature.root.scale.multiplyScalar(1.15); this.creature.root.position.set(0, -1.2, -0.6); s.add(this.creature.root); setTimeout(() => this.creature?.roar(), 900); }
    }
    showcase.slice(0, preset().particles < 0.5 ? 4 : 7).forEach((sc, i, arr) => {
      const obj = createCardObject(sc.card, sc.finish, cardBack);
      obj.group.scale.setScalar(0.55);
      s.add(obj.group);
      this.cards.push({ obj, r: 1.9 + (i % 2) * 0.35, a: (i / arr.length) * Math.PI * 2, y: -0.2 + (i % 3) * 0.45, speed: 0.12 + (i % 3) * 0.02 });
    });
    s.add(this.particles.points);
    this.host.onResize = (w, h) => { this.particles.setScale(h); this.cam.position.z = w / h < 0.6 ? 7.6 : 6; };
    this.host.add((dt, t) => this.update(dt, t));
    window.addEventListener('pointermove', this.onMove);
  }

  start() { this.host.start(); }

  private update(dt: number, t: number) {
    this.cam.position.x += (this.pointer.x * 0.8 - this.cam.position.x) * 0.03;
    this.cam.position.y = 0.6 + (-this.pointer.y * 0.5);
    this.cam.lookAt(0, -0.1, 0);
    for (const c of this.cards) {
      const a = c.a + t * c.speed;
      c.obj.group.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * 0.8 + c.a) * 0.15, Math.sin(a) * c.r - 0.5);
      c.obj.group.rotation.set(Math.sin(t * 0.5 + c.a) * 0.15, -a + Math.PI / 2 + Math.sin(t * 0.3) * 0.3, Math.sin(t * 0.4 + c.a) * 0.08);
      c.obj.update(t);
    }
    if (this.creature) { this.creature.update(dt, t); this.creature.root.rotation.y = Math.sin(t * 0.25) * 0.5; if (Math.random() < 0.002) this.creature.roar(); }
    if (Math.random() < 0.5) this.particles.emit({ count: 2, pos: new THREE.Vector3(0, -1.2, 0), spread: 1.4, dir: new THREE.Vector3(0, 1, 0), cone: 0.3, speed: [0.2, 0.6], life: [2, 4], size: [0.02, 0.07], colors: ['#ffcf6b', '#8a6bff', '#4fd8ff'], drag: 0.1 });
    this.particles.update(dt);
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    this.creature?.dispose();
    for (const c of this.cards) c.obj.dispose();
    this.host.dispose();
  }
}

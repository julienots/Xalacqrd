// Procedural low-poly 3D creatures. Each archetype is a small rig with idle,
// roar and attack animations. New hand-made models can be registered in
// MODEL_REGISTRY (e.g. glTF loaders) without touching gameplay code.

import * as THREE from 'three';
import type { CardDef } from '../core/types';
import { FACTIONS } from '../data/factions';
import { Rng } from '../core/rng';
import { makeGlowSprite } from './core';

export interface Creature3D {
  root: THREE.Group;
  update(dt: number, t: number): void;
  roar(): void;
  attack(): void;
  dispose(): void;
}

type Builder = (card: CardDef, mats: Mats, rng: Rng) => { root: THREE.Group; anim: (t: number, roar: number, atk: number) => void };

interface Mats { body: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial; glowColor: THREE.Color }

function mats(card: CardDef): Mats {
  const f = FACTIONS[card.faction];
  const c1 = new THREE.Color().setHSL(card.art.hue / 360, card.faction === 'TITAN' ? 0.25 : 0.6, card.faction === 'VOID' ? 0.28 : card.faction === 'AETHER' ? 0.75 : 0.45);
  const c2 = new THREE.Color().setHSL(card.art.hue / 360, 0.5, 0.18);
  const glowColor = new THREE.Color(f.color2);
  return {
    body: new THREE.MeshStandardMaterial({ color: c1, roughness: 0.55, metalness: 0.15, flatShading: true }),
    dark: new THREE.MeshStandardMaterial({ color: c2, roughness: 0.7, flatShading: true }),
    accent: new THREE.MeshStandardMaterial({ color: new THREE.Color(f.color), roughness: 0.35, metalness: 0.5, flatShading: true, emissive: new THREE.Color(f.color), emissiveIntensity: 0.25 }),
    glow: new THREE.MeshBasicMaterial({ color: glowColor }),
    glowColor,
  };
}

const glowAt = (c: THREE.Color, size: number, op: number, x: number, y: number, z: number) => { const s = makeGlowSprite(c, size, op); s.position.set(x, y, z); return s; };

const M = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };

function eyesOn(parent: THREE.Object3D, m: Mats, y: number, z: number, spread: number, size = 0.05) {
  for (const s of [-1, 1]) {
    const e = M(new THREE.SphereGeometry(size, 8, 6), m.glow, s * spread, y, z);
    parent.add(e);
    const gs = makeGlowSprite(m.glowColor, size * 6, 0.8);
    gs.position.copy(e.position);
    parent.add(gs);
  }
}

const drake: Builder = (_c, m) => {
  const root = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.35, 10, 8), m.body, 0, 0.5, 0); body.scale.set(1, 0.85, 1.35); root.add(body);
  const neck = new THREE.Group(); neck.position.set(0, 0.65, 0.35); root.add(neck);
  neck.add(M(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 7), m.body, 0, 0.2, 0.05));
  const head = new THREE.Group(); head.position.set(0, 0.48, 0.12); neck.add(head);
  head.add(M(new THREE.ConeGeometry(0.15, 0.42, 6), m.body, 0, 0, 0.18).rotateX(Math.PI / 2));
  head.add(M(new THREE.SphereGeometry(0.15, 8, 6), m.body));
  for (const s of [-1, 1]) { const horn = M(new THREE.ConeGeometry(0.04, 0.3, 5), m.accent, s * 0.09, 0.15, -0.08); horn.rotation.x = -0.7; horn.rotation.z = -s * 0.3; head.add(horn); }
  eyesOn(head, m, 0.06, 0.12, 0.08, 0.035);
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.22, 0.7, 0); root.add(w);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(s * 0.9, 0.45); shape.lineTo(s * 0.75, 0.05); shape.lineTo(s * 0.95, -0.15); shape.lineTo(s * 0.55, -0.1); shape.lineTo(s * 0.5, -0.3); shape.lineTo(0, -0.1);
    const wm = M(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: m.dark.color, side: THREE.DoubleSide, flatShading: true, transparent: true, opacity: 0.92 }));
    wm.rotation.x = -Math.PI / 2.4; w.add(wm); wings.push(w);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.4, -0.4); root.add(tail);
  let prev: THREE.Object3D = tail;
  const segs: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) { const sgr = new THREE.Group(); sgr.position.z = i === 0 ? 0 : -0.18; prev.add(sgr); sgr.add(M(new THREE.ConeGeometry(0.1 - i * 0.02, 0.24, 6), m.body, 0, 0, -0.08).rotateX(-Math.PI / 2)); segs.push(sgr); prev = sgr; }
  for (const s of [-1, 1]) for (const z of [0.2, -0.2]) root.add(M(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 6), m.dark, s * 0.2, 0.17, z));
  return { root, anim: (t, roar, atk) => {
    wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (Math.sin(t * 3) * 0.35 + roar * 0.6); });
    neck.rotation.x = -0.2 + Math.sin(t * 1.2) * 0.08 - roar * 0.5 - atk * 0.6;
    head.rotation.x = roar * 0.4;
    segs.forEach((s, i) => (s.rotation.y = Math.sin(t * 2 + i) * 0.25));
    root.position.y = Math.sin(t * 1.5) * 0.04;
  } };
};

const beast: Builder = (_c, m, rng) => {
  const root = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.3, 9, 7), m.body, 0, 0.45, 0); body.scale.set(0.9, 0.8, 1.5); root.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.45); root.add(head);
  head.add(M(new THREE.SphereGeometry(0.17, 8, 6), m.body));
  head.add(M(new THREE.ConeGeometry(0.1, 0.22, 6), m.body, 0, -0.04, 0.16).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) head.add(M(new THREE.ConeGeometry(0.05, 0.16, 4), m.accent, s * 0.1, 0.17, -0.02));
  if (rng.chance(0.5)) for (const s of [-1, 1]) { const a = M(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 4), m.accent, s * 0.12, 0.3, -0.05); a.rotation.z = -s * 0.5; head.add(a); }
  eyesOn(head, m, 0.04, 0.13, 0.07, 0.03);
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) for (const z of [0.28, -0.28]) { const l = M(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 6), m.dark, s * 0.17, 0.2, z); legs.push(l); root.add(l); }
  const mane = M(new THREE.DodecahedronGeometry(0.2, 0), m.accent, 0, 0.62, 0.3); root.add(mane);
  const tail = M(new THREE.ConeGeometry(0.05, 0.4, 5), m.body, 0, 0.55, -0.5); tail.rotation.x = -2.2; root.add(tail);
  return { root, anim: (t, roar, atk) => {
    legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 4 + i * Math.PI / 2) * 0.12 * (1 + atk * 3)));
    head.rotation.x = Math.sin(t * 1.4) * 0.08 - roar * 0.5; head.position.z = 0.45 + atk * 0.2;
    tail.rotation.z = Math.sin(t * 5) * 0.4;
    root.position.y = Math.abs(Math.sin(t * 2)) * 0.02;
  } };
};

const golem: Builder = (_c, m) => {
  const root = new THREE.Group();
  const torso = M(new THREE.DodecahedronGeometry(0.33, 0), m.body, 0, 0.62, 0); torso.scale.set(1.2, 1, 0.9); root.add(torso);
  const core = M(new THREE.IcosahedronGeometry(0.1, 0), m.glow, 0, 0.65, 0.27); root.add(core);
  const cg = makeGlowSprite(m.glowColor, 0.6, 0.9); cg.position.copy(core.position); root.add(cg);
  const head = M(new THREE.BoxGeometry(0.24, 0.2, 0.22), m.body, 0, 1.0, 0.02); root.add(head);
  eyesOn(head, m, 0.02, 0.12, 0.06, 0.03);
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.45, 0.82, 0); root.add(a);
    a.add(M(new THREE.DodecahedronGeometry(0.14, 0), m.dark));
    a.add(M(new THREE.BoxGeometry(0.16, 0.42, 0.16), m.body, 0, -0.28, 0));
    a.add(M(new THREE.DodecahedronGeometry(0.15, 0), m.dark, 0, -0.55, 0));
    arms.push(a);
  }
  for (const s of [-1, 1]) root.add(M(new THREE.BoxGeometry(0.2, 0.35, 0.2), m.dark, s * 0.18, 0.17, 0));
  for (let i = 0; i < 3; i++) { const cr = M(new THREE.ConeGeometry(0.05, 0.22, 4), m.accent, (i - 1) * 0.15, 0.9, -0.15); cr.rotation.x = -0.4; root.add(cr); }
  return { root, anim: (t, roar, atk) => {
    arms.forEach((a, i) => (a.rotation.x = Math.sin(t * 1.3 + i) * 0.1 - atk * 1.4 - roar * 0.8));
    arms.forEach((a, i) => (a.rotation.z = (i ? -1 : 1) * roar * 0.6));
    core.rotation.y = t * 2; (cg.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(t * 4) * 0.3 + roar * 0.4;
    root.position.y = Math.sin(t) * 0.015;
  } };
};

const serpent: Builder = (_c, m) => {
  const root = new THREE.Group();
  const pts = [new THREE.Vector3(0, 0.1, -0.4), new THREE.Vector3(0.25, 0.15, -0.15), new THREE.Vector3(-0.2, 0.35, 0.05), new THREE.Vector3(0.1, 0.65, 0.15), new THREE.Vector3(0, 0.9, 0.25)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = M(new THREE.TubeGeometry(curve, 30, 0.09, 7), m.body); root.add(tube);
  const head = new THREE.Group(); head.position.copy(pts[4]); root.add(head);
  const hm = M(new THREE.SphereGeometry(0.15, 8, 6), m.body); hm.scale.set(1, 0.8, 1.3); head.add(hm);
  for (const s of [-1, 1]) { const fin = M(new THREE.ConeGeometry(0.08, 0.3, 4), m.accent, s * 0.14, 0.05, -0.05); fin.rotation.z = -s * 1.1; head.add(fin); }
  eyesOn(head, m, 0.05, 0.13, 0.07, 0.03);
  return { root, anim: (t, roar, atk) => {
    root.rotation.y = Math.sin(t * 0.8) * 0.3;
    head.rotation.x = -roar * 0.5 + Math.sin(t * 2) * 0.1; head.position.z = pts[4].z + atk * 0.3;
    tube.scale.y = 1 + Math.sin(t * 2) * 0.03 + roar * 0.1;
  } };
};

const spirit: Builder = (_c, m) => {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: m.body.color, transparent: true, opacity: 0.55, emissive: m.glowColor, emissiveIntensity: 0.4, flatShading: true });
  const body = M(new THREE.ConeGeometry(0.28, 0.9, 8, 1, true), mat, 0, 0.55, 0); body.rotation.x = Math.PI; root.add(body);
  const head = M(new THREE.SphereGeometry(0.2, 10, 8), mat, 0, 0.98, 0); root.add(head);
  eyesOn(head, m, 0.02, 0.17, 0.07, 0.035);
  const glow = makeGlowSprite(m.glowColor, 1.4, 0.5); glow.position.y = 0.7; root.add(glow);
  const motes: THREE.Sprite[] = [];
  for (let i = 0; i < 6; i++) { const s = makeGlowSprite(m.glowColor, 0.15, 1); root.add(s); motes.push(s); }
  return { root, anim: (t, roar) => {
    root.position.y = 0.1 + Math.sin(t * 1.6) * 0.08;
    body.rotation.y = t * 0.6;
    motes.forEach((s, i) => { const a = t * 1.5 + (i / 6) * Math.PI * 2; s.position.set(Math.cos(a) * 0.45, 0.6 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.45); });
    (glow.material as THREE.SpriteMaterial).opacity = 0.4 + roar * 0.5;
    head.scale.setScalar(1 + roar * 0.2);
  } };
};

const elemental: Builder = (_c, m) => {
  const root = new THREE.Group();
  const core = M(new THREE.IcosahedronGeometry(0.28, 0), m.body, 0, 0.7, 0); root.add(core);
  const inner = M(new THREE.IcosahedronGeometry(0.16, 0), m.glow, 0, 0.7, 0); root.add(inner);
  root.add(glowAt(m.glowColor, 1.6, 0.7, 0, 0.7, 0));
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) { const s = M(new THREE.OctahedronGeometry(0.07, 0), m.accent); root.add(s); shards.push(s); }
  eyesOn(core, m, 0.03, 0.25, 0.08, 0.035);
  return { root, anim: (t, roar, atk) => {
    core.rotation.y = t * 0.8; core.rotation.x = Math.sin(t) * 0.2; inner.rotation.y = -t * 2;
    core.scale.setScalar(1 + roar * 0.3 + atk * 0.2);
    shards.forEach((s, i) => { const a = t * (1.2 + roar * 3) + (i / 7) * Math.PI * 2; const r = 0.5 + roar * 0.3; s.position.set(Math.cos(a) * r, 0.7 + Math.sin(a * 1.7) * 0.25, Math.sin(a) * r); s.rotation.set(t * 2, t * 3, 0); });
  } };
};

const knight: Builder = (c, m) => {
  const root = new THREE.Group();
  const champion = c.type === 'champion';
  const torso = M(new THREE.CylinderGeometry(0.2, 0.16, 0.45, 8), m.body, 0, 0.62, 0); root.add(torso);
  for (const s of [-1, 1]) root.add(M(new THREE.SphereGeometry(0.11, 7, 5), m.accent, s * 0.24, 0.8, 0));
  const head = M(new THREE.SphereGeometry(0.13, 8, 6), m.body, 0, 1.0, 0); root.add(head);
  head.add(M(new THREE.BoxGeometry(0.2, 0.03, 0.05), m.glow, 0, 0, 0.12));
  if (champion) for (let i = 0; i < 5; i++) { const sp = M(new THREE.ConeGeometry(0.025, 0.1, 4), new THREE.MeshStandardMaterial({ color: '#ffd76a', metalness: 0.9, roughness: 0.2 }), Math.cos((i / 5) * Math.PI * 2) * 0.1, 0.14, Math.sin((i / 5) * Math.PI * 2) * 0.1); head.add(sp); }
  const cape = M(new THREE.PlaneGeometry(0.45, 0.7, 1, 4), new THREE.MeshStandardMaterial({ color: m.accent.color, side: THREE.DoubleSide, flatShading: true }), 0, 0.5, -0.18); root.add(cape);
  for (const s of [-1, 1]) root.add(M(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 6), m.dark, s * 0.09, 0.2, 0));
  const arm = new THREE.Group(); arm.position.set(0.28, 0.75, 0.05); root.add(arm);
  arm.add(M(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), m.body, 0, -0.12, 0));
  const sword = M(new THREE.BoxGeometry(0.04, 0.7, 0.015), new THREE.MeshStandardMaterial({ color: '#e8eefc', metalness: 0.95, roughness: 0.15, emissive: m.glowColor, emissiveIntensity: 0.3 }), 0, 0.1, 0.12); sword.rotation.x = 0.5; arm.add(sword);
  const shield = M(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 6), m.accent, -0.28, 0.65, 0.12); shield.rotation.x = Math.PI / 2; root.add(shield);
  return { root, anim: (t, roar, atk) => {
    arm.rotation.x = -0.3 + Math.sin(t * 1.2) * 0.05 - atk * 1.8 - roar * 0.9;
    cape.rotation.x = 0.15 + Math.sin(t * 2.2) * 0.08;
    root.position.y = Math.sin(t * 1.4) * 0.01;
  } };
};

const insect: Builder = (_c, m) => {
  const root = new THREE.Group();
  for (let i = 0; i < 3; i++) root.add(M(new THREE.SphereGeometry(0.14 + (i === 2 ? 0.06 : 0), 8, 6), m.body, 0, 0.45, 0.25 - i * 0.22));
  const head = root.children[0];
  eyesOn(head, m, 0.05, 0.1, 0.07, 0.035);
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const w = M(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshStandardMaterial({ color: m.glowColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, emissive: m.glowColor, emissiveIntensity: 0.4 }), s * 0.32, 0.6, 0); wings.push(w); root.add(w); }
  const legs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const l = M(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), m.dark, s * 0.2, 0.25, 0.15 - i * 0.15); l.rotation.z = s * 0.7; legs.push(l); root.add(l); }
  return { root, anim: (t, roar, atk) => {
    wings.forEach((w, i) => { w.rotation.x = Math.sin(t * 30) * 0.4 * (0.3 + roar); w.rotation.z = (i ? -1 : 1) * 0.3; });
    legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 6 + i) * 0.2));
    root.position.y = 0.05 + Math.sin(t * 3) * 0.03 + atk * 0.1;
  } };
};

const construct: Builder = (_c, m) => {
  const root = new THREE.Group();
  const torso = M(new THREE.BoxGeometry(0.45, 0.4, 0.3), m.body, 0, 0.6, 0); root.add(torso);
  const core = M(new THREE.SphereGeometry(0.08, 8, 6), m.glow, 0, 0.62, 0.16); root.add(core);
  root.add(glowAt(m.glowColor, 0.6, 0.9, 0, 0.62, 0.17));
  const head = M(new THREE.BoxGeometry(0.26, 0.17, 0.2), m.dark, 0, 0.92, 0); root.add(head);
  head.add(M(new THREE.BoxGeometry(0.2, 0.04, 0.02), m.glow, 0, 0, 0.11));
  const gear = M(new THREE.TorusGeometry(0.16, 0.04, 5, 10), m.accent, 0, 0.75, -0.2); root.add(gear);
  const arms: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const a = M(new THREE.BoxGeometry(0.11, 0.45, 0.12), m.body, s * 0.3, 0.55, 0); arms.push(a); root.add(a); root.add(M(new THREE.BoxGeometry(0.13, 0.35, 0.15), m.dark, s * 0.12, 0.18, 0)); }
  return { root, anim: (t, roar, atk) => {
    gear.rotation.z = t * 2; head.rotation.y = Math.sin(t * 0.8) * 0.3;
    arms.forEach((a, i) => (a.rotation.x = Math.sin(t * 2 + i * 3) * 0.1 - atk * 1.2 - roar * 0.5));
    core.scale.setScalar(1 + Math.sin(t * 6) * 0.2 + roar * 0.6);
  } };
};

const mage: Builder = (_c, m) => {
  const root = new THREE.Group();
  const robe = M(new THREE.ConeGeometry(0.28, 0.8, 8), m.body, 0, 0.4, 0); root.add(robe);
  const hood = M(new THREE.ConeGeometry(0.16, 0.3, 8), m.dark, 0, 0.95, 0); root.add(hood);
  const face = M(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#000' }), 0, 0.88, 0.05); root.add(face);
  eyesOn(face, m, 0.01, 0.08, 0.04, 0.02);
  const staff = new THREE.Group(); staff.position.set(0.28, 0.5, 0.05); root.add(staff);
  staff.add(M(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5), m.dark, 0, 0.1, 0));
  const orb = M(new THREE.IcosahedronGeometry(0.07, 1), m.glow, 0, 0.65, 0); staff.add(orb);
  const og = makeGlowSprite(m.glowColor, 0.7, 0.9); og.position.y = 0.65; staff.add(og);
  const runes: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) { const r = M(new THREE.TorusGeometry(0.04, 0.01, 4, 8), m.glow); root.add(r); runes.push(r); }
  return { root, anim: (t, roar, atk) => {
    staff.rotation.z = -0.15 + Math.sin(t) * 0.05 - atk * 0.6; staff.rotation.x = -roar * 0.4;
    og.scale.setScalar(0.7 + roar * 0.8 + Math.sin(t * 5) * 0.08);
    runes.forEach((r, i) => { const a = t + (i / 5) * Math.PI * 2; r.position.set(Math.cos(a) * 0.45, 0.5 + Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.45); r.rotation.y = t * 2; });
    root.position.y = Math.sin(t * 1.3) * 0.02;
  } };
};

export const MODEL_REGISTRY: Record<string, Builder> = { drake, beast, golem, serpent, spirit, elemental, knight, insect, construct, mage };

export function hasModel(card: CardDef): boolean { return !!card.model && !!MODEL_REGISTRY[card.model]; }

export function createCreature(card: CardDef): Creature3D | null {
  const b = card.model ? MODEL_REGISTRY[card.model] : undefined;
  if (!b) return null;
  const m = mats(card);
  const { root, anim } = b(card, m, new Rng(card.art.seed));
  const wrap = new THREE.Group();
  wrap.add(root);
  if (card.type === 'champion') wrap.scale.setScalar(1.15);
  let t = Math.random() * 10, roarT = 0, atkT = 0;
  return {
    root: wrap,
    update(dt) {
      t += dt;
      roarT = Math.max(0, roarT - dt);
      atkT = Math.max(0, atkT - dt);
      const roar = roarT > 0 ? Math.sin((roarT / 1.2) * Math.PI) : 0;
      const atk = atkT > 0 ? Math.sin((atkT / 0.5) * Math.PI) : 0;
      anim(t, roar, atk);
    },
    roar() { roarT = 1.2; },
    attack() { atkT = 0.5; },
    dispose() {
      wrap.traverse((o) => { const mm = o as THREE.Mesh; mm.geometry?.dispose?.(); });
      for (const mm of Object.values(m)) if (mm instanceof THREE.Material) mm.dispose();
    },
  };
}

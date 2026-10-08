// Physical 3D card: rounded body with real thickness, holographic front shader
// (finish-aware), card back, and an optional pop-out subject layer for true
// parallax depth.

import * as THREE from 'three';
import type { CardDef, Finish } from '../core/types';
import { artLayers, cardBack, cardFace, layout } from '../render/cardFace';
import { RARITIES } from '../data/rarities';
import { canvasTexture } from './core';

export const CARD_W = 1;
export const CARD_H = 1.4;
const THICK = 0.014;

function roundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function faceGeometry(w: number, h: number, r: number): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(roundedShape(w, h, r), 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / w + 0.5; uv[i * 2 + 1] = pos.getY(i) / h + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

let sharedFace: THREE.ShapeGeometry | null = null;
let sharedEdge: THREE.ExtrudeGeometry | null = null;
function geoms() {
  if (!sharedFace) {
    sharedFace = faceGeometry(CARD_W, CARD_H, 0.05);
    sharedEdge = new THREE.ExtrudeGeometry(roundedShape(CARD_W, CARD_H, 0.05), { depth: THICK, bevelEnabled: false, curveSegments: 6 });
    sharedEdge.translate(0, 0, -THICK / 2);
  }
  return { face: sharedFace, edge: sharedEdge! };
}

export const FINISH_CODE: Record<Finish, number> = { NORMAL: 0, FOIL: 1, HOLOGRAPHIC: 2, GOLD: 3, COSMIC: 4, PRISM: 5, SIGNATURE: 6, SECRET: 7 };

const vert = `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = `
uniform sampler2D map; uniform float uTime; uniform int uFinish; uniform vec4 uArt; uniform vec3 uGlow; uniform float uGlowAmt; uniform float uReveal; uniform float uRarity;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0.,2./3.,1./3.))*6.-3.); return c.z * mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
void main(){
  vec4 base = texture2D(map, vUv);
  vec3 col = base.rgb;
  float lum = dot(col, vec3(0.299,0.587,0.114));
  vec3 n = normalize(vN);
  float facing = dot(n, vView);
  vec2 tilt = vView.xy - n.xy;            // view direction relative to card
  float angle = tilt.x * 2.0 + tilt.y * 1.3;
  bool inArt = vUv.x > uArt.x && vUv.x < uArt.x + uArt.z && vUv.y > uArt.y && vUv.y < uArt.y + uArt.w;
  float artMask = inArt ? 1.0 : 0.0;
  // moving specular glare (light passing through the card)
  float band = smoothstep(0.35, 0.0, abs(vUv.x + vUv.y * 0.6 - 0.8 - angle * 1.4));
  col += band * 0.12;
  if (uFinish == 1) { // foil: metallic sheen everywhere
    col += vec3(0.9,0.95,1.0) * band * 0.45 * (0.5 + lum);
    col = mix(col, col * vec3(1.05,1.08,1.15), 0.4);
  } else if (uFinish == 2) { // holographic: rainbow interference on the art
    float h = fract(vUv.x * 1.6 + vUv.y * 0.8 + angle * 1.8 + uTime * 0.03);
    vec3 rb = hsv2rgb(vec3(h, 0.65, 1.0));
    col = mix(col, col + rb * 0.55 * (0.4 + lum), 0.75 * (artMask * 0.85 + 0.15));
  } else if (uFinish == 3) { // gold
    col += vec3(1.0,0.82,0.4) * band * 0.6;
    col = mix(col, col * vec3(1.15,1.0,0.75), (1.0 - artMask) * 0.5);
  } else if (uFinish == 4) { // cosmic: animated starfield in the art window
    vec2 sp = vUv * vec2(60.0, 84.0) + vec2(angle * 6.0, uTime * 0.6);
    float st = step(0.985, hash(floor(sp))) * (0.5 + 0.5 * sin(uTime * 3.0 + hash(floor(sp)) * 40.0));
    vec3 neb = hsv2rgb(vec3(fract(0.7 + vUv.y * 0.3 + angle * 0.3), 0.7, 0.6));
    col = mix(col, col * 0.75 + neb * 0.35 + st, artMask * 0.6);
  } else if (uFinish == 5) { // prism: conic rainbow refraction
    vec2 c = vUv - vec2(0.5 + angle * 0.4, 0.5);
    float a = atan(c.y, c.x) / 6.2831 + 0.5 + uTime * 0.05;
    vec3 rb = hsv2rgb(vec3(fract(a * 3.0), 0.75, 1.0));
    col = mix(col, col + rb * 0.5, 0.55);
  } else if (uFinish == 6) { // signature: golden sparkle
    float sp = step(0.992, hash(floor(vUv * 120.0 + floor(uTime * 4.0))));
    col += vec3(1.0,0.85,0.4) * (band * 0.4 + sp);
  } else if (uFinish == 7) { // secret: crimson scanline + chromatic shimmer
    float scan = smoothstep(0.03, 0.0, abs(fract(vUv.y - uTime * 0.25) - 0.5));
    col = mix(col, vec3(lum) * vec3(1.2,0.35,0.35), 0.35);
    col += vec3(1.0,0.2,0.2) * scan * 0.8 + vec3(1.0,0.3,0.3) * band * 0.35;
  }
  // rarity edge glow
  float edge = 1.0 - smoothstep(0.0, 0.06, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  col += uGlow * edge * uGlowAmt * (0.6 + 0.4 * sin(uTime * 3.0));
  // reveal flash
  col = mix(col, vec3(1.0), uReveal);
  gl_FragColor = vec4(col, base.a);
}`;

export interface CardObject {
  group: THREE.Group;
  front: THREE.Mesh;
  back: THREE.Mesh;
  pop?: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  card: CardDef;
  finish: Finish;
  update(t: number): void;
  setGlow(amount: number): void;
  dispose(): void;
}

const backTexCache = new Map<string, THREE.Texture>();

export function createCardObject(card: CardDef, finish: Finish, cardBackId: string, opts: { hiRes?: boolean; popOut?: boolean } = {}): CardObject {
  const W = opts.hiRes ? 600 : 360;
  const { face, edge } = geoms();
  const pop = !!opts.popOut && (card.type === 'creature' || card.type === 'champion');
  const faceCanvas = cardFace(card, finish, W, pop);
  const tex = canvasTexture(faceCanvas);
  const L = layout(W);
  const r = RARITIES[card.rarity];
  const uniforms = {
    map: { value: tex }, uTime: { value: 0 }, uFinish: { value: FINISH_CODE[finish] },
    uArt: { value: new THREE.Vector4(L.art.x / W, 1 - (L.art.y + L.art.h) / L.H, L.art.w / W, L.art.h / L.H) },
    uGlow: { value: new THREE.Color(r.glow) }, uGlowAmt: { value: r.tier >= 4 ? 0.5 : r.tier >= 2 ? 0.2 : 0 }, uReveal: { value: 0 }, uRarity: { value: r.tier },
  };
  const frontMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true });
  const front = new THREE.Mesh(face, frontMat);
  front.position.z = THICK / 2 + 0.0008;

  let btex = backTexCache.get(cardBackId);
  if (!btex) { btex = canvasTexture(cardBack(cardBackId, 360)); backTexCache.set(cardBackId, btex); }
  const back = new THREE.Mesh(face, new THREE.MeshStandardMaterial({ map: btex, roughness: 0.45, metalness: 0.3 }));
  back.rotation.y = Math.PI;
  back.position.z = -THICK / 2 - 0.0008;

  const edgeColor = finish === 'GOLD' ? '#ffd76a' : finish === 'SECRET' ? '#300000' : r.color;
  const edgeMesh = new THREE.Mesh(edge, new THREE.MeshStandardMaterial({ color: edgeColor, metalness: 0.7, roughness: 0.3 }));

  const group = new THREE.Group();
  group.add(edgeMesh, front, back);
  front.castShadow = true; edgeMesh.castShadow = true;

  let popMesh: THREE.Mesh | undefined;
  if (pop) {
    const { fg } = artLayers(card, W);
    const ptex = canvasTexture(fg);
    const aw = (L.art.w / W) * CARD_W, ah = (L.art.h / L.H) * CARD_H;
    popMesh = new THREE.Mesh(new THREE.PlaneGeometry(aw, ah), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false }));
    const cx = ((L.art.x + L.art.w / 2) / W - 0.5) * CARD_W;
    const cy = (0.5 - (L.art.y + L.art.h / 2) / L.H) * CARD_H;
    popMesh.position.set(cx, cy, THICK / 2 + 0.06);
    popMesh.scale.setScalar(1.06);
    group.add(popMesh);
  }

  return {
    group, front, back, pop: popMesh, uniforms, card, finish,
    update(t: number) { uniforms.uTime.value = t; },
    setGlow(a: number) { uniforms.uGlowAmt.value = a; },
    dispose() { tex.dispose(); frontMat.dispose(); (edgeMesh.material as THREE.Material).dispose(); popMesh && ((popMesh.material as THREE.MeshBasicMaterial).map?.dispose(), popMesh.geometry.dispose()); },
  };
}

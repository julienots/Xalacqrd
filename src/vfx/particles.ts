// GPU-friendly particle system (single Points draw call per emitter).

import * as THREE from 'three';
import { glowTexture, preset } from './core';

export interface EmitOpts {
  count: number;
  pos?: THREE.Vector3;
  spread?: number;          // spawn radius
  speed?: [number, number];
  dir?: THREE.Vector3;      // bias direction
  cone?: number;            // 0..1 randomness around dir (1 = sphere)
  life?: [number, number];
  size?: [number, number];
  colors?: THREE.ColorRepresentation[];
  gravity?: number;
  drag?: number;
  swirl?: number;           // tangential velocity around Y axis
  attract?: number;         // pull towards pos (vortex)
}

export class Particles {
  points: THREE.Points;
  private max: number;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array;
  private life: Float32Array; private maxLife: Float32Array; private baseSize: Float32Array;
  private grav: Float32Array; private drag: Float32Array; private swirl: Float32Array; private attract: Float32Array; private origin: Float32Array;
  private cursor = 0;

  constructor(max = 1500) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.baseSize = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.swirl = new Float32Array(max); this.attract = new Float32Array(max); this.origin = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, scale: { value: 300 } },
      vertexShader: `attribute float size; varying vec3 vColor; uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.a * 1.4, t.a); }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  setScale(viewportHeight: number) { (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = viewportHeight * 0.5; }

  emit(o: EmitOpts) {
    const n = Math.round(o.count * preset().particles);
    const colors = (o.colors ?? ['#ffffff']).map((c) => new THREE.Color(c));
    const p = o.pos ?? new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
      const sp = o.spread ?? 0.1;
      const rx = (Math.random() - 0.5) * 2 * sp, ry = (Math.random() - 0.5) * 2 * sp, rz = (Math.random() - 0.5) * 2 * sp;
      this.pos[i * 3] = p.x + rx; this.pos[i * 3 + 1] = p.y + ry; this.pos[i * 3 + 2] = p.z + rz;
      this.origin[i * 3] = p.x; this.origin[i * 3 + 1] = p.y; this.origin[i * 3 + 2] = p.z;
      const spd = (o.speed?.[0] ?? 0.5) + Math.random() * ((o.speed?.[1] ?? 2) - (o.speed?.[0] ?? 0.5));
      const rand = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const d = o.dir ? o.dir.clone().normalize().lerp(rand, o.cone ?? 0.4).normalize() : rand;
      this.vel[i * 3] = d.x * spd; this.vel[i * 3 + 1] = d.y * spd; this.vel[i * 3 + 2] = d.z * spd;
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
      const life = (o.life?.[0] ?? 0.6) + Math.random() * ((o.life?.[1] ?? 1.6) - (o.life?.[0] ?? 0.6));
      this.life[i] = life; this.maxLife[i] = life;
      this.baseSize[i] = (o.size?.[0] ?? 0.05) + Math.random() * ((o.size?.[1] ?? 0.15) - (o.size?.[0] ?? 0.05));
      this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 0.6; this.swirl[i] = o.swirl ?? 0; this.attract[i] = o.attract ?? 0;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const ix = i * 3;
      if (this.swirl[i] || this.attract[i]) {
        const dx = this.pos[ix] - this.origin[ix], dz = this.pos[ix + 2] - this.origin[ix + 2], dy = this.pos[ix + 1] - this.origin[ix + 1];
        this.vel[ix] += (-dz * this.swirl[i] - dx * this.attract[i]) * dt;
        this.vel[ix + 2] += (dx * this.swirl[i] - dz * this.attract[i]) * dt;
        this.vel[ix + 1] += -dy * this.attract[i] * dt;
      }
      this.vel[ix + 1] -= this.grav[i] * dt;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[ix] *= dr; this.vel[ix + 1] *= dr; this.vel[ix + 2] *= dr;
      this.pos[ix] += this.vel[ix] * dt; this.pos[ix + 1] += this.vel[ix + 1] * dt; this.pos[ix + 2] += this.vel[ix + 2] * dt;
      this.size[i] = this.baseSize[i] * Math.sin(k * Math.PI) * 1.2;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.size.fill(0); }
}

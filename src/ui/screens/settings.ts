import type { Quality } from '../../systems/state';
import { setQuality } from '../../vfx/core';
import { fx2d } from '../fx2d';
import { header, type App, type Screen } from '../app';
import { confirmDialog, h, modal, toast, ui } from '../dom';

export function settingsScreen(app: App): Screen {
  const g = app.game;
  const el = h('div');
  const s = () => g.data.settings;
  const apply = () => { g.applySettings(); g.changed(); };
  function toggle(label: string, desc: string, get: () => boolean, set: (v: boolean) => void) {
    const t = h('button', { class: `toggle ${get() ? 'on' : ''}`, 'aria-label': label, onclick: () => { set(!get()); t.classList.toggle('on', get()); apply(); ui.sfx('tap'); if (label === 'Vibration' && get()) g.haptics.impact('medium'); } });
    return h('div', { class: 'set-row' }, h('div', null, h('b', null, label), h('div', { class: 'muted' }, desc)), t);
  }
  function slider(label: string, get: () => number, set: (v: number) => void) {
    const r = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(get()) }) as HTMLInputElement;
    r.addEventListener('input', () => { set(Number(r.value)); apply(); });
    r.addEventListener('change', () => ui.sfx('reveal', 2));
    return h('div', { class: 'set-row' }, h('b', null, label), r);
  }
  function render() {
    const qualities: Quality[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
    el.replaceChildren(header(app, 'Settings'),
      h('div', { class: 'panel' },
        h('div', { class: 'section-title', style: 'margin-top:0' }, '🔊 Audio'),
        slider('Music', () => s().music, (v) => (s().music = v)),
        slider('Sound effects', () => s().sfx, (v) => (s().sfx = v)),
        h('div', { class: 'section-title' }, '📳 Haptics'),
        toggle('Vibration', 'Light for taps, medium for rare cards, strong for ultra rares.', () => s().haptics, (v) => (s().haptics = v)),
        h('div', { class: 'section-title' }, '🖼️ Graphics'),
        h('div', { class: 'set-row', style: 'flex-direction:column;align-items:stretch' }, h('div', null, h('b', null, 'Quality'), h('div', { class: 'muted' }, 'Lower settings save battery: resolution, particles, shadows, 3D creatures in battle.')),
          h('div', { class: 'row gap', style: 'justify-content:space-between' }, qualities.map((q) => h('button', { class: `chip ${s().quality === q ? 'on' : ''}`, onclick: () => { s().quality = q; setQuality(q); fx2d.intensity = q === 'LOW' ? 0.4 : 1; apply(); render(); toast(`Graphics: ${q}`, 'info'); } }, q)))),
        toggle('Reduced motion', 'Minimise screen animations.', () => s().reducedMotion, (v) => { s().reducedMotion = v; document.documentElement.classList.toggle('reduced-motion', v); }),
        toggle('Fast pack reveal', 'Commons flip automatically when opening boosters.', () => s().fastReveal, (v) => (s().fastReveal = v)),
        toggle('Show FPS', 'Performance counter (restart screen to apply).', () => s().showFps, (v) => { s().showFps = v; const f = document.getElementById('fps'); if (!v) f?.remove(); else if (!f) document.body.appendChild(h('div', { class: 'fps', id: 'fps' }, '')); }),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'section-title', style: 'margin-top:0' }, '💾 Save data'),
        h('div', { class: 'muted' }, `Saved locally on this device${g.save.lastSavedAt ? ` · last save ${new Date(g.save.lastSavedAt).toLocaleTimeString()}` : ''}. Cloud sync ready (no account linked).`),
        h('div', { class: 'row gap wrap mt' },
          h('button', { class: 'btn small', onclick: async () => { await g.save.flush(g.data); toast('Saved ✔', 'good'); render(); } }, 'Save now'),
          h('button', { class: 'btn small', onclick: () => {
            const code = g.save.exportString(g.data);
            const ta = h('textarea', { class: 'input', style: 'height:120px;font-size:10px', readonly: true }, code) as HTMLTextAreaElement;
            modal([h('p', { class: 'modal-text' }, 'Copy this backup code and keep it safe.'), ta, h('button', { class: 'btn primary wide mt', onclick: () => { ta.select(); navigator.clipboard?.writeText(code).then(() => toast('Copied', 'good'), () => toast('Select & copy manually', 'info')); } }, 'Copy')], { title: 'Export save' });
          } }, 'Export'),
          h('button', { class: 'btn small', onclick: () => {
            const ta = h('textarea', { class: 'input', style: 'height:120px;font-size:10px' }) as HTMLTextAreaElement;
            const m = modal([h('p', { class: 'modal-text' }, 'Paste a backup code. This replaces your current progress.'), ta, h('button', { class: 'btn danger wide mt', onclick: async () => {
              const data = g.save.importString(ta.value);
              if (!data) { toast('Invalid backup code', 'bad'); return; }
              g.data = data; await g.save.flush(data); m.close(); toast('Save imported', 'good'); location.reload();
            } }, 'Import')], { title: 'Import save' });
          } }, 'Import'),
          h('button', { class: 'btn small danger', onclick: async () => { if (await confirmDialog('Reset everything?', 'All cards, decks and progress will be erased. This cannot be undone.', 'Erase', true)) { await g.resetAll(); toast('Progress reset', 'info'); app.go('home'); } } }, 'Reset progress'))),
      h('div', { class: 'panel muted', style: 'text-align:center' }, 'XALACARDS v1.0.0 · An original trading card game.', h('br'), `${g.cards.collectible.length} cards · 5 sets · 8 factions`),
    );
  }
  render();
  return { el, refresh: render, onHide: () => g.save.flush(g.data) };
}

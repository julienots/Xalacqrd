// The 2.5D battle table: drag & drop, targeting, AI turns, animated events,
// 3D creature overlay and results.

import type { CardDef, FactionId } from '../../core/types';
import { COSMETIC_BY_ID, rankName, type Reward } from '../../data/content';
import { FACTIONS } from '../../data/factions';
import { RARITIES } from '../../data/rarities';
import { KEYWORDS } from '../../data/effectText';
import { cardFaceURL, cardBackURL, artLayers } from '../../render/cardFace';
import { Battle, createBattle, isUnitCard, type Action, type BattleEvent, type BattleRules, type PlayerIdx, type TargetRef, type Unit } from '../../systems/BattleSystem';
import { CombatAI, type Difficulty } from '../../systems/CombatAI';
import { CreatureOverlay } from '../../vfx/CreatureOverlay';
import { preset, webglAvailable } from '../../vfx/core';
import { hasModel } from '../../vfx/creatures';
import type { App, Screen } from '../app';
import { cardThumb, openCardDetail } from '../cardView';
import { confirmDialog, h, modal, rewardChips, sleep, toast, ui } from '../dom';
import { floatAt, flashScreen, fx2d } from '../fx2d';

export type MatchMode = 'practice' | 'casual' | 'ranked' | 'campaign' | 'tournament' | 'event' | 'test';

export interface MatchSpec {
  mode: MatchMode;
  difficulty: Difficulty;
  deck: string[];
  deckName: string;
  opponent: { name: string; icon: string; factions: FactionId[]; deck: string[] };
  rules?: Partial<BattleRules>;
  stage?: { chapter: number; stage: number };
  onFinish?: (won: boolean) => void;
}

const ME: PlayerIdx = 0, FOE: PlayerIdx = 1;

export function battleScreen(app: App, spec: MatchSpec): Screen {
  const g = app.game;
  const battle: Battle = createBattle([spec.deck, spec.opponent.deck], [g.data.profile.name, spec.opponent.name], (id) => g.cards.get(id), { rules: spec.rules, seed: Date.now() & 0xffffffff });
  const ai = new CombatAI(spec.difficulty);
  battle.takeEvents();

  // ---------------- DOM skeleton ----------------
  const board = COSMETIC_BY_ID[g.data.equipped.board] ?? COSMETIC_BY_ID['bd_obsidian'];
  const foeHero = h('div', { class: 'hero foe' });
  const myHero = h('div', { class: 'hero me' });
  const foeLane = h('div', { class: 'lane foe' });
  const myLane = h('div', { class: 'lane mine' });
  const surface = h('div', { class: 'table-surface', style: `--board: radial-gradient(ellipse at center, ${board.colors[1]}, ${board.colors[0]} 75%)` }, foeLane, h('div', { class: 'mid-line' }), myLane);
  const table = h('div', { class: 'table' }, surface);
  const overlayBox = h('div', { class: 'creature-overlay' });
  const hand = h('div', { class: 'hand' });
  const log = h('div', { class: 'battle-log' });
  const hint = h('div', { class: 'target-hint' });
  const menuBtn = h('button', { class: 'hud-gear', style: 'position:absolute;top:calc(var(--safe-top) + 6px);right:8px;z-index:20', onclick: () => openMenu() }, '☰');
  const el = h('div', { class: 'battle' },
    h('div', { class: 'battle-bg', style: `background: radial-gradient(ellipse at 50% 30%, ${board.colors[1]}55, #05040c 70%)` }),
    foeHero, table, myHero, hand, overlayBox, log, hint, menuBtn);

  let overlay: CreatureOverlay | null = null;
  const unitEls = new Map<number, HTMLElement>();
  let busy = false;
  let ended = false;
  let selectedAttacker: number | null = null;
  let pendingPlay: { handUid: number; index?: number; card: CardDef } | null = null;
  const shownHp: [number, number] = [battle.p(ME).hp, battle.p(FOE).hp];
  const firstBattle = !g.data.tutorial.firstBattle && spec.mode !== 'test';
  let tutorialStep = 0;
  let actionsPlayed = 0;

  // ---------------- rendering ----------------
  function heroEl(i: PlayerIdx): HTMLElement { return (i === ME ? myHero : foeHero).querySelector('.hero-portrait') as HTMLElement; }

  function renderHero(i: PlayerIdx) {
    const p = battle.p(i);
    const isMe = i === ME;
    const av = isMe ? g.profile.avatar() : null;
    const portrait = h('div', { class: 'hero-portrait', 'data-ref': `h:${i}`, style: isMe ? `background:linear-gradient(135deg,${av!.colors[0]},${av!.colors[1]})` : `background:linear-gradient(135deg,${FACTIONS[spec.opponent.factions[0]].color},#120a2a)` },
      isMe ? av!.glyph : spec.opponent.icon, h('span', { class: 'hero-hp' }, String(Math.max(0, shownHp[i]))));
    portrait.addEventListener('click', () => onTargetClick(`h:${i}`));
    const perms = h('div', { class: 'hero-perms' },
      p.terrain ? h('span', { class: 'perm', onclick: () => openCardDetail(app, g.cards.get(p.terrain!.cardId)) }, `🌍 ${g.cards.get(p.terrain.cardId).name}`) : null,
      p.relics.map((r) => h('span', { class: 'perm', onclick: () => openCardDetail(app, g.cards.get(r.cardId)) }, `✨ ${g.cards.get(r.cardId).name}`)));
    const mana = h('div', { class: 'mana' }, Array.from({ length: Math.max(p.maxMana, p.mana) }, (_, k) => h('i', { class: k < p.mana ? 'on' : '' })), h('span', { class: 'mana-txt' }, `${p.mana}/${p.maxMana}`));
    const info = h('div', null, h('div', { class: 'hero-name' }, p.name), h('div', { class: 'hero-sub' }, `🂠 ${p.deck.length} · ✋ ${p.hand.length}`), mana);
    const box = isMe ? myHero : foeHero;
    if (isMe) {
      const canAct = !busy && battle.state.turn === ME && !battle.over;
      const anyMove = canAct && battle.legalActions(ME).some((a) => a.kind !== 'end');
      box.replaceChildren(portrait, info, perms, h('button', { class: `btn ${canAct ? 'primary' : ''} end-turn ${canAct && !anyMove ? 'ready' : ''} ${canAct ? '' : 'disabled'}`, onclick: () => endTurn() }, battle.state.turn === ME ? 'END TURN' : 'ENEMY…'));
    } else {
      box.replaceChildren(portrait, info, perms, h('div', { class: 'foe-hand' }, Array.from({ length: Math.min(10, p.hand.length) }, () => h('i'))));
    }
  }

  function unitEl(u: Unit): HTMLElement {
    let e = unitEls.get(u.uid);
    const c = g.cards.get(u.cardId);
    if (!e) {
      const art = artLayers(c, 240);
      const comp = document.createElement('canvas');
      comp.width = art.bg.width; comp.height = art.bg.height;
      const cx = comp.getContext('2d')!;
      cx.drawImage(art.bg, 0, 0); cx.drawImage(art.fg, 0, 0);
      e = h('div', { class: 'unit', 'data-uid': String(u.uid) }, h('div', { class: 'u-art', style: `background-image:url(${comp.toDataURL('image/jpeg', 0.8)});--rc:${RARITIES[c.rarity].color}` }));
      const ee = e;
      e.addEventListener('click', () => onUnitClick(u.uid, ee));
      let pressT: ReturnType<typeof setTimeout> | null = null;
      e.addEventListener('pointerdown', () => { pressT = setTimeout(() => { pressT = null; preview(c); }, 450); });
      const cancel = () => { if (pressT) clearTimeout(pressT); pressT = null; };
      e.addEventListener('pointerup', cancel); e.addEventListener('pointerleave', cancel);
      e.addEventListener('contextmenu', (ev) => ev.preventDefault());
      unitEls.set(u.uid, e);
    }
    // stats
    const atk = battle.atk(u), hp = battle.hp(u), def = battle.def(u);
    e.querySelectorAll('.u-atk,.u-hp,.u-def,.u-kw').forEach((x) => x.remove());
    e.append(
      h('span', { class: 'u-atk' }, String(atk)),
      h('span', { class: `u-hp ${u.damage > 0 ? 'hurt' : ''}` }, String(hp)),
      def > 0 ? h('span', { class: 'u-def' }, String(def)) : '',
      h('span', { class: 'u-kw' }, u.keywords.map((k) => KEYWORDS[k].icon).join('')),
    );
    e.classList.toggle('frozen', u.frozen > 0);
    e.classList.toggle('shielded', u.shield);
    e.classList.toggle('veiled', battle.has(u, 'veil'));
    e.classList.toggle('bulwark', battle.has(u, 'bulwark'));
    e.classList.toggle('can-attack', u.owner === ME && !busy && battle.state.turn === ME && battle.canAttack(u) && battle.attackTargets(u.uid).length > 0);
    e.classList.toggle('selected', selectedAttacker === u.uid);
    return e;
  }

  function renderLanes() {
    for (const [i, lane] of [[ME, myLane], [FOE, foeLane]] as const) {
      const units = battle.p(i).board;
      const els = units.map(unitEl);
      // keep dying elements until their animation ends
      lane.replaceChildren(...els, ...[...lane.querySelectorAll('.unit.dying')]);
    }
    const alive = new Set([...battle.p(ME).board, ...battle.p(FOE).board].map((u) => u.uid));
    for (const uid of [...unitEls.keys()]) if (!alive.has(uid) && !unitEls.get(uid)!.classList.contains('dying')) unitEls.delete(uid);
    overlay?.sync(alive);
    for (const u of [...battle.p(ME).board, ...battle.p(FOE).board]) {
      const e = unitEls.get(u.uid)!;
      if (overlay && !overlay.has(u.uid) && hasModel(g.cards.get(u.cardId))) overlay.spawn(u.uid, g.cards.get(u.cardId), e);
      else overlay?.rebind(u.uid, e);
    }
  }

  function layoutHand() {
    const cards = [...hand.querySelectorAll<HTMLElement>('.hand-card:not(.dragging)')];
    const n = cards.length;
    const w = hand.clientWidth || window.innerWidth;
    const cw = cards[0]?.offsetWidth || 90;
    const spread = Math.min(cw * 0.78, (w - cw - 20) / Math.max(1, n - 1));
    cards.forEach((c, i) => {
      const off = i - (n - 1) / 2;
      const lifted = c.classList.contains('lifted');
      c.style.transform = `translateX(calc(-50% + ${off * spread}px)) translateY(${lifted ? -40 : Math.abs(off) * 4}px) rotate(${lifted ? 0 : off * 4}deg) scale(${lifted ? 1.25 : 1})`;
      c.style.zIndex = String(lifted ? 40 : 10 + i);
    });
  }

  function renderHand() {
    const p = battle.p(ME);
    hand.replaceChildren(...p.hand.map((hc) => {
      const c = g.cards.get(hc.cardId);
      const playable = !busy && battle.state.turn === ME && battle.canPlay(ME, hc.uid);
      const e = h('div', { class: `hand-card ${playable ? 'playable' : ''}`, 'data-huid': String(hc.uid) }, cardThumb(c, 'NORMAL', { size: 240 }));
      bindHandCard(e, hc.uid, c);
      return e;
    }));
    layoutHand();
  }

  function renderAll() {
    renderHero(ME); renderHero(FOE);
    renderLanes();
    renderHand();
    clearTargeting();
  }

  // ---------------- targeting ----------------
  function clearTargeting() {
    el.querySelectorAll('.targetable,.ally-target').forEach((x) => x.classList.remove('targetable', 'ally-target'));
    myLane.classList.remove('drop-ok');
    if (!pendingPlay && selectedAttacker == null) hint.textContent = '';
  }
  function refEl(ref: TargetRef): HTMLElement | null {
    if (ref.startsWith('h:')) return heroEl(Number(ref.slice(2)) as PlayerIdx);
    return unitEls.get(Number(ref.slice(2))) ?? null;
  }
  function highlight(refs: TargetRef[], ally = false) {
    for (const r of refs) refEl(r)?.classList.add(ally ? 'ally-target' : 'targetable');
  }

  function onUnitClick(uid: number, e: HTMLElement) {
    if (busy || ended) return;
    if (pendingPlay || selectedAttacker != null) { onTargetClick(`u:${uid}`); return; }
    const u = battle.findUnit(uid);
    if (!u) return;
    if (u.owner === ME && battle.state.turn === ME && battle.canAttack(u)) {
      const targets = battle.attackTargets(uid);
      if (!targets.length) { toast('No valid targets', 'bad'); return; }
      selectedAttacker = uid;
      ui.sfx('tap'); ui.haptic('light');
      e.classList.add('selected');
      highlight(targets);
      hint.textContent = 'Choose a target';
      tutorial('attack-target');
    } else preview(g.cards.get(u.cardId));
  }

  async function onTargetClick(ref: TargetRef) {
    if (busy || ended) return;
    if (selectedAttacker != null) {
      const attacker = selectedAttacker;
      if (ref === `u:${attacker}`) { selectedAttacker = null; renderAll(); return; }
      if (!battle.attackTargets(attacker).includes(ref)) { selectedAttacker = null; renderAll(); return; }
      selectedAttacker = null;
      await doAction({ kind: 'attack', attacker, target: ref });
      return;
    }
    if (pendingPlay) {
      const req = battle.requiredTarget(pendingPlay.card)!;
      const valid = battle.validTargets(req, ME);
      if (!valid.includes(ref)) return;
      const pp = pendingPlay;
      pendingPlay = null;
      await doAction({ kind: 'play', handUid: pp.handUid, target: ref, index: pp.index });
    }
  }

  function beginTargeting(handUid: number, card: CardDef, index?: number) {
    const req = battle.requiredTarget(card);
    const valid = req ? battle.validTargets(req, ME) : [];
    if (!req || !valid.length) { doAction({ kind: 'play', handUid, index }); return; }
    pendingPlay = { handUid, index, card };
    highlight(valid, req === 'chooseAlly');
    hint.textContent = isUnitCard(card) ? 'Choose a target for the Herald — tap empty space to skip' : 'Choose a target';
    ui.sfx('tap');
  }

  table.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.unit')) return;
    if (pendingPlay && isUnitCard(pendingPlay.card)) { const pp = pendingPlay; pendingPlay = null; doAction({ kind: 'play', handUid: pp.handUid, index: pp.index }); return; }
    if (pendingPlay || selectedAttacker != null) { pendingPlay = null; selectedAttacker = null; renderAll(); }
  });

  // ---------------- hand drag & drop ----------------
  function bindHandCard(e: HTMLElement, huid: number, card: CardDef) {
    let sx = 0, sy = 0, dragging = false, pressT: ReturnType<typeof setTimeout> | null = null, longPressed = false;
    const down = (ev: PointerEvent) => {
      if (ended) return;
      sx = ev.clientX; sy = ev.clientY; dragging = false; longPressed = false;
      e.setPointerCapture(ev.pointerId);
      pressT = setTimeout(() => { longPressed = true; preview(card); }, 450);
    };
    const move = (ev: PointerEvent) => {
      if (!e.hasPointerCapture(ev.pointerId)) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) > 10) {
        if (pressT) clearTimeout(pressT);
        closePreview();
        if (busy || battle.state.turn !== ME || !battle.canPlay(ME, huid)) return;
        dragging = true; e.classList.add('dragging'); layoutHand();
        if (isUnitCard(card)) myLane.classList.add('drop-ok');
        else { const req = battle.requiredTarget(card); if (req) highlight(battle.validTargets(req, ME), req === 'chooseAlly'); }
      }
      if (dragging) {
        const r = hand.getBoundingClientRect();
        e.style.transform = `translate(calc(-50% + ${ev.clientX - (r.left + r.width / 2)}px), ${ev.clientY - r.bottom + 40}px) rotate(${dx * 0.05}deg) scale(1.15)`;
        el.querySelectorAll('.hover-target').forEach((x) => x.classList.remove('hover-target'));
      }
    };
    const up = async (ev: PointerEvent) => {
      if (pressT) clearTimeout(pressT);
      if (e.hasPointerCapture(ev.pointerId)) e.releasePointerCapture(ev.pointerId);
      if (longPressed) { closePreview(); return; }
      if (!dragging) {
        // tap: lift card / play on second tap
        closePreview();
        if (busy || battle.state.turn !== ME) { preview(card, 1200); return; }
        if (e.classList.contains('lifted')) {
          e.classList.remove('lifted');
          if (!battle.canPlay(ME, huid)) { toast(card.cost > battle.p(ME).mana ? 'Not enough Essence' : 'Cannot play this now', 'bad'); layoutHand(); return; }
          if (isUnitCard(card)) beginTargeting(huid, card);
          else beginTargeting(huid, card);
        } else {
          hand.querySelectorAll('.lifted').forEach((x) => x.classList.remove('lifted'));
          e.classList.add('lifted'); ui.sfx('draw'); tutorial('tap-again');
        }
        layoutHand();
        return;
      }
      dragging = false;
      e.classList.remove('dragging');
      clearTargeting();
      const handTop = hand.getBoundingClientRect().top;
      if (ev.clientY > handTop - 20) { layoutHand(); return; } // dropped back in hand
      if (isUnitCard(card)) {
        // insertion index by x position among my units
        const units = [...myLane.querySelectorAll<HTMLElement>('.unit:not(.dying)')];
        let index = units.length;
        for (let k = 0; k < units.length; k++) { const r = units[k].getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) { index = k; break; } }
        beginTargeting(huid, card, index);
      } else {
        const req = battle.requiredTarget(card);
        if (req) {
          const under = document.elementsFromPoint(ev.clientX, ev.clientY).map((x) => (x as HTMLElement).closest('[data-uid],[data-ref]') as HTMLElement | null).find(Boolean);
          const ref = under ? (under.dataset.uid ? `u:${under.dataset.uid}` : under.dataset.ref!) : null;
          if (ref && battle.validTargets(req, ME).includes(ref)) await doAction({ kind: 'play', handUid: huid, target: ref });
          else beginTargeting(huid, card);
        } else await doAction({ kind: 'play', handUid: huid });
      }
      layoutHand();
    };
    e.addEventListener('pointerdown', down);
    e.addEventListener('pointermove', move);
    e.addEventListener('pointerup', up);
    e.addEventListener('pointercancel', () => { dragging = false; e.classList.remove('dragging'); clearTargeting(); layoutHand(); });
    e.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  // ---------------- preview ----------------
  let previewEl: HTMLElement | null = null;
  function preview(card: CardDef, autoClose = 0) {
    closePreview();
    previewEl = h('div', { class: 'preview-card' }, cardThumb(card, 'NORMAL', { size: 360 }));
    document.body.appendChild(previewEl);
    if (autoClose) { const p = previewEl; setTimeout(() => { if (previewEl === p) closePreview(); }, autoClose); }
  }
  function closePreview() { previewEl?.remove(); previewEl = null; }

  // ---------------- actions & animation ----------------
  async function doAction(a: Action) {
    if (busy || ended) return;
    selectedAttacker = null; pendingPlay = null;
    closePreview();
    if (a.kind === 'play') tutorial('played');
    if (a.kind === 'attack') tutorial('attacked');
    const ok = battle.apply(ME, a);
    if (!ok) { toast('Invalid move', 'bad'); renderAll(); return; }
    busy = true;
    await animate(battle.takeEvents());
    busy = false;
    renderAll();
    if (battle.over) return finish();
    if (battle.state.turn === FOE) runAI();
  }

  async function endTurn() {
    if (busy || ended || battle.state.turn !== ME) return;
    ui.sfx('turn'); ui.haptic('light');
    tutorial('ended');
    await doAction({ kind: 'end' });
  }

  async function runAI() {
    busy = true; renderAll(); busy = true;
    let guard = 0;
    const think = { EASY: 700, NORMAL: 600, HARD: 520, EXPERT: 480, MASTER: 450 }[spec.difficulty];
    while (!battle.over && battle.state.turn === FOE && !ended && guard++ < 40) {
      await sleep(think);
      const a = guard >= 39 ? { kind: 'end' as const } : ai.chooseAction(battle, FOE);
      if (!battle.apply(FOE, a)) battle.apply(FOE, { kind: 'end' });
      await animate(battle.takeEvents());
      renderLanes(); renderHero(FOE);
    }
    busy = false;
    renderAll();
    if (battle.over) finish();
    else tutorial('my-turn');
  }

  function flyCard(cardId: string, from: DOMRect, to: DOMRect, ms = 420): Promise<void> {
    const c = g.cards.get(cardId);
    const f = h('img', { src: cardFaceURL(c, 'NORMAL', 240), style: `position:fixed;z-index:85;left:${from.left}px;top:${from.top}px;width:${from.width}px;border-radius:6px;pointer-events:none;box-shadow:0 20px 40px #000` });
    document.body.appendChild(f);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const anim = f.animate([
      { transform: 'translate(0,0) scale(1) rotate(0)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(1.5) rotate(-6deg)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width}) rotate(0)`, opacity: 0.2 },
    ], { duration: ms, easing: 'cubic-bezier(.3,.8,.3,1)' });
    return anim.finished.then(() => f.remove(), () => f.remove());
  }

  function center(): DOMRect { const w = 160, hh = 224; return new DOMRect(innerWidth / 2 - w / 2, innerHeight * 0.42 - hh / 2, w, hh); }

  async function animate(events: BattleEvent[]) {
    for (const ev of events) {
      if (ended && ev.t !== 'gameOver') break;
      switch (ev.t) {
        case 'turn': {
          const b = h('div', { class: `turn-banner ${ev.p === FOE ? 'foe' : ''}` }, ev.p === ME ? 'YOUR TURN' : 'ENEMY TURN');
          el.appendChild(b); setTimeout(() => b.remove(), 1300);
          ui.sfx('turn'); if (ev.p === ME) ui.haptic('light');
          renderHero(ev.p);
          await sleep(ev.p === ME ? 500 : 350);
          break;
        }
        case 'draw': if (ev.p === ME) ui.sfx('draw'); break;
        case 'burn': if (ev.p === ME) toast(`Hand full — ${g.cards.get(ev.cardId).name} burned`, 'bad'); break;
        case 'fatigue': floatAt(heroEl(ev.p), `Fatigue ${ev.amount}`, '#ff5370'); await sleep(300); break;
        case 'play': {
          const c = g.cards.get(ev.cardId);
          addLog(c);
          if (ev.p === FOE) {
            const from = foeHero.getBoundingClientRect();
            await flyCard(ev.cardId, new DOMRect(from.left + from.width / 2 - 30, from.top, 60, 84), center(), 380);
            preview(c);
            ui.sfx('cardFlip');
            await sleep(900);
            closePreview();
          } else {
            const hc = hand.querySelector(`[data-huid="${ev.uid}"]`) as HTMLElement | null;
            if (hc) { hc.style.visibility = 'hidden'; }
          }
          g.audio.play('cardPlace');
          if (ev.p === ME) renderHero(ME);
          break;
        }
        case 'summon': {
          const c = g.cards.get(ev.cardId);
          const lane = ev.p === ME ? myLane : foeLane;
          const u = battle.findUnit(ev.uid);
          const fake: Unit = u ?? { uid: ev.uid, cardId: ev.cardId, owner: ev.p, baseAtk: c.attack, baseHp: c.hp, bonusAtk: 0, bonusHp: 0, def: c.defense, damage: 0, keywords: [...c.keywords], attacksLeft: 0, sick: true, frozen: 0, shield: c.keywords.includes('aegis'), rekindled: false, equipment: [], faction: c.faction };
          const e = unitEl(fake);
          const existing = [...lane.querySelectorAll('.unit:not(.dying)')];
          lane.insertBefore(e, existing[ev.index] ?? null);
          e.classList.remove('spawn'); void e.offsetWidth; e.classList.add('spawn');
          ui.sfx('summon'); ui.haptic('light');
          fx2d.burstAt(e, [FACTIONS[c.faction].color, FACTIONS[c.faction].color2, '#fff'], 26, 200);
          if (overlay && hasModel(c)) { overlay.spawn(ev.uid, c, e); if (RARITIES[c.rarity].tier >= 3) setTimeout(() => ui.sfx('roar'), 350); }
          if (RARITIES[c.rarity].tier >= 4 || c.type === 'champion') { flashScreen(RARITIES[c.rarity].glow); ui.haptic('medium'); }
          await sleep(ev.token ? 180 : 420);
          break;
        }
        case 'spell': {
          const c = g.cards.get(ev.cardId);
          if (ev.p === ME) actionsPlayed++;
          ui.sfx('spell');
          fx2d.burst(innerWidth / 2, innerHeight * 0.45, [FACTIONS[c.faction].color, FACTIONS[c.faction].color2, '#fff'], 50, 380, 0, 5);
          await sleep(250);
          break;
        }
        case 'equip': { const e = unitEls.get(ev.uid); if (e) fx2d.burstAt(e, ['#ffcf6b', '#fff'], 30); ui.sfx('buff'); await sleep(250); break; }
        case 'terrain': case 'relic': {
          const c = g.cards.get(ev.cardId);
          ui.sfx('reveal', 3); flashScreen(FACTIONS[c.faction].color);
          renderHero(ev.p);
          await sleep(500);
          break;
        }
        case 'trigger': {
          const e = refEl(ev.source);
          if (e) { e.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2) drop-shadow(0 0 12px #ffcf6b)' }, { filter: 'brightness(1)' }], { duration: 400 }); }
          await sleep(180);
          break;
        }
        case 'attack': {
          const a = unitEls.get(ev.from), t = refEl(ev.to);
          if (a && t) {
            const ar = a.getBoundingClientRect(), tr = t.getBoundingClientRect();
            const dx = tr.left + tr.width / 2 - (ar.left + ar.width / 2), dy = tr.top + tr.height / 2 - (ar.top + ar.height / 2);
            ui.sfx('attack');
            overlay?.attack(ev.from);
            await a.animate([
              { transform: 'translate(0,0) scale(1)' },
              { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.1)`, offset: 0.3 },
              { transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(1.15)`, offset: 0.6 },
              { transform: 'translate(0,0) scale(1)' },
            ], { duration: 520, easing: 'ease-in-out' }).finished.catch(() => {});
          }
          break;
        }
        case 'damage': {
          const t = refEl(ev.target);
          if (ev.target.startsWith('h:')) {
            const pi = Number(ev.target.slice(2)) as PlayerIdx;
            shownHp[pi] -= ev.amount;
            const hpEl = t?.querySelector('.hero-hp'); if (hpEl) hpEl.textContent = String(Math.max(0, shownHp[pi]));
            ui.sfx('heroHit');
            if (pi === ME) { ui.haptic('medium'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
          } else ui.sfx('hit');
          if (t) {
            floatAt(t, `-${ev.amount >= 99 ? '☠' : ev.amount}`, '#ff5370');
            fx2d.burstAt(t, ['#ff5370', '#ffcf6b', '#fff'], 16, 220);
            t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
          }
          await sleep(160);
          break;
        }
        case 'heal': {
          const t = refEl(ev.target);
          if (ev.target.startsWith('h:')) { const pi = Number(ev.target.slice(2)) as PlayerIdx; shownHp[pi] += ev.amount; const hpEl = t?.querySelector('.hero-hp'); if (hpEl) hpEl.textContent = String(shownHp[pi]); }
          if (t) { floatAt(t, `+${ev.amount}`, '#4fe08a'); fx2d.burstAt(t, ['#4fe08a', '#fff'], 14, 120); }
          ui.sfx('heal');
          await sleep(140);
          break;
        }
        case 'buff': {
          const t = refEl(ev.target);
          if (t) floatAt(t, ev.keyword ? KEYWORDS[ev.keyword].icon + ' ' + KEYWORDS[ev.keyword].name : ev.def ? `+${ev.def}🛡` : `+${ev.atk}/+${ev.hp}`, '#ffcf6b');
          ui.sfx(ev.keyword === 'aegis' ? 'shield' : 'buff');
          await sleep(140);
          break;
        }
        case 'shieldBreak': { const t = refEl(ev.target); if (t) { floatAt(t, 'Aegis!', '#fff3b0'); t.classList.remove('shielded'); } ui.sfx('shieldBreak'); await sleep(120); break; }
        case 'freeze': { const t = refEl(ev.target); t?.classList.add('frozen'); ui.sfx('freeze'); await sleep(160); break; }
        case 'bounce': { const e = unitEls.get(ev.uid); if (e) { overlay?.kill(ev.uid); await e.animate([{ transform: 'none' }, { transform: 'translateY(-60px) scale(.3)', opacity: 0 }], { duration: 350 }).finished.catch(() => {}); e.remove(); unitEls.delete(ev.uid); } ui.sfx('whoosh'); break; }
        case 'rekindle': { const e = unitEls.get(ev.uid); if (e) { floatAt(e, '♻ Rekindle', '#ffcf6b'); fx2d.burstAt(e, ['#ff9f2e', '#fff'], 30); } ui.sfx('heal'); await sleep(250); break; }
        case 'death': {
          const e = unitEls.get(ev.uid);
          if (e) {
            e.classList.add('dying');
            overlay?.kill(ev.uid);
            fx2d.burstAt(e, ['#2a1a4a', '#8a6bff', '#fff'], 22, 160);
            setTimeout(() => { e.remove(); unitEls.delete(ev.uid); }, 620);
          }
          ui.sfx('death');
          await sleep(260);
          break;
        }
        case 'mana': renderHero(ev.p); floatAt(heroEl(ev.p), '+1 💠', '#8fd8ff'); await sleep(200); break;
        case 'gameOver': break;
      }
    }
  }

  function addLog(c: CardDef) {
    log.prepend(h('div', { class: 'bl', onclick: () => openCardDetail(app, c) }, h('img', { src: cardFaceURL(c, 'NORMAL', 240) })));
    while (log.children.length > 5) log.lastChild!.remove();
  }

  // ---------------- tutorial ----------------
  function tutorial(evName: string) {
    if (!firstBattle) return;
    const steps: [string, string][] = [
      ['start', '👆 Drag a card from your hand onto the board (or tap it twice) to play it. Cards cost Essence 💠.'],
      ['played', '⚔️ Creatures can attack from your next turn. Tap a glowing creature, then tap an enemy.'],
      ['ended', '⏳ The enemy is playing. Watch out for their creatures!'],
      ['my-turn', '💡 Your Essence grows every turn. Bulwark 🛡 creatures must be attacked first. Reduce the enemy hero to 0 HP to win!'],
    ];
    const idx = steps.findIndex(([k]) => k === evName);
    if (idx < 0 || idx !== tutorialStep) return;
    tutorialStep++;
    const tip = h('div', { class: 'toast', style: 'position:absolute;left:12px;right:12px;top:38%;z-index:95;font-size:14px;line-height:1.4' }, steps[idx][1]);
    el.appendChild(tip);
    setTimeout(() => tip.remove(), 5200);
  }

  // ---------------- menu / concede ----------------
  function openMenu() {
    const m = modal([
      h('p', { class: 'modal-text' }, `${spec.deckName} vs ${spec.opponent.name} · ${spec.difficulty}${spec.rules?.label ? ' · ' + spec.rules.label : ''}`),
      h('div', { class: 'muted', style: 'text-align:center;margin-bottom:10px' }, 'Tip: long-press any card to inspect it.'),
      h('button', { class: 'btn wide', onclick: () => { m.close(); } }, 'Resume'),
      h('button', { class: 'btn danger wide mt', onclick: async () => { m.close(); if (await confirmDialog('Concede?', 'You will lose this match.', 'Concede', true)) { battle.concede(ME); finish(); } } }, 'Concede'),
    ], { title: 'Match Menu' });
  }

  // ---------------- results ----------------
  async function finish() {
    if (ended) return;
    ended = true;
    busy = true;
    closePreview();
    const won = battle.state.winner === ME;
    const me = battle.p(ME);
    let rewards: Reward[] = [];
    let rankLine: HTMLElement | null = null;
    if (spec.mode !== 'test') {
      rewards = g.recordMatch({ mode: spec.mode, won, perfect: false, difficulty: spec.difficulty, eventMatch: spec.mode === 'event' }, {
        cardsPlayed: me.stats.cardsPlayed, actionsPlayed, damageDealt: me.stats.damageDealt, creaturesKilled: me.stats.creaturesKilled, damageTaken: me.stats.damageTaken, turns: battle.state.turnNumber,
      });
      if (spec.mode === 'ranked') {
        const r = g.progression.rankedResult(won);
        rankLine = h('div', { class: 'rank-change' }, `${rankName(r.before)} → ${rankName(r.after)} ${'★'.repeat(r.stars)}${'☆'.repeat(Math.max(0, 3 - r.stars))}`);
      }
      if (spec.mode === 'campaign' && won && spec.stage) rewards = [...rewards, ...g.progression.clearStage(spec.stage.chapter, spec.stage.stage)];
      g.progression.checkAchievements();
    }
    if (won) {
      ui.sfx('victory'); ui.haptic('heavy');
      const vx = COSMETIC_BY_ID[g.data.equipped.victory] ?? COSMETIC_BY_ID['vx_fireworks'];
      for (let i = 0; i < 8; i++) setTimeout(() => fx2d.burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.4), [vx.colors[0], vx.colors[1], '#fff'], 60, 380, 200, 4), i * 260);
    } else ui.sfx('defeat');
    g.audio.music('menu');
    const p = g.profile.levelProgress();
    const res = h('div', { class: 'result' },
      h('div', { class: `result-title ${won ? 'win' : 'lose'}` }, won ? 'VICTORY' : 'DEFEAT'),
      h('div', { class: 'muted' }, `${battle.state.turnNumber} turns · ${me.stats.damageDealt} damage dealt · ${me.stats.cardsPlayed} cards played`),
      rankLine,
      h('div', { class: 'panel mt', style: 'width:100%;max-width:420px' },
        rewards.length ? rewardChips(rewards) : h('div', { class: 'muted', style: 'text-align:center' }, spec.mode === 'test' ? 'Test match — no rewards.' : 'No rewards.'),
        h('div', { class: 'row gap mt' }, h('span', { class: 'muted' }, `Lv ${p.level}`), h('div', { class: 'bar gold grow' }, h('div', { class: 'bar-fill', style: `width:${(p.xp / p.need) * 100}%` })))),
      h('div', { class: 'row gap center mt' },
        h('button', { class: 'btn', onclick: () => { res.remove(); spec.onFinish?.(won); app.back(); } }, 'Continue'),
        spec.mode !== 'campaign' && spec.mode !== 'tournament' ? h('button', { class: 'btn primary', onclick: () => { res.remove(); app.replace('battle', { ...spec, opponent: { ...spec.opponent } }); } }, 'Rematch') : null),
    );
    setTimeout(() => el.appendChild(res), won ? 600 : 300);
  }

  // ---------------- mulligan ----------------
  function mulligan(): Promise<void> {
    return new Promise((resolve) => {
      const chosen = new Set<number>();
      const cards = battle.p(ME).hand.map((hc) => {
        const e = h('div', { class: 'mg-card' }, cardThumb(g.cards.get(hc.cardId), 'NORMAL'));
        e.addEventListener('click', () => { ui.sfx('tap'); if (chosen.has(hc.uid)) chosen.delete(hc.uid); else chosen.add(hc.uid); e.classList.toggle('out', chosen.has(hc.uid)); });
        return e;
      });
      const box = h('div', { class: 'mulligan' },
        h('div', { class: 'screen-title', style: 'text-align:center;flex:none' }, battle.state.first === ME ? 'You go first' : 'You go second (+1 Essence on turn 1)'),
        h('div', { class: 'muted' }, 'Tap cards to replace them, then confirm.'),
        h('div', { class: 'mg-cards' }, cards),
        h('button', { class: 'btn primary big', onclick: () => { battle.mulligan(ME, [...chosen]); battle.mulligan(FOE, battle.p(FOE).hand.filter((x) => g.cards.get(x.cardId).cost >= 6).map((x) => x.uid)); box.remove(); resolve(); } }, chosen.size ? 'Replace & Start' : 'Keep & Start'),
      );
      el.appendChild(box);
    });
  }

  let started = false;
  return {
    el, nav: false, hud: false, bg: 'bg-battle',
    async onShow() {
      if (started) return;
      started = true;
      g.audio.music('battle');
      if (webglAvailable() && preset().overlay) { try { overlay = new CreatureOverlay(overlayBox); overlay.start(); } catch (e) { console.warn(e); overlay = null; } }
      renderAll();
      await mulligan();
      renderAll();
      tutorial('start');
      if (battle.state.turn === FOE) runAI();
      else { const b = h('div', { class: 'turn-banner' }, 'YOUR TURN'); el.appendChild(b); setTimeout(() => b.remove(), 1300); }
    },
    async canLeave() {
      if (ended) return true;
      const ok = await confirmDialog('Leave match?', 'Leaving now counts as a defeat.', 'Concede', true);
      if (ok) { battle.concede(ME); await finish(); }
      return false;
    },
    destroy() { overlay?.dispose(); closePreview(); g.audio.music('menu'); },
  };
}

/** Opponent names for generated duelists. */
const OPP_NAMES = ['Varo the Dealer', 'Mistress Quill', 'Old Tamsin', 'Kestrel Vane', 'Juno Ashgrove', 'Brother Halloway', 'Sable Ironwick', 'Pip Lanternfoot', 'Oriel Starling', 'The Grey Duelist', 'Captain Morrow', 'Lady Vesh', 'Taro Kindleback', 'Ysolde Fenwright', 'Magpie', 'Dr. Calder Rook'];
export function opponentFor(factions: FactionId[], seed = Date.now()) {
  const name = OPP_NAMES[Math.abs(seed) % OPP_NAMES.length];
  return { name, icon: FACTIONS[factions[0]].icon, factions };
}
export const backURL = cardBackURL;

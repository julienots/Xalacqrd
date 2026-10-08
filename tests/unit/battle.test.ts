import { CardSystem } from '../../src/systems/CardSystem';
import { createBattle, type PlayerIdx } from '../../src/systems/BattleSystem';
import { CombatAI, buildAIDeck, DIFFICULTIES, type Difficulty } from '../../src/systems/CombatAI';

const cs = new CardSystem();
const lookup = (id: string) => cs.get(id);

function playGame(d0: Difficulty, d1: Difficulty, seed: number) {
  const deckA = buildAIDeck(cs.collectible, { seed, maxRarity: 'MYTHIC' });
  const deckB = buildAIDeck(cs.collectible, { seed: seed + 99, maxRarity: 'MYTHIC' });
  const b = createBattle([deckA, deckB], ['A', 'B'], lookup, { seed });
  const ais = [new CombatAI(d0, seed), new CombatAI(d1, seed + 1)];
  let steps = 0;
  while (!b.over && steps < 600) {
    const p = b.state.turn as PlayerIdx;
    const a = ais[p].chooseAction(b, p);
    const ok = b.apply(p, a);
    if (!ok) b.apply(p, { kind: 'end' });
    b.takeEvents();
    steps++;
    if (b.state.turnNumber > 80) break;
  }
  return { b, steps };
}

describe('BattleSystem', () => {
  it('starts with correct hands and mana', () => {
    const deck = buildAIDeck(cs.collectible, { seed: 1 });
    expect(deck.length).toBe(30);
    const b = createBattle([deck, deck], ['A', 'B'], lookup, { seed: 5, first: 0 });
    expect(b.p(0).hand.length).toBe(4); // 3 + turn draw
    expect(b.p(1).hand.length).toBe(4);
    expect(b.p(0).mana).toBe(1);
    expect(b.state.turn).toBe(0);
  });

  it('rejects illegal actions', () => {
    const deck = buildAIDeck(cs.collectible, { seed: 2 });
    const b = createBattle([deck, deck], ['A', 'B'], lookup, { seed: 9, first: 0 });
    expect(b.apply(1, { kind: 'end' })).toBe(false);
    expect(b.apply(0, { kind: 'attack', attacker: 9999, target: 'h:1' })).toBe(false);
    const expensive = b.p(0).hand.find((h) => cs.get(h.cardId).cost > 1);
    if (expensive) expect(b.apply(0, { kind: 'play', handUid: expensive.uid })).toBe(false);
  });

  it('bulwark forces attacks and combat deals damage', () => {
    const deck = buildAIDeck(cs.collectible, { seed: 3 });
    const b = createBattle([deck, deck], ['A', 'B'], lookup, { seed: 9, first: 0 });
    const bulwarkCard = cs.collectible.find((c) => c.type === 'creature' && c.keywords.includes('bulwark') && c.effects.length === 0)!;
    const attackerCard = cs.collectible.find((c) => c.type === 'creature' && c.keywords.length === 0 && c.effects.length === 0 && c.attack >= 2)!;
    const guard = b.summon(1, bulwarkCard.id)!;
    const att = b.summon(0, attackerCard.id)!;
    att.sick = false;
    expect(b.attackTargets(att.uid)).toEqual([`u:${guard.uid}`]);
    expect(b.attack(0, att.uid, `u:${guard.uid}`)).toBe(true);
    const ev = b.takeEvents();
    expect(ev.some((e) => e.t === 'attack')).toBe(true);
    expect(ev.some((e) => e.t === 'damage')).toBe(true);
  });

  it('AI vs AI games always terminate without errors at every difficulty', () => {
    for (const d of DIFFICULTIES) {
      for (let i = 0; i < 4; i++) {
        const { b } = playGame(d, d, 100 + i * 7);
        expect(b.over || b.state.turnNumber > 80).toBe(true);
      }
    }
  });

  it('stronger AI beats EASY AI most of the time', () => {
    let wins = 0;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const { b } = playGame('EXPERT', 'EASY', 500 + i);
      if (b.state.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(N * 0.65);
  });
});

import type { Effect, Keyword, Trigger, Aura } from '../core/types';
import { FACTIONS } from './factions';

export const KEYWORDS: Record<Keyword, { name: string; icon: string; desc: string }> = {
  bulwark: { name: 'Bulwark', icon: '🛡', desc: 'Enemies must attack this creature first.' },
  surge: { name: 'Surge', icon: '💨', desc: 'Can attack the turn it is played.' },
  siphon: { name: 'Siphon', icon: '🩸', desc: 'Damage dealt by this heals your hero.' },
  volley: { name: 'Volley', icon: '🏹', desc: 'Takes no counter-damage when attacking.' },
  veil: { name: 'Veil', icon: '🌫', desc: 'Cannot be targeted by enemies until it attacks.' },
  blight: { name: 'Blight', icon: '☠', desc: 'Destroys any creature it damages.' },
  frenzy: { name: 'Frenzy', icon: '⚔', desc: 'Can attack twice each turn.' },
  aegis: { name: 'Aegis', icon: '✦', desc: 'The first damage it would take is prevented.' },
  rekindle: { name: 'Rekindle', icon: '♻', desc: 'The first time it dies, it returns with 1 HP.' },
};

export const TRIGGER_NAMES: Record<Trigger, string> = {
  play: 'Herald', death: 'Echo', dawn: 'Dawn', dusk: 'Dusk', attack: 'Strike',
};

export const TRIGGER_DESC: Record<Trigger, string> = {
  play: 'Herald: happens when the card is played.',
  death: 'Echo: happens when this creature dies.',
  dawn: 'Dawn: happens at the start of your turn.',
  dusk: 'Dusk: happens at the end of your turn.',
  attack: 'Strike: happens whenever this creature attacks.',
};

function tgt(t: Effect['target'], plural = false): string {
  switch (t) {
    case 'chooseEnemy': return 'an enemy';
    case 'chooseEnemyUnit': return 'an enemy creature';
    case 'chooseAlly': return 'an allied creature';
    case 'chooseAny': return 'any target';
    case 'randomEnemy': return 'a random enemy';
    case 'allEnemies': return 'all enemy creatures';
    case 'allEnemyAll': return 'all enemies';
    case 'allAllies': return 'your creatures';
    case 'allCreatures': return 'ALL creatures';
    case 'self': return plural ? 'this' : 'this creature';
    case 'enemyHero': return 'the enemy hero';
    case 'ownHero': return 'your hero';
    case 'randomAlly': return 'a random ally';
    default: return '';
  }
}

export function effectText(e: Effect, tokenName?: (id: string) => string): string {
  const a = e.amount ?? 0;
  let body = '';
  switch (e.action) {
    case 'damage': body = `Deal ${a} damage to ${tgt(e.target)}.`; break;
    case 'heal': body = `Restore ${a} HP to ${tgt(e.target)}.`; break;
    case 'buff': body = `Give ${tgt(e.target)} +${a}/+${e.amount2 ?? 0}.`; break;
    case 'draw': body = a === 1 ? 'Draw a card.' : `Draw ${a} cards.`; break;
    case 'mana': body = `Gain ${a} max Essence.`; break;
    case 'summon': {
      const n = e.count ?? 1;
      const nm = tokenName ? tokenName(e.token!) : 'token';
      body = n === 1 ? `Summon a ${nm}.` : `Summon ${n} ${nm}s.`;
      break;
    }
    case 'destroy': body = `Destroy ${tgt(e.target)}.`; break;
    case 'freeze': body = `Freeze ${tgt(e.target)}.`; break;
    case 'shield': body = `Give ${tgt(e.target)} Aegis.`; break;
    case 'grant': body = `Give ${tgt(e.target)} ${KEYWORDS[e.keyword!].name}.`; break;
    case 'armor': body = `Give ${tgt(e.target)} +${a} Defense.`; break;
    case 'bounce': body = `Return ${tgt(e.target)} to its owner's hand.`; break;
  }
  return `${TRIGGER_NAMES[e.trigger]}: ${body}`;
}

export function auraText(a: Aura, scope = 'Your'): string {
  const who = a.faction ? `${scope} ${FACTIONS[a.faction].name} creatures` : `${scope} creatures`;
  const parts: string[] = [];
  if (a.atk || a.hp) parts.push(`+${a.atk}/+${a.hp}`);
  if (a.def) parts.push(`+${a.def} Defense`);
  return `${who} have ${parts.join(' and ')}.`;
}

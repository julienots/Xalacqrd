import type { SetDef } from '../core/types';

export const SETS: SetDef[] = [
  { code: 'ORI', name: 'Origins', index: 1, size: 150, hue: 38, accent: '#ffcf6b', motto: 'Where the first cards were dealt.', symbol: '◈', released: true },
  { code: 'VRS', name: 'Void Rising', index: 2, size: 180, hue: 280, accent: '#c07bff', motto: 'The Hollow opens its eyes.', symbol: '◐', released: true },
  { code: 'CLF', name: 'Celestial Frontier', index: 3, size: 200, hue: 205, accent: '#8fe3ff', motto: 'Beyond the last star-bridge.', symbol: '✦', released: true },
  { code: 'LRL', name: 'Lost Realms', index: 4, size: 200, hue: 150, accent: '#7dffb5', motto: 'Maps that redraw themselves.', symbol: '⬡', released: true },
  { code: 'EVT', name: 'Festival Promos', index: 5, size: 32, hue: 330, accent: '#ff8ad1', motto: 'Limited-time event prints.', symbol: '❖', released: true },
];

export const SET_BY_CODE: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.code, s]));

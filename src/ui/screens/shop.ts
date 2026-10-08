import { PASS_PREMIUM_PRICE } from '../../data/content';
import { CURRENCY_ICON, type Currency, type Price } from '../../systems/EconomySystem';
import { IAP_PRODUCTS } from '../../systems/Monetization';
import type { Offer } from '../../systems/ShopSystem';
import type { App, Screen } from '../app';
import { confirmDialog, h, showRewards, tabs, toast, ui, fmt } from '../dom';
import { packArt } from './boosters';

type Tab = 'featured' | 'boosters' | 'gems' | 'cardbacks' | 'effects' | 'cosmetics' | 'bundles' | 'pass' | 'events';

export function priceLabel(p: Price) {
  return h('span', { class: 'price' }, (Object.entries(p) as [Currency, number][]).map(([k, v]) => h('span', null, `${CURRENCY_ICON[k]} ${fmt(v)}`)));
}

export function shopScreen(app: App, params: { tab?: Tab } = {}): Screen {
  const g = app.game;
  let tab: Tab = params.tab ?? 'featured';
  const el = h('div');

  async function buy(o: Offer) {
    if (g.shop.isSoldOut(o)) { toast('Already owned', 'info'); return; }
    if (!g.economy.canAfford(o.price)) { toast('Not enough currency', 'bad'); return; }
    const ok = await confirmDialog(`Buy ${o.name}?`, `${o.desc}\n\nPrice: ${(Object.entries(o.price) as [Currency, number][]).map(([k, v]) => `${CURRENCY_ICON[k]} ${v}`).join(' + ')}`, 'Buy');
    if (!ok) return;
    const r = g.shop.buy(o);
    if (!r.ok) { toast(r.error ?? 'Failed', 'bad'); return; }
    ui.sfx('purchase'); ui.haptic('medium');
    g.progression.checkAchievements();
    if (r.rewards?.length) await showRewards('Purchased!', r.rewards);
    else toast(`${o.name} unlocked!`, 'good');
    render();
  }

  function offerEl(o: Offer) {
    const sold = g.shop.isSoldOut(o);
    const art = o.rewards[0]?.kind === 'pack' ? packArt((o.rewards[0] as any).id) : h('div', { class: 'of-art', style: `background:linear-gradient(135deg,${o.colors[0]},${o.colors[1]})` }, o.icon);
    return h('div', { class: `offer ${sold ? 'sold' : ''}` },
      o.badge ? h('span', { class: 'of-badge' }, o.badge) : null,
      o.rewards[0]?.kind === 'pack' ? h('div', { style: 'width:70%;margin-bottom:8px' }, art) : art,
      h('div', { class: 'of-name' }, o.name), h('div', { class: 'of-desc' }, o.desc),
      h('button', { class: `btn small ${sold ? '' : 'primary'} wide`, onclick: () => buy(o) }, sold ? 'Owned' : priceLabel(o.price)));
  }

  function gemsTab() {
    return h('div', null,
      h('div', { class: 'panel', style: 'margin-bottom:10px' },
        h('b', null, '💎 Earn Gems for free'),
        h('p', { class: 'muted' }, 'Gems come from daily missions, the daily gift, login streaks, achievements, the XALA Pass and tournaments. Nothing in XALACARDS requires real money: every card can also be crafted with shards.')),
      h('div', { class: 'shop-grid' }, IAP_PRODUCTS.map((p) => h('div', { class: 'offer' },
        h('div', { class: 'of-art', style: 'background:linear-gradient(135deg,#0a2a6a,#4fd8ff)' }, '💎'),
        h('div', { class: 'of-name' }, p.name), h('div', { class: 'of-desc' }, `${p.gems}${p.bonus ? ` + ${p.bonus} bonus` : ''} gems`),
        h('button', { class: 'btn small wide', onclick: async () => { const r = await g.monetization.buy(p.sku); if (r.ok && r.rewards) showRewards('Purchase complete', r.rewards); else toast(r.error ?? 'Unavailable', 'bad', 3500); } }, 'Store unavailable')))),
      h('button', { class: 'btn ghost wide mt', onclick: async () => { const n = await g.monetization.restore(); toast(n ? `${n} purchase(s) restored` : 'No purchases to restore', 'info'); } }, 'Restore purchases'));
  }

  function render() {
    const tabsList: [Tab, string][] = [['featured', '🔥 Featured'], ['boosters', '🃏 Boosters'], ['bundles', '📦 Bundles'], ['events', '🎉 Event'], ['cardbacks', '🎨 Card backs'], ['effects', '✨ Effects'], ['cosmetics', '🧑‍🎨 Cosmetics'], ['pass', '🎟️ Pass'], ['gems', '💎 Gems']];
    let body: Node;
    switch (tab) {
      case 'featured': {
        const giftReady = g.shop.canClaimGift();
        body = h('div', null,
          h('div', { class: 'panel row gap', style: 'margin-bottom:10px;background:linear-gradient(120deg,#3a1a6a,#12082e)' }, h('span', { style: 'font-size:34px' }, '🎁'),
            h('div', { class: 'grow' }, h('b', null, 'Daily Gift'), h('div', { class: 'muted' }, giftReady ? '75 coins + 5 gems, free every day' : 'Come back tomorrow!')),
            h('button', { class: `btn small ${giftReady ? 'primary' : 'disabled'}`, onclick: async () => { const r = g.shop.claimGift(); if (r) { ui.sfx('coins'); await showRewards('Daily Gift', r); render(); } } }, giftReady ? 'Claim' : '✔')),
          h('div', { class: 'section-title' }, 'Daily deals'),
          h('div', { class: 'shop-grid' }, g.shop.deals().map(offerEl)),
          h('div', { class: 'section-title' }, 'Popular'),
          h('div', { class: 'shop-grid' }, [...g.shop.packOffers().slice(0, 2), ...g.shop.bundles().slice(0, 2)].map(offerEl)));
        break;
      }
      case 'boosters': body = h('div', null, h('div', { class: 'shop-grid' }, g.shop.packOffers().map(offerEl)), h('div', { class: 'section-title' }, 'Chests'), h('div', { class: 'shop-grid' }, g.shop.chestOffers().map(offerEl))); break;
      case 'bundles': body = h('div', { class: 'shop-grid' }, g.shop.bundles().map(offerEl)); break;
      case 'events': { const ev = g.events.current(); body = h('div', null, h('div', { class: 'panel', style: `background:linear-gradient(120deg,${ev.def.colors[0]},${ev.def.colors[1]});margin-bottom:10px` }, h('b', null, `${ev.def.icon} ${ev.def.name}`), h('div', null, 'Event packs contain a guaranteed Festival Promo card.')), h('div', { class: 'shop-grid' }, g.shop.eventOffers().map(offerEl))); break; }
      case 'cardbacks': case 'effects': case 'cosmetics': body = h('div', { class: 'shop-grid' }, g.shop.cosmeticOffers(tab).map(offerEl)); break;
      case 'pass': body = h('div', null, h('div', { class: 'shop-grid' }, offerEl(g.shop.passOffer())), h('p', { class: 'muted' }, `Premium unlocks the second reward track for the current season for ${PASS_PREMIUM_PRICE} gems — gems are earned in-game.`), h('button', { class: 'btn wide', onclick: () => app.go('pass') }, 'View XALA Pass')); break;
      case 'gems': body = gemsTab(); break;
    }
    el.replaceChildren(h('h1', { class: 'screen-title', style: 'margin-bottom:8px' }, 'Shop'), tabs(tabsList, tab, (t) => { tab = t; render(); }), body);
  }
  render();
  return { el, refresh: render, onShow: render };
}

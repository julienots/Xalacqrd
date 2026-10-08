// XALACARDS bootstrap: loading screen, systems, screens.

import './styles.css';
import { Game } from './systems/Game';
import { App } from './ui/app';
import { ui, h, toast } from './ui/dom';
import { setQuality, webglAvailable } from './vfx/core';
import { fx2d } from './ui/fx2d';
import { registerScreens } from './ui/screens';
import { runLoading } from './ui/screens/loading';

async function boot() {
  const root = document.getElementById('app')!;
  const game = new Game();
  (window as any).__xala = game; // debug/testing hook

  const loading = runLoading(game);
  try {
    await loading.step(0.15, 'Shuffling the deck...', () => game.cards.collectible.length);
    await loading.step(0.35, 'Preparing your collection...', () => game.load());
    await loading.step(0.55, 'Polishing the holofoil...', async () => {
      setQuality(game.data.settings.quality);
      fx2d.intensity = game.data.settings.quality === 'LOW' ? 0.4 : 1;
      if (game.data.settings.reducedMotion) document.documentElement.classList.add('reduced-motion');
    });
    await loading.step(0.8, 'Opening the vault...', () => loading.warmup());
  } catch (e) {
    console.error(e);
    toast('Failed to load save — starting fresh.', 'bad');
  }

  ui.sfx = (name, arg) => game.audio.play(name, arg);
  ui.haptic = (l) => game.haptics.impact(l);
  const unlock = () => { game.audio.unlock(); game.audio.music('menu'); };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });

  const app = new App(game, root);
  registerScreens(app);
  if (!webglAvailable()) toast('WebGL unavailable: 3D effects disabled', 'bad', 4000);

  // persist on background / close
  const flush = () => game.save.flush(game.data).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden) { flush(); game.audio.music('none'); } else { game.dailyRefresh(); game.audio.music('menu'); } });
  window.addEventListener('pagehide', flush);

  await loading.step(1, 'Ready!', async () => {});
  await loading.finish();
  app.go('home');
  if (game.data.settings.showFps) document.body.appendChild(h('div', { class: 'fps', id: 'fps' }, ''));
}

boot();

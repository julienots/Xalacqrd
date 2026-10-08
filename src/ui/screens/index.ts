import type { App } from '../app';
import { battleScreen } from './battle';
import { boostersScreen, openingScreen } from './boosters';
import { collectionScreen } from './collection';
import { deckEditorScreen, decksScreen } from './decks';
import { eventsScreen } from './events';
import { homeScreen } from './home';
import { chestsScreen, missionsScreen } from './missions';
import { passScreen } from './pass';
import { campaignScreen, playScreen, rankedScreen, tournamentScreen } from './play';
import { profileScreen } from './profile';
import { settingsScreen } from './settings';
import { shopScreen } from './shop';

export function registerScreens(app: App) {
  app.register('home', homeScreen);
  app.register('play', playScreen);
  app.register('campaign', campaignScreen);
  app.register('ranked', rankedScreen);
  app.register('tournament', tournamentScreen);
  app.register('battle', battleScreen);
  app.register('boosters', boostersScreen);
  app.register('opening', openingScreen);
  app.register('collection', collectionScreen);
  app.register('decks', decksScreen);
  app.register('deckEditor', deckEditorScreen);
  app.register('shop', shopScreen);
  app.register('pass', passScreen);
  app.register('events', eventsScreen);
  app.register('profile', profileScreen);
  app.register('settings', settingsScreen);
  app.register('missions', missionsScreen);
  app.register('chests', chestsScreen);
}

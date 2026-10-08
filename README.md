# 🃏 XALACARDS

**Jeu de cartes à collectionner mobile 2.5D / 3D premium** — univers 100 % original (cartes, factions, créatures, effets, UI, sons).

> Ouvrez des boosters physiques… dont les cartes prennent vie.

---

## ✨ Contenu de cette version (v1.0.0)

| Domaine | Ce qui est implémenté |
|---|---|
| 🃏 **Cartes** | **762 cartes à collectionner** + 8 jetons, générées de façon déterministe (identiques sur tous les appareils). Chaque carte : ID, nom, illustration procédurale unique, type, faction, rareté, coût, attaque, défense, PV, effets, description, n° de collection, set, niveau, animation, finitions. |
| 🌈 **Types** | Créature, Action, Équipement, Terrain, Relique, Champion |
| ⭐ **Raretés** | Common → Uncommon → Rare → Epic → Legendary → Mythic → Ancient → Celestial → Secret → Prismatic (cadres, halos et sons différents) |
| ✨ **Finitions** | Normal, Foil, Holographic, Gold, Cosmic, Prism, Signature (signature du personnage), Secret — en CSS (2D) et en shader WebGL (3D) |
| 🗂️ **Sets** | Origins (150), Void Rising (180), Celestial Frontier (200), Lost Realms (200), Festival Promos (32 cartes d'événement) |
| 🧬 **Factions** | 🔥 Ember · 🌿 Verdant · 🌊 Abyss · ⚡ Volt · 🌑 Void · ✨ Aether · 🪨 Titan · 🌌 Cosmos — chacune avec esthétique, archétypes, mots-clés et stratégie |
| 📦 **Boosters** | Starter, Basic, Elite, Cosmic, Secret, Event — cotes affichées, compteur de pitié (Legendary+ garanti en 30 packs) |
| 🎁 **Ouverture 3D** | Pack 3D inspectable au doigt → **swipe pour déchirer** → cartes qui sortent → communes rapides → assombrissement, musique de tension, lueur de rareté à travers le dos → retournement, rayons, onde de choc, particules, caméra en orbite, vibrations. Séquences dédiées Legendary (or), Mythic (cosmique), Ancient (distorsion), Celestial (pluie céleste), Secret (blackout + éclairs rouges + tremblement), Prismatic (arc-en-ciel). Les cartes rares ont un **calque d'illustration en relief** (vraie parallaxe 3D). |
| 📖 **XalaCodex** | Toutes / possédées / manquantes / favoris / nouvelles / rares / par set (pages de 9 avec animation de page complétée) / par faction / par rareté. Recherche (nom, texte, ID) + filtres rareté, type, faction, set, coût, attaque, défense, possession. Inspecteur de carte 2.5D (inclinaison au doigt + gyroscope), crafting avec éclats. |
| ⚔️ **Combat** | Moteur TCG complet 1v1 : deck 30 cartes, main, mulligan, essence (mana) croissante, plateau 6 emplacements, cimetière, terrains, reliques, équipements, mots-clés (Bulwark, Surge, Siphon, Volley, Veil, Blight, Frenzy, Aegis, Rekindle), déclencheurs (Herald, Echo, Dawn, Dusk, Strike), défense (réduction de dégâts), fatigue. |
| 🏟️ **Plateau 2.5D** | Table inclinée en perspective, drag & drop, ciblage, cartes qui volent de la main au plateau, attaques animées, chiffres de dégâts, particules, **créatures 3D qui se matérialisent au-dessus de leur carte et rugissent** (10 modèles procéduraux : dragon, bête, golem, serpent, esprit, élémentaire, chevalier, insecte, automate, mage). |
| 🧠 **IA** | EASY, NORMAL, HARD, EXPERT, MASTER (recherche en faisceau, anticipation de létal) + construction automatique de decks selon le niveau. |
| 🌐 **Modes** | Campagne (4 chapitres × 6 étapes + boss), Practice, Casual, Ranked (Bronze → Grandmaster, saisons de 30 jours, récompenses de fin de saison), Tournoi (bracket à 3 victoires, entrée en ticket), Événement (règles spéciales). |
| 🧱 **Deck builder** | Créer, nommer, ajouter/retirer, filtrer, trier, dupliquer, tester contre l'IA, auto-compléter ; coût moyen, courbe d'essence, types, factions, stats moyennes. |
| 💎 **Boutique** | Mise en avant + offres du jour, boosters, coffres, bundles (achat unique), event packs, dos de cartes, effets, cosmétiques, Pass, Gems. Cadeau quotidien gratuit. |
| 🎟️ **XALA Pass** | 50 paliers, piste FREE et PREMIUM (déblocable avec des gems gagnées en jeu). |
| 🎉 **Événements** | Cosmic Week, Ember Festival, Frozen Realm, Void Eclipse — rotation hebdomadaire, règles spéciales, missions, cartes promo, packs, cosmétiques. |
| 🎁 **Récompenses** | Connexion quotidienne (cycle 7 jours), missions quotidiennes/hebdomadaires, 28 succès, niveaux joueur, récompenses de saison, de tournoi, coffres (Wooden, Silver, Gold, Crystal, Celestial) avec ouverture 3D. |
| 🎨 **Personnalisation** | Dos de cartes, plateaux, avatars, cadres, titres, effets de victoire, effets d'invocation. |
| 💰 **Économie** | 🪙 Coins (packs basiques, coffres) · 💎 Gems (premium, gagnables) · 🎟️ Tickets (tournois, event packs) · 🔹 Éclats (doublons → craft). Non pay-to-win : toute carte peut être craftée. |
| 🔊 **Audio** | Identité sonore 100 % synthétisée (WebAudio) : pose, retournement, déchirure, révélation **différente par rareté** (discret pour Common → montée spectaculaire pour Secret), attaque, victoire, défaite, récompense, boutique ; musique générative (menu / combat / tension). |
| 📳 **Haptique** | Léger (interaction), moyen (rare), fort (ultra-rare) via Capacitor Haptics ; désactivable. |
| 🖼️ **Qualité** | LOW / MEDIUM / HIGH / ULTRA (résolution, particules, ombres, environnement, créatures 3D en combat), mode mouvement réduit, compteur FPS. Un seul contexte WebGL partagé. |
| 💾 **Sauvegarde** | Tout est sauvegardé (collection, decks, monnaies, progression, profil, succès, événements, cosmétiques, paramètres). Enveloppe versionnée + checksum + copie de secours + migrations, export/import, interface `StorageAdapter` / `CloudSyncProvider` prête pour le cloud. |
| 🔐 **Achats** | Architecture IAP complète (provider, validation de reçus, idempotence par ID de transaction, restauration, gestion d'erreurs). **Aucun store n'est branché** : aucun achat fictif n'est accordé et aucun paiement réel n'est possible. |

---

## 🧱 Architecture

```
src/
├─ core/          types, RNG déterministe, bus d'événements
├─ data/          factions, raretés, sets, noms, générateur de cartes, contenu (packs, coffres, cosmétiques, succès, quêtes, événements, pass, ranked, campagne)
├─ systems/       CardSystem · BoosterSystem · CollectionSystem · DeckSystem · BattleSystem · CombatAI
│                 ShopSystem · EconomySystem · InventorySystem · QuestSystem · EventSystem · ProgressionSystem
│                 SaveSystem · AudioSystem · HapticsSystem · ProfileSystem · Monetization · Game (racine)
├─ render/        illustrations procédurales (cardArt) + compositeur de cartes (cardFace)
├─ vfx/           Three.js : renderer partagé + qualité, particules, carte 3D holographique (shader),
│                 BoosterScene, MenuScene, ChestScene, CreatureOverlay, créatures 3D (MODEL_REGISTRY)
└─ ui/            routeur + historique (bouton retour Android), HUD, navigation, composants carte, écrans
```

- **Moteur de combat pur et sérialisable** : l'UI et l'IA utilisent les mêmes actions ; chaque action renvoie des événements animés par l'UI.
- **Ajouter des cartes** : augmenter `size` d'un set ou ajouter un `SetDef` dans `src/data/sets.ts` — le générateur remplit tout. Des cartes faites à la main peuvent être ajoutées à la liste générée.
- **Ajouter des modèles 3D** : enregistrer un builder dans `MODEL_REGISTRY` (`src/vfx/creatures.ts`) — un chargeur glTF peut y être branché sans toucher au gameplay.
- **Brancher un vrai store** : implémenter `StoreProvider` + `ReceiptValidator` (validation serveur) dans `src/systems/Monetization.ts`.
- **Sauvegarde cloud** : implémenter `CloudSyncProvider` dans `src/systems/SaveSystem.ts`.

### Pourquoi pas Unity ?
L'environnement de développement fourni ne dispose ni de l'éditeur Unity ni d'une licence. Le jeu est donc construit en **TypeScript + Three.js (WebGL)** et empaqueté en **application Android native via Capacitor 7** — ce qui permet de le compiler, tester et livrer réellement en APK/AAB.

---

## 🚀 Développement

```bash
npm install
npm run dev          # serveur local (http://localhost:5173)
npm test             # tests unitaires (moteur, IA, boosters, économie, quêtes, sauvegarde, IAP)
npm run build        # bundle de production (dist/)
npm run test:e2e     # E2E Chromium sur le bundle de production (SHOTS=1 pour les captures)
```

## 📦 Build Android (APK + AAB)

Prérequis : JDK 21, Android SDK (platform 35, build-tools 35), `ANDROID_HOME` défini.

```bash
npm run android:sync                 # build web + copie dans android/
cd android
./gradlew assembleDebug              # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease bundleRelease
# → app/build/outputs/apk/release/app-release.apk
# → app/build/outputs/bundle/release/app-release.aab
```

**Signature release** : créez votre propre keystore (ne jamais le committer) :

```bash
cd android
keytool -genkeypair -v -keystore xalacards-release.jks -alias xalacards -keyalg RSA -keysize 2048 -validity 10000
cat > keystore.properties <<EOF
storeFile=xalacards-release.jks
storePassword=VOTRE_MOT_DE_PASSE
keyAlias=xalacards
keyPassword=VOTRE_MOT_DE_PASSE
EOF
```

Sans `keystore.properties`, le build release est produit non signé.

Installation : `adb install app/build/outputs/apk/release/app-release.apk`

---

## 🧪 Tests effectués

- **27 tests unitaires** : base de cartes (unicité, validité, déterminisme), boosters (nombre de cartes, slot garanti, pitié, distribution statistique des raretés/finitions), économie (achat atomique, achats uniques), IAP (aucun gain sans store, reçu invalide rejeté, livraison exactement une fois), quêtes/connexion (réclamation unique), Pass, ranked, succès, craft, sauvegarde (aller-retour complet, récupération après corruption, export/import), combat (règles, Bulwark, actions illégales), **parties IA contre IA à chaque difficulté** (toutes terminent), l'IA EXPERT bat l'IA EASY.
- **E2E (bundle de production identique à l'APK)** : lancement + chargement, menu 3D, ouverture complète d'un booster avec révélation Legendary, Codex (recherche, inspecteur), deck builder, partie complète contre l'IA jusqu'à l'écran de résultat, achat boutique + refus d'IAP sans store, Pass / événements / missions / coffre / profil, persistance de la sauvegarde après rechargement, absence d'erreurs JS.
- **Build Android** : APK debug, APK release signé (vérifié avec `apksigner`), AAB signé — targetSdk 35, minSdk 23, orientation portrait.

### Limites connues (honnêtes)
- Pas d'émulateur Android disponible dans l'environnement de build (pas de KVM) : l'installation et les performances sur un appareil réel n'ont pas pu être mesurées ici. Le contenu web de l'APK a été testé dans Chromium (moteur de l'Android WebView).
- Le classement, les tournois et les événements se jouent contre l'IA (pas de serveur multijoueur en ligne).
- Les illustrations sont procédurales (générées par code) et non peintes à la main ; les modèles 3D sont low-poly procéduraux.
- Aucun store d'achats réels n'est configuré (volontairement).

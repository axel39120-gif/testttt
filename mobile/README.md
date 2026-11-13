# Racing Journey — application mobile

Le jeu web (`../Racing Journey/`) emballé en application Android et iOS avec [Capacitor](https://capacitorjs.com).
L'application contient tout le jeu, avec la même apparence que sur le web. Elle s'affiche en paysage et en plein écran, et fonctionne hors ligne.
Les parties sont sauvegardées sur le téléphone (stockage de l'application).

**Le jeu se développe toujours dans `Racing Journey/`.** Le dossier `mobile/` ne fait que l'embarquer : après chaque modification du jeu, reconstruire l'application.

## Construire l'APK Android (Windows)

Prérequis, déjà installés sur ce PC : Node.js, JDK 21 (`JAVA_HOME`) et SDK Android (`ANDROID_HOME`).

```bash
cd mobile
npm install          # première fois seulement
npm run apk          # copie le jeu web, synchronise, construit l'APK de debug
```

L'APK est créé dans `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

Pour l'installer sur un téléphone Android :
- **Par câble** : activer le débogage USB, brancher le téléphone, puis lancer `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
- **Sans câble** : copier le fichier `.apk` sur le téléphone et l'ouvrir. Il faut autoriser l'installation d'applications de sources inconnues.

## Autres commandes

| Commande | Effet |
|---|---|
| `npm run web` | Copie le jeu web dans `www/` (sans `tests/`, les `.md`, `diagnostic.html` ni `_headers`) |
| `npm run sync` | `web`, puis met à jour les projets Android et iOS |
| `npm run android` | `sync`, puis ouvre le projet dans Android Studio (s'il est installé) |
| `npx capacitor-assets generate --android --ios` | Régénère les icônes et les écrans de démarrage depuis `assets/logo.png` |

## Réglages propres à l'application

- **Android** : orientation paysage dans `android/app/src/main/AndroidManifest.xml` (`sensorLandscape`), plein écran immersif dans `MainActivity.java`.
- **iOS** : orientation paysage et barre d'état masquée dans `ios/App/App/Info.plist`.
- **Identifiant** : `com.racingjourney.f1dreams` (`capacitor.config.json`). C'est un nom provisoire, à remplacer avant toute publication, car il ne peut plus changer ensuite.

## Pas encore fait

- **iOS** : la compilation demande un Mac avec Xcode (`npx cap open ios`), puis un compte Apple Developer pour installer l'app sur un iPhone ou la publier.
- **Google Play** : la publication demande une clé de signature « release » et un compte Google Play Console. Le format attendu est un `.aab` (`gradlew bundleRelease`).

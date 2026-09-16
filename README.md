# ForgeKit Offline 2.0

Figma-inspired offline design toolkit for old Android tablets.

## Included
- 520+ local vector icon entries with preview/search/categories and HTML/CSS copy.
- 300 local typography presets with live preview, weight and letter-spacing controls.
- Color Matching Studio with five harmony families and WCAG contrast checking.
- Linear/radial gradient generator with up to 4 stops and CSS export.
- Logo Canvas with icon + text + color/background and PNG/SVG/HTML/CSS export.
- Local favorites via localStorage.
- Figma-inspired dark tablet UI.
- No API calls, CDN, or runtime internet dependency.

## Important asset note
The 520+ icon catalog is local SVG data. The 300 typography entries are local CSS/system font presets, not 300 downloaded Google Font binaries. To ship actual font files, add licensed `.ttf`/`.otf` files under `www/assets/fonts/` and reference them with `@font-face`.

## Android 5.1
The project uses Capacitor 2.x dependencies for an API-21-oriented build path. A final APK still requires a matching Android SDK/Gradle/JDK toolchain.

## Build
```bash
npm install
npx cap add android
npm run sync
npm run build-apk-debug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Obtenir l'APK automatiquement avec GitHub

Le projet contient maintenant `.github/workflows/build-apk.yml`.

1. Crée un dépôt GitHub nommé `ForgeKit-Offline`.
2. Envoie **le contenu de ce dossier `forgekit`** dans la branche `main` (pas le ZIP lui-même).
3. Ouvre l'onglet **Actions**.
4. Sélectionne **Build ForgeKit APK**.
5. Appuie sur **Run workflow**.
6. À la fin du workflow, ouvre le job terminé et récupère l'artefact **ForgeKit-Offline-APK**.
7. L'artefact contient `ForgeKit-Offline-debug.apk`.

Le workflow génère le projet Android Capacitor, force le minimum Android à API 21 et compile une APK debug. Aucun serveur web ou API n'est nécessaire au fonctionnement de l'application.

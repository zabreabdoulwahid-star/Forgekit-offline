# ForgeKit Offline — obtenir l'APK sans PC de développement

## A. Préparer GitHub

1. Ouvre https://github.com/
2. Connecte-toi.
3. `+` → `New repository`.
4. Nom : `ForgeKit-Offline`.
5. Choisis `Public` ou `Private`.
6. Crée le dépôt.

## B. Envoyer le projet

Important : GitHub doit recevoir les fichiers du dossier `forgekit`, notamment :

- `www/`
- `package.json`
- `capacitor.config.json`
- `.github/workflows/build-apk.yml`

Tu peux utiliser l'interface GitHub dans le navigateur pour envoyer les fichiers.

## C. Lancer la compilation

Après l'envoi :

`Actions` → `Build ForgeKit APK` → `Run workflow` → `Run workflow`.

Attends que le workflow passe au vert.

## D. Récupérer l'APK

Ouvre le workflow terminé. Dans `Artifacts`, ouvre/télécharge :

`ForgeKit-Offline-APK`

À l'intérieur :

`ForgeKit-Offline-debug.apk`

## E. Installer

Transfère l'APK sur ton téléphone/tablette et ouvre-le. Android peut demander l'autorisation d'installer une application provenant d'une source externe.

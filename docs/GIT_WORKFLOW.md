# Guide d'utilisation Git pour Hyperviseur

## Depot Codex France

Pour le chantier de migration Ignition France avec Codex, le depot cible propose est:

```text
https://github.com/LucBhub/HI-france-cdex.git
```

Le clone local inspecte ici pointe encore vers l'ancien depot:

```bash
git remote -v
```

Avant le premier push vers le depot Codex France, ajouter un remote dedie:

```bash
git remote add cdex https://github.com/LucBhub/HI-france-cdex.git
```

Important: l'ancien depot `Hyperviseur` contient des secrets dans son historique. GitHub Push Protection peut donc refuser un push qui transporte tout l'historique. Pour initialiser `HI-france-cdex`, utiliser une branche orpheline sanitisee ou un historique reecrit, jamais un push brut de l'ancien historique.

Option recommandee pour initialiser le nouveau depot avec l'etat courant nettoye:

```bash
git switch --orphan codex/socle-architecture-sandbox-clean
git add .
git commit -m "Add France dry-run command sandbox"
git push -u cdex codex/socle-architecture-sandbox-clean
```

Option possible seulement apres nettoyage complet de l'historique:

```bash
git checkout -b codex/socle-architecture-sandbox
git push -u cdex codex/socle-architecture-sandbox
```

Ne pas pousser directement sur `main` tant que le socle dry-run n'a pas ete relu.

## Documentation du socle dry-run

Le premier lot France ajoute un socle sans commande live:

- `docs/SANDBOX_DRY_RUN.md`: demarrage, variables, endpoints et tests du sandbox.
- `docs/IGNITION_COMMAND_MATRIX.md`: matrice initiale des commandes extraites de l'export Ignition.
- `docs/IGNITION_PARITY_AUDIT.md`: audit de parite Ignition France vs application web.

Les commandes terrain restent bloquees par defaut avec:

```env
COMMAND_MODE=dry_run
COMMAND_LIVE_ENABLED=false
```

Ce document récapitule les commandes à lancer pour sauvegarder (commit) et mettre à jour le projet.

## 🛠️ Réparer la commande `git` (À faire une seule fois)

Pour ne pas avoir à taper le chemin complet à chaque fois, lancez cette commande **une seule fois** dans PowerShell :

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Git\cmd", "User")
```

_Puis fermez et rouvrez votre terminal._ Ensuite, vous pourrez juste taper `git` au lieu de `& "C:\Program..."`.

---

## 1. Sauvegarder ses modifications (Au quotidien)

Quand vous avez fini une tâche ou une journée de travail :

1.  **Voir ce qui a changé** (Optionnel) :
    ```bash
    git status
    ```
2.  **Ajouter tout le travail** :
    ```bash
    git add .
    ```
3.  **Enregistrer (Commit)** avec un message clair :
    ```bash
    git commit -m "Description de ce que j'ai fait"
    ```
4.  **Envoyer le code (Push) vers GitHub** :
    ```bash
    git push
    ```

---

## 2. Fusionner et Déployer (Le "Merge")

Pour ne pas casser la production, on travaille idéalement sur des "branches" (copies) et on "fusionne" vers le serveur principal.

### Étape 1 : Créer une branche pour travailler

Avant de commencer une nouvelle fonctionnalité (ex: page météo) :

```bash
git checkout -b nouvelle-fonctionnalite
```

_Vous travaillez, vous faites vos git add / commit / push normalement sur cette branche._

### Étape 2 : Le "Merge" (Sur GitHub)

Une fois votre travail fini et envoyé (`git push`) :

1.  Allez sur la page GitHub de votre projet.
2.  GitHub vous proposera un bouton jaune "**Compare & pull request**". Cliquez dessus.
3.  Vérifiez les changements et cliquez sur **Create pull request**.
4.  Une fois validé (par vous ou un collègue), cliquez sur le bouton vert **Merge pull request**.

🚀 **C'est ce clic sur "Merge" qui déclenchera automatiquement la mise à jour de la VM** (une fois que l'IT nous aura donné les accès).

---

## 3. Lexique (Pour comprendre)

Imaginez que Git est comme un jeu vidéo avec des sauvegardes :

- **COMMIT ("Sauvegarder")** :  
  C'est faire une sauvegarde ("Save Game") sur votre PC.  
  _Si vous faites une bêtise plus tard, vous pourrez recharger cette sauvegarde._

- **PUSH ("Envoyer / Uploader")** :  
  C'est envoyer votre sauvegarde sur le Cloud (GitHub).  
  _C'est comme ça que vous partagez votre progression avec les autres (et la VM)._

- **PULL ("Récupérer / Télécharger")** :  
  C'est télécharger la dernière sauvegarde depuis le Cloud.  
  _À faire si un collègue a travaillé de son côté et que vous voulez récupérer son travail sur votre PC._

- **MERGE ("Fusionner")** :  
  C'est mélanger deux sauvegardes ensemble.  
  _Exemple : Vous avez construit le toit, votre collègue a fait les fondations -> On "Merge" pour avoir la maison complète._

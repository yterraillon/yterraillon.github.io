# Restructuration de `yterraillon.github.io`

## Contexte

Le repo a accumulé quatre rôles distincts au fil des travaux, sans arborescence pensée pour les
accueillir ensemble :

1. **Landing page perso** (`dimin.dev`) → `index.html` + `app/css/` à la racine
2. **Site vitrine + pages légales de enbref.app** → `pages/en-bref/`
3. **Publication de données** (le récap quotidien de l'app En Bref) → `cdn/en-bref/data/latest-recap.json`
4. **CDN d'assets** pour des apps externes (Checquy, En Bref iOS) → `cdn/*`

Constats de l'analyse (61 fichiers, 789 commits, 3.7 Mo de `.git`) :

- **~750 commits sur 789 sont des écritures de bot** (`Updated latest Recap`, `Muscle Routine - …`,
  `Meal selection - …`) sur un seul fichier JSON. Les 40 commits « humains » sont noyés. Le poids
  n'est pas un problème (3.7 Mo), la **lisibilité de l'historique** l'est.
- **`cdn/` mélange trois natures d'objets** : des assets de marque consommés par des apps externes
  (`checquy/`, `en-bref/`), des images qui appartiennent en fait au site vitrine
  (`homepage/`, `quake-3/`, `valheim/`, `the-coding-nook/`), et des données mutables (`*/data/*.json`).
- **`the-coding-nook/` est l'ancienne marque** : son `logo.png` et son `hero.jpg` sont utilisés
  aujourd'hui par la landing Dimin.dev (`index.html:70`, `app/css/styles.css`). Le nom du dossier ment.
- **Nommage incohérent** : `en-bref` (dossiers) vs `enbref.app` (domaine) vs `EnBrefLogo_…` (fichiers).
- **`app/css/`** est un vestige d'une tentative de « Feature Sliced architecture » : c'est en réalité
  la CSS de la seule landing page, et `output.css` (build Tailwind) est committé et régénéré à la main.
- **Aucun fichier `CNAME`, aucun workflow GitHub Actions** dans le repo. Le bot des récaps pousse
  via l'API GitHub (compte `Yann T`), probablement depuis n8n.
- Deux bugs mineurs relevés au passage : `pages/en-bref/index.html:16` utilise des classes Tailwind
  (`bg-sky-200 rounded-xl …`) alors que la page ne charge jamais `output.css` ; et le footer de
  `index.html:86-88` pointe vers `href="#"` (liens morts) alors que les pages légales existent.

**Objectif** : une arborescence qui accueille N petits sites statiques (dont un futur `ampr`) sans
retoucher l'existant à chaque ajout, tout en gardant le rôle CDN, en isolant les écritures de bot,
et en restant sur GitHub Pages (gratuit, intégré à la CI).

Décisions déjà arbitrées avec l'utilisateur :
- Les URLs `/cdn/...` **peuvent** être modifiées (les consommateurs seront mis à jour), à condition
  de fournir la liste exacte des URLs qui changent.
- Les récaps doivent être **isolés dans une branche dédiée**.
- Le routage DNS actuel (`dimin.dev` / `enbref.app`) est **à vérifier** → le plan inclut une section
  de vérification et deux scénarios de routage.
- `savetea`, `muscle-routine`, `meal-picker` sont **à supprimer**.

## Regard critique

Le multi-rôle n'est pas un défaut en soi ici : les quatre rôles partagent le même cycle de vie
(statique, public, versionné, gratuit) et la même chaîne de déploiement. Ce qui coince, ce n'est pas
« un repo pour quatre choses », c'est que **rien dans l'arborescence ne dit qui est qui**, et que le
rôle « données mutables » (écritures quotidiennes) pollue le rôle « code » (écritures rares).

La séparation à faire n'est donc pas *par domaine* mais **par cycle de vie** :

| Rôle | Fréquence d'écriture | Auteur | Emplacement cible |
|---|---|---|---|
| Sites statiques | rare, manuel | humain | `sites/` sur `main` |
| Assets CDN | rare, manuel | humain | `cdn/` sur `main` |
| Données publiées | quotidien, auto | bot | branche `data` |

Deux limites de GitHub Pages à assumer explicitement (à documenter, pas à contourner) :
- **Un seul domaine custom par repo.** Deux domaines racines (`dimin.dev` + `enbref.app`) sur le même
  repo Pages ne sont pas possibles sans un proxy devant (Cloudflare).
- **Pas de contrôle du `Cache-Control`** (~10 min imposées) ni de redirections serveur. Pour le rôle
  CDN, cela veut dire : pas de renommage silencieux, et versionner par le nom de fichier si un asset
  doit changer sans casser les caches clients.

## Cible

### Arborescence source

```
yterraillon.github.io/            (branche main)
├── .github/workflows/
│   └── deploy-pages.yml          # build Tailwind + assemblage dist + deploy Pages
├── sites/
│   ├── dimin.dev/                # publié à la racine du domaine
│   │   ├── index.html
│   │   ├── 404.html
│   │   ├── css/site.css          # source Tailwind (@import "../../shared/css/base.css")
│   │   └── assets/images/        # logo.png, hero.jpg, coloors.png, patternpad.png,
│   │                             # tube2text.png, unsplash.png, quake-3.png, valheim.png
│   ├── enbref.app/               # publié sous /enbref/
│   │   ├── index.html
│   │   ├── css/site.css
│   │   ├── about.html
│   │   └── legal/
│   │       ├── privacy-policy.html
│   │       ├── terms-of-use.html
│   │       ├── legal-notice.html
│   │       └── app-tracking-policy.html
│   └── ampr.app/                 # gabarit prêt à l'emploi pour le prochain site
│       ├── index.html
│       └── css/site.css
├── cdn/                          # contrat public — copié tel quel dans dist/cdn/
│   ├── enbref/
│   │   ├── logos/                # EnBrefLogo_{Black,White}_{White,Black,Transparent}BG.png
│   │   └── ios/AppIcon.appiconset/
│   └── checquy/
│       ├── images/               # bishop, knight, myfanwy, pawn, rook
│       └── icons/rook.ico
├── shared/
│   └── css/base.css              # @import "tailwindcss" + tokens (repris de pages/en-bref/styles.css)
├── docs/
│   ├── ARCHITECTURE.md           # les 3 cycles de vie, le mapping source → URL
│   ├── CDN.md                    # contrat des URLs publiques + qui les consomme
│   └── ADD-A-SITE.md             # recette « ajouter un site » en 4 étapes
├── package.json / package-lock.json
├── README.md
└── .gitignore                    # réécrit (web), à la place du .gitignore Visual Studio de 7 Ko
```

### Branche `data` (orphan)

```
data/                             (branche orpheline, écrite par le bot uniquement)
└── enbref/
    └── latest-recap.json
```

Branche **orpheline** (`git checkout --orphan data`) : elle ne porte aucun historique de site, reste
minuscule, et les commits quotidiens n'apparaissent plus dans `git log main`.

### Mapping source → URL publiée

| Source | URL publiée |
|---|---|
| `sites/dimin.dev/**` | `/` |
| `sites/enbref.app/**` | `/enbref/` |
| `sites/ampr.app/**` | `/ampr/` |
| `cdn/**` | `/cdn/**` |
| branche `data` : `enbref/latest-recap.json` | `/data/enbref/latest-recap.json` |

Le nom de dossier `sites/<domaine>/` documente de lui-même à quel domaine le site est destiné, et le
mapping vers un sous-chemin est déclaré au seul endroit qui compte : le workflow.

### Pourquoi un workflow GitHub Actions devient nécessaire

GitHub Pages en mode « deploy from a branch » ne sert **qu'une seule branche**. Dès lors que les
récaps vivent sur une branche `data` séparée (décision actée), il faut passer en mode « GitHub
Actions » pour assembler les deux sources en un artefact unique. Le workflow rend au passage trois
services : il compile Tailwind (fini le `output.css` committé à la main), il découple l'arborescence
source de l'arborescence d'URLs, et il rend l'ajout d'un site déclaratif.

`deploy-pages.yml`, déclenché sur `push` vers `main` **et** vers `data` :

1. `checkout` de `main`
2. `npm ci` puis `npx @tailwindcss/cli -i sites/<x>/css/site.css -o dist/<x>/css/site.css --minify` pour chaque site
3. copie de `sites/dimin.dev/**` → `dist/`, `sites/enbref.app/**` → `dist/enbref/`, `sites/ampr.app/**` → `dist/ampr/`
4. copie de `cdn/**` → `dist/cdn/`
5. `checkout` de la branche `data` dans `dist/data/`
6. `actions/upload-pages-artifact` + `actions/deploy-pages`

Un déclencheur `workflow_dispatch` est ajouté pour pouvoir redéployer à la main.

### Routage des domaines — à vérifier avant migration

À confirmer côté GitHub (Settings → Pages) et côté registrar/DNS avant de committer un `CNAME` :

- **Scénario A — un seul domaine (`dimin.dev`)** : `CNAME` = `dimin.dev`, le site En Bref vit sur
  `dimin.dev/enbref/`, et `enbref.app` (s'il existe) redirige au niveau DNS/registrar vers cette URL.
  C'est le scénario par défaut du plan, celui qui ne demande aucune infra supplémentaire.
- **Scénario B — deux domaines via Cloudflare** : `enbref.app` est proxifié par Cloudflare avec une
  règle de réécriture `enbref.app/*` → `yterraillon.github.io/enbref/*`. L'arborescence cible ne
  change pas d'un octet ; seule la config Cloudflare s'ajoute.

L'arborescence proposée fonctionne dans les deux cas — c'est la raison pour laquelle le mapping
`sites/enbref.app/` → `/enbref/` est un sous-chemin plutôt qu'une racine.

## Migration

Les déplacements se font en `git mv` pour préserver l'historique des fichiers.

**Étape 0 — vérifications (aucune écriture)**
- Settings → Pages : source actuelle, domaine custom configuré, état HTTPS
- DNS de `dimin.dev` et `enbref.app` (enregistrements A / CNAME)
- Identifier le job n8n qui écrit `latest-recap.json` et son token/branche cible
- Recenser les consommateurs des URLs `/cdn/...` : app En Bref iOS, app Checquy, workflows n8n

**Étape 1 — suppressions**
`git rm -r cdn/savetea cdn/muscle-routine cdn/meal-picker`

**Étape 2 — squelette et sites**
- Créer `sites/`, `shared/css/base.css` (fusion de `pages/en-bref/styles.css` et `app/css/styles.css`)
- `git mv index.html sites/dimin.dev/index.html`
- `git mv pages/en-bref/*.html sites/enbref.app/` puis répartir les 4 pages légales dans `legal/`
- `git mv cdn/the-coding-nook/images/{logo.png,hero.jpg,…} sites/dimin.dev/assets/images/`
- `git mv cdn/homepage/images/* cdn/quake-3/images/logo.png cdn/valheim/images/logo.png sites/dimin.dev/assets/images/`
- Supprimer `app/` (dont `output.css`, désormais généré par la CI) et `pages/`
- Réécrire les chemins relatifs dans les HTML (`./cdn/the-coding-nook/images/logo.png` →
  `./assets/images/logo.png`, `../../cdn/en-bref/images/…` → `/cdn/enbref/logos/…`)
- Corriger au passage les deux bugs relevés : charger la CSS compilée dans
  `sites/enbref.app/index.html`, et brancher les liens du footer de la landing sur les pages légales
- Créer `sites/ampr.app/` à partir d'un gabarit minimal

**Étape 3 — CDN**
- `git mv cdn/en-bref cdn/enbref`, puis `images/` → `logos/` et `images/ios/` → `ios/`
- Supprimer les doublons repérés : `cdn/en-bref/icons/EnBrefLogo_Black_WhiteBG.png` est identique à
  celui de `images/`, et `images/ios/iTunesArtwork@2x.png` à `AppIcon.appiconset/ItunesArtwork@2x.png`
- `cdn/checquy/` reste inchangé (arborescence déjà saine)
- Rédiger `docs/CDN.md` avec le **tableau ancienne URL → nouvelle URL** à répercuter chez les clients

**Étape 4 — branche `data` et bot**
- `git checkout --orphan data` → ne garder que `enbref/latest-recap.json`
- Repointer le job n8n sur la branche `data` et le chemin `enbref/latest-recap.json`
- Mettre à jour l'app En Bref : `/cdn/en-bref/data/latest-recap.json` → `/data/enbref/latest-recap.json`
- Supprimer `cdn/en-bref/data/` de `main` **une fois** le nouveau chemin en service

**Étape 5 — CI et Pages**
- Ajouter `.github/workflows/deploy-pages.yml`
- Settings → Pages : basculer la source sur « GitHub Actions »
- Committer `CNAME` (scénario A) ou configurer la règle Cloudflare (scénario B)
- Ajouter `404.html`, `robots.txt`

**Étape 6 — documentation**
- `docs/ARCHITECTURE.md`, `docs/ADD-A-SITE.md`, réécriture du `README.md`
- Remplacer le `.gitignore` Visual Studio (7 Ko) par un `.gitignore` web (`node_modules/`, `dist/`, `.DS_Store`)

**Hors périmètre (mentionné, non recommandé)** : réécrire l'historique de `main` avec `git filter-repo`
pour effacer les ~750 commits de bot. Le repo ne pèse que 3.7 Mo, le gain serait cosmétique, et le
coût (force-push, hashes invalidés, clones cassés) est réel. La branche `data` suffit à assainir
l'historique **à partir de maintenant**.

## Vérification

1. **Local** : `npx serve dist` après avoir rejoué les étapes du workflow à la main → vérifier `/`,
   `/enbref/`, `/enbref/legal/privacy-policy.html`, `/ampr/`, une image `/cdn/checquy/…`
2. **Liens morts** : passer un `lychee`/`linkchecker` sur `dist/` — aucun 404, en particulier sur les
   chemins CDN réécrits
3. **Déploiement** : pousser sur une branche de travail, vérifier que le workflow passe au vert, puis
   merger sur `main` et contrôler l'URL de production
4. **Chaîne des récaps** : déclencher manuellement le job n8n → un commit apparaît sur `data` (et non
   sur `main`), le workflow se redéclenche, et `/data/enbref/latest-recap.json` renvoie le nouveau JSON
5. **Non-régression CDN** : pour chaque ligne du tableau de `docs/CDN.md`, un `curl -I` sur la nouvelle
   URL doit répondre `200`
6. **Ajout d'un site** : dérouler `docs/ADD-A-SITE.md` sur `ampr` de bout en bout — si la recette
   demande de toucher autre chose que `sites/ampr.app/` et une ligne du workflow, la cible a raté son but

## Livrables

Ce plan est produit sous deux formes, sans aucune modification de la structure du repo :

- `docs/restructure-plan.md` — le plan en Markdown
- `docs/restructure-plan.html` — la même chose en page HTML autonome, également publiée en Artifact
  pour être consultable par lien

---

## Annexe A — Table de correspondance des URLs

Base : `https://<domaine>` (aujourd'hui `yterraillon.github.io` ou `dimin.dev` selon la config Pages à vérifier).

### Sites

| Aujourd'hui | Après |
|---|---|
| `/` | `/` (inchangé) |
| `/pages/en-bref/index.html` | `/enbref/` |
| `/pages/en-bref/privacy-policy.html` | `/enbref/legal/privacy-policy.html` |
| `/pages/en-bref/terms-of-use.html` | `/enbref/legal/terms-of-use.html` |
| `/pages/en-bref/legal-notice.html` | `/enbref/legal/legal-notice.html` |
| `/pages/en-bref/app-tracking-policy.html` | `/enbref/legal/app-tracking-policy.html` |
| `/pages/en-bref/about-us.html` | `/enbref/about.html` |
| `/app/css/output.css` | `/css/site.css` (généré par la CI) |

> Les URLs des pages légales sont **déclarées à Apple** dans App Store Connect (privacy policy,
> terms of use) : à mettre à jour dans la fiche de l'app après la migration.

### CDN — assets consommés par les apps externes

| Aujourd'hui | Après | Consommateur |
|---|---|---|
| `/cdn/en-bref/images/EnBrefLogo_*.png` | `/cdn/enbref/logos/EnBrefLogo_*.png` | app En Bref, site |
| `/cdn/en-bref/icons/EnBrefLogo_Black_WhiteBG.png` | *supprimé* (doublon exact de `logos/`) | — |
| `/cdn/en-bref/images/logo.png` | `/cdn/enbref/logos/logo.png` | app En Bref |
| `/cdn/en-bref/images/ios/**` | `/cdn/enbref/ios/**` | build iOS |
| `/cdn/en-bref/images/ios/iTunesArtwork@2x.png` | *supprimé* (doublon de `AppIcon.appiconset/ItunesArtwork@2x.png`) | — |
| `/cdn/checquy/**` | `/cdn/checquy/**` (inchangé) | app Checquy |
| `/cdn/en-bref/data/latest-recap.json` | `/data/enbref/latest-recap.json` | app En Bref + job n8n |

### Assets qui quittent le CDN pour devenir des assets de site

Ces fichiers ne sont **pas** un contrat public : ils n'illustrent que la landing page. Ils repassent
donc dans le site qui les utilise. À vérifier tout de même qu'aucun lien externe ne pointe dessus.

| Aujourd'hui | Après |
|---|---|
| `/cdn/the-coding-nook/images/logo.png` | `/assets/images/logo.png` |
| `/cdn/the-coding-nook/images/hero.jpg` | `/assets/images/hero.jpg` |
| `/cdn/the-coding-nook/images/{github,news,programming}.png` | `/assets/images/…` |
| `/cdn/homepage/images/{coloors,patternpad,tube2text,unsplash}.png` | `/assets/images/…` |
| `/cdn/quake-3/images/logo.png` | `/assets/images/quake-3.png` |
| `/cdn/valheim/images/logo.png` | `/assets/images/valheim.png` |

### Supprimés

`/cdn/savetea/**`, `/cdn/muscle-routine/**`, `/cdn/meal-picker/**`

---

## Annexe B — Inventaire de départ

61 fichiers, 789 commits, `.git` = 3.7 Mo.

```
.                        index.html, Readme.md, package.json, package-lock.json, .gitignore (7 Ko, VS)
app/css/                 styles.css (source Tailwind), output.css (build committé)
pages/en-bref/           6 pages HTML + styles.css
cdn/checquy/             5 images + 1 .ico          → contrat externe, à garder
cdn/en-bref/             5 logos + 19 icônes iOS    → contrat externe, à renommer
cdn/en-bref/data/        latest-recap.json          → données, part sur la branche `data`
cdn/homepage/images/     4 icônes                   → assets de la landing
cdn/the-coding-nook/     5 images (ancienne marque) → assets de la landing
cdn/quake-3/, valheim/   1 logo chacun              → assets de la landing
cdn/savetea/             1 logo                     → supprimé
cdn/muscle-routine/data/ 1 JSON                     → supprimé
cdn/meal-picker/data/    2 JSON                     → supprimé
```

Répartition des commits : ~750 écritures de bot sur 3 fichiers JSON
(`Updated latest Recap`, `Muscle Routine - …`, `Meal selection - …`), 40 commits humains.

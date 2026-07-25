# Plan — Starter IA portable et maîtrisé

> Document de travail. On planifie **avant** de coder.
> Statut des sections : 🟥 à discuter · 🟧 en cours · 🟩 validé.
> Source du brief : `brief.md`.

---

## 0. Méta

- **Groupe / membres** : 🟥 à préciser
- **Nom du projet / dossier** : `laguarde` (à confirmer ou renommer)
- **Nom archive ZIP** : `groupe-X-starter-ia.zip`
- **Durée / échéance** : 🟥 — pas de présentation orale ; tout est revu dans le repo (décision porteur 2026-07-21)
- **Stack maîtrisée** : TypeScript + Bun (héritage `vovo` + `skeleton-poc`) ✅
- **Clients visés en démo** : 🟩 — un agent MCP réel + MCP Inspector comme vérification indépendante du protocole

### Matière existante (repérée dans `../`)

- **`../skeleton-poc`** (boilerplate séance 2) — base sous forme de **pi skills** :
  - `.pi/skills/ts-init/` — bootstrap TS minimal (demande pkg manager → exécute `init.sh`)
  - `.pi/skills/poc-scaffold/` — couche une stack : mode **recipe** strict + mode **flexible**, with recette NestJS (`scaffold-nest.sh`)
  - `.agents/skills/` — skills MCP (Anthropic) vendoring pour construire des serveurs MCP
  - `skills-lock.json` — pin des sources/hashes de skills externes
  - ➜ L’utilisateur adore cette forme : **skills personnalisés qui bootstrap n’importe quel projet**
- **`../vovo`** (première tentative de ce projet) — **MCP server** Bun/SQLite/Express :
  - Table `rules` (id, name, description, context, **severity**, tags, timestamps) —itasée via `seed.ts`
  - Outils MCP : `list_rules` / `get_rule` / `search_rules` / `install_guardrails_skill` (génère un `SKILL.md` depuis la DB)
  - API REST + UI HTML single-page pour CRUD des règles
  - ➜ Déjà : garde-fous en DB + accessibles via MCP + éditables via UI.

### Vision retenue (validée avec le porteur)

> **laguarde est un agent policy framework.** Une équipe installe/déploie un serveur MCP laguarde ; n’importe quel agent (Claude Code, Cursor, Codex, modèle local…) s’y connecte comme à n’importe quel serveur MCP standard, découvre l’outil via un simple fichier texte (`llms.txt`) hébergé sur le repo, et consulte les **règles partagées** de l’équipe au lieu d’improviser ses conventions projet par projet.

Le serveur regroupe **quatre catégories de politique** (les « buckets » laguarde) :

1. **code rules** — règles de code (style, types, patterns) ; ~ce que `vovo` appelle `rules`.
2. **general rules** — principes transverses (revue, sécurité, droits d’action, etc.) ; sont les **garde-fous** du brief (4 niveaux).
3. **project inits** — recettes d’initialisation de projet (ex : `ts-init`, NestJS hérité de `skeleton-poc`), ressources attachées (scripts, templates).
4. **pr review guidelines** — checklists et conventions de revue de PR (catégorie dédiée, pas fusionnée).

### Mécanisme de découverte (couche d’entrée)

- **`llms.txt`** à la racine du repo laguarde — texte brut, format `llms.txt`. Explique : ce qu’est laguarde, comment connecter un MCP existant (URL), comment le lancer localement.
- **Miroir HTML** minimal pour les humains (page `/` du serveur, ou page statique GitHub Pages) — même info, en lisible.
- Point clé : **aucun SDK, aucun plugin**. Un agent qui sait fetcher une URL et respecter `llms.txt` sait installer laguarde.

### Mémoire / boucle de retour (5e pilier, nouveauté 2026-07-21)

> Quand un membre dit à l’agent « tu as fait X, mais je préfère Y », l’agent doit **agir comme une mémoire** : si la remarque touche un bucket laguarde, il propose une mise à jour de la guideline correspondante. **La modification se fait lentement et jamais sans ratification humaine.**

Détail §3-bis plus bas. Implémentation : tool MCP `propose_preference` + table `proposals` + onglet UI « file d’attente » pour qu’un humain approuve/affine/refuse. Promotion en règle acceptée état : `pending` → (convergence de plusieurs remarques) → `draft` → `accepted`.

### Décisions validées ce jour

- ✅ **laguarde = serveur MCP** (pas de skill au chemin principal). Briefing agent via `llms.txt` + champ `instructions` du MCP.
- ✅ **Deux modes de déploiement** : (a) agent **pointe vers une URL** (serveur d’équipe partagé) ; (b) agent **lance localement** laguarde (instance projet). Choix = préférence d’équipe.
- ✅ **`llms.txt`** à la racine du repo + miroir HTML.
- ✅ **PR review = catégorie propre** (séparée des general rules).
- ✅ **Mémoire/feedback loop** dans le périmètre du prototype ; ratification humaine obligatoire.
- ✅ **Skill laguarde = abandonné** du chemin principal (serait un fallback offline optionnel uniquement si temps reste).

---

## 1. Étape 1 — Reprendre la base existante

> Deux bases : `../skeleton-poc` (skills pi) et `../vovo` (MCP + DB règles).

### Conserver / Transformer / Abandonner

| Élément | Décision | Raison |
|---|---|---|
| `skeleton-poc/.pi/skills/ts-init` (skill + script) | **Transformer** | deviens un *project_init* dans la DB ; le script bash migre en corps de recette / `assets/inits/` |
| `skeleton-poc/.pi/skills/poc-scaffold` (recipe/flexible) | **Transformer** | le concept recipe/flexible devient un *project_init* typé dans la DB ; recettes = contenu de la recette |
| `skeleton-poc/.agents/skills/*` (vendoring MCP Anthropic) | **Abandonner** (ou déplacer en ressource externe) | utile pour construire des MCP, hors périmètre de l’outil lui-même |
| `skills-lock.json` (pin externe) | **Abandonner** pour le prototype | sur-ingénierie pour la démo ; à remettre plus tard si skills externes reviennent |
| `vovo` schéma `rules` + seed TS/arch/testing | **Conserver + étendre** | base des garde-fous ; on ajoute le 4e niveau « interdit » à la place de `severity` err/warn/info |
| `vovo` MCP tools `list/get/search_rules` | **Conserver** | API lecture garde-fous, réutilisable telle quelle |
| `vovo` `install_guardrails_skill` (génère SKILL.md) | **Transformer** | généralise en `install_init_recipe` : exporte une recette d’init depuis le bucket `project_inits` |
| `vovo` UI HTML + REST CRUD | **Conserver + étendre** | onglets par bucket (code rules · guardrails · project inits · PR review) + file proposals + preuves |
| `vovo` MCP streamable HTTP / Express | **Conserver** | marche avec tout client MCP, pas verrouillé Claude |
| `vovo` modèle `severity: error/warning/info` | **Transformer** | aligner sur les 4 niveaux du brief : autorisé / limité / validation / interdit |

### Ce qui manque pour guider l’IA *pendant* le dev

- [x] Étendre le schéma aux **4 buckets** via `guidelines.kind`.
- [x] Stocker la recette `init-nest-api` dans le bucket `project_init`. L’exécution automatique est reportée : elle ne doit pas contourner le gate des dépendances.
- [x] Le **fichier `llms.txt`** + une page `/` HTML miroir (interface de découverte).
- [x] Le champ **`instructions`** du serveur MCP réécrit pour le briefing agent.
- [x] Les **4 niveaux** de garde-fous (autorisé / limité / validation / interdit).
- [x] Un **journal de décisions / preuves** (demande → règle → décision → action suivante).
- [x] Demande cadrée directement par le schéma structuré de `evaluate_action`.
- [x] Outil `evaluate_action` (cœur frontière de contrôle).
- [x] Mémoire/feedback : `propose_preference` + table `proposals` + file UI.

**Production attendue :** liste courte ✅ ci-dessus. → 🟩 (validée)

---

## 2. Étape 2 — Pitch de l’outil

> Qui ? Quand ? Quelle perte de contrôle éviter ?

### Pitch retenu (🟩)

> **laguarde est un agent policy framework.** Les équipes y stockent leurs **règles de code**, leurs **règles générales/garde-fous**, leurs **recettes d’initialisation de projet** et leurs **guidelines de revue de PR** ; n’importe quel agent découvre le serveur via un simple `llms.txt`, s’y connecte en standard MCP, et consulte ces politiques au lieu d’improviser. Quand un humain corrige l’agent, laguarde capture la remarque et propose, sous contrôle humain, d’améliorer la guideline correspondante.

Test des 3 questions :
- **Qui ?** une équipe de dev qui travaille avec des agents IA.
- **Quand ?** à chaque fois qu’un agent agit (pendant le dev, au bootstrap, à la revue).
- **Quelle perte de contrôle éviter ?** la dérive silencieuse : chaque projet réinvente ses règles, chaque agent improvise ses conventions, les corrections humaines se perdent.

**Production attendue :** pitch < 30 sec. → 🟩

---

## 3. Étape 3 — Workflow

> 7 moments du brief, mappés sur laguarde (MCP server + DB multi-buckets + UI + discovery `llms.txt`).
> Briefing agent : **champ `instructions` du MCP + `llms.txt`** (pas de skill).

### Boucle principale (une itération de dev)

| # | Étape brief | Qui/quoi dans laguarde | Lien `vovo` |
|---|---|---|---|
| 1 | Charger/créer le contexte | `context` = jeu de politiques attaché au projet (range de buckets) ; l’agent appelle `list_*` au démarrage | à ajouter |
| 2 | Sélectionner règles adaptées | `list_rules(context)` + `list_inits(context)` ; on récupère les garde-fous applicables | existe (`list_rules`) |
| 3 | Demande cadrée | outil `prepare_request` : assemble contexte + règles + périmètre → prompt compact | à ajouter |
| 4 | Décision autoriser/limiter/découper/bloquer | `evaluate_request` : matche la demande contre la matrice des garde-fous → niveau 1–4 | à ajouter (cœur nouveauté) |
| 5 | Proposition/modification par l’IA | l’IA exécute dans son IDE/CLI (ou via `install_init_recipe` pour les bootstraps) | externe / recycle |
| 6 | Contrôle du résultat | `check_result` : compare modif prévue vs réalisée, scope, fichiers touchés | à ajouter |
| 7 | Test + validation humaine | `record_decision` : preuve horodatée (`decisions/`) + table `decisions` | à ajouter |

### Boucle de mémoire / feedback (5e pilier, permanente)

```
humain : « tu as fait X, je préfère Y »
   ↓
agent appelle propose_preference(scope, observation, suggested_edit, scope_id?)
   ↓
proposition = pending dans table proposals (convergence_count=1, proposed_by taggé)
   ↓
autres observations similaires → l’agent propose le même scope_id existant
   ↓
convergence_count += 1 (same-human compte mais reste taggé pour l’UI)
   ↓
convergence_count >= N  →  state = promoted_candidate
   ↓
humain (UI) approuve / affine / refuse
   ↓
si approuvé → nouvelle guideline_revisions + bump current_revision_id
   ↓
guideline active mise à jour (visible par tous les agents)
```

**Spécifications convergence (🟩 verrouillées)**
- **Seuil N = 3** — 3 observations similaires sur le même scope avant promotion.
- **Similarité** = **scope LLM-proposed** : l’agent, en appelant `propose_preference`, passe `scope_id` d’une proposition existante s’il juge que c’est la même remarque. C’est l’agent qui fait le dédup, pas laguarde. (Pas d’infrastructure d’embeddings en v1.)
- **Même humain** : ça compte, mais reste **taggé** dans `proposed_by` pour que l’UI affiche « 3 mentions : 2 Alice, 1 Bob » et laisse l’humain pondérer.
- **Pas de time decay** en v1 (limite honnête annoncée).
- L’agent **ne modifie jamais** seul une politique acceptée — il propose seulement.

### Mémoire — tracé de la convergence dans le repo

Puisque tout est revu dans le repo (pas de présentation 5 min), on **montre réellement la convergence** et pas juste un cycle unique :
- Un dossier `examples/feedback/` contient les 3 observations (timestamps + `proposed_by`) convergeant vers une proposition.
- Une preuve `decisions/<ts>-memory-promotion.md` documente : observations d’origine → matching `scope_id` → passage à `promoted_candidate` → ratification humaine → nouveau `revision_no`.
- Ordre de grandeur démo : 3 corrections sur la même règle (ex « pas de `any` ») → laguarde fusionne → propose une reformulation → humain ratifie.

### À produire

- [x] Schéma simple (Mermaid) : présent dans `README.md`
- [x] Noms internes retenus dans l’UI : `Policies` (with policy test bench), `Feedback queue`
- [x] Entrées/sorties de chaque outil MCP : documentées dans `docs/usage.md` et exposées par `tools/list`
- [x] La **décision humaine** se matérialise dans l’UI pour les décisions et les propositions.

**Production attendue :** schéma ou liste ordonnée. → 🟧

---

## 4. Étape 4 — Portabilité multi-IA

> Le cœur ne dépend pas d’un fournisseur/modèle précis. Déjà vrai dans `vovo` (MCP standard).

### Justification du format (point brief explicite)

- **Cœur = DB + serveur MCP.** Standard MCP → tout client MCP peut consommer (Claude Code, Codex, Cursor, modèle local via son client MCP).
- **Découverte = `llms.txt`** (repo) + **champ `instructions`** du serveur MCP. **Aucune dépendance fournisseur**, aucune installation spécifique : un agent qui sait fetcher une URL + parler MCP est opérationnel.
- **Adaptateurs = optionnels**. Un projet sans IDE MCP peut quand même booteleeple via un path local si on a le temps (mode 3, reporté).

### Couches (formalisées)

| Couche | Rôle | Liée à un fournisseur ? |
|---|---|---|
| Discovery `llms.txt` + HTML miroir | agent lit comment installer, option URL ou local | non |
| Serveur MCP (champ `instructions` + tools) | interface unique IA ↔ registre | non (MCP std) |
| DB buckets (`code_rules`, `general_rules`, `project_inits`, `pr_review_guidelines`, `proposals`, `decisions`) | source de vérité | non |
| UI + REST CRUD | édition humaine (règles, inits, guidelines, file proposals, preuves) | non |

### Deux modes de déploiement validés ✅

- [x] **Mode 1 — URL d’équipe** : image Docker + Compose, URL MCP partagée.
- [x] **Mode 2 — Local** : même serveur lancé avec Bun et DB SQLite locale.

> Les deux modes utilisent **exactement le même protocole** (MCP streamable HTTP). Choix = préférence d’équipe, pas architecture différente.

- [ ] (optionnel, plus tard) Mode 3 — un CLI `laguarde` ou un dossier `.laguarde/` portable pour environnement sans MCP. Reporté.

**Production attendue :** ≥ 2 modes réels ou simulés. → 🟩 (Mode 1 + Mode 2 définis ; il reste à les montrer dans la démo)

---

## 5. Étape 5 — Garde-fous

> 4 niveaux (brief) : **autorisé · limité · validation obligatoire · interdit**.
> `vovo` utilise `severity: error|warning|info` — **à remplacer** par les 4 niveaux.

### Décision de modélisation 🟩 validée

La colonne logique `level` utilise : `allowed | limited | approval | forbidden`.
Implications : `install_guardrails_skill` génère alors un `SKILL.md` avec badges ✋/🔁/⚠️/🚫.

### Matrice de règles (à remplir en groupe)

| Domaine | Niveau par défaut | Détail / condition de surcharge |
|---|---|---|
| Fichiers sensibles (`.env`, secrets, keys) | 🚫 forbidden | lecture seule interdite hors `.env.example` |
| Secrets & variables d’env | 🚫 forbidden / 🟧 approval si rotation documentée | jamais committer, jamais logger |
| Ajout de dépendances | 🟧 approval | justifier licence + taille + maintenance |
| Migrations / suppressions de fichiers | 🟧 approval | plan + rollback attendus |
| Authentification & permissions | 🟧 approval | revue dédiée obligatoire |
| Commandes système (shell, fs hors projet) | 🟡 limited | dry-run préférable ; interdiction `rm -rf /`, `--force` global |
| Tests obligatoires | ✅ allowed (mais **requis**) | pas de merge sans tests verts |
| Modifications trop larges (> N fichiers / diff > X) | 🟡 limited | découpage obligatoire, par lots |

### Format de règle (exploitable par l’outil)

- [x] SQLite + validation TypeScript du champ JSON `fields.level`.
- [x] Matrice lisible dans l’UI et exposée en JSON par REST/MCP. Export YAML reporté.

**Production attendue :** matrice ou fichier de règles. → 🟧

---

## 6. Étape 6 — Prototype

> Version minimale démontrable. Simple & stable > ambitieux & instable.
> Partir de `vovo` (déjà installable : `bun install`, `bun run dev`, Dockerfile, healthcheck).

### Périmètre minimal du prototype

Surgir `vovo` → laguarde. On garde ce qui existe et on ajoute le **minimum** qui prouve la vision « serveur MCP de politique d’agent, découvrable, multi-buckets, avec mémoire ».

**Conserver tel quel :** server MCP streamable HTTP + Dockerfile, REST, UI HTML, `list_rules`/`get_rule`/`search_rules`, seed.

**Ajouter (minimum viable) :**

1. **Discovery** : fichier `llms.txt` à la racine du repo ; page `/` du serveur devient un miroir HTML lisible.
2. **Refonte du champ `instructions`** du serveur MCP (existe dans `vovo`) pourbriefer l’agent : buckets, outils, usage, mémoire.
3. **Migration `severity` → `level`** (4 niveaux) sur les `general_rules` (les garde-fous).
4. **Buckets supplémentaires** : `project_inits` (recettes d’init ; on y migre `ts-init` et NestJS de `skeleton-poc`), `pr_review_guidelines` (checklist). Option : unifier sous une table `guidelines` avec colonne `bucket` (à trancher en groupe, §12).
5. **Outils MCP** :
   - `list_inits` / `get_init` / `install_init_recipe` (généralisation de `install_guardrails_skill`)
   - `list_pr_guidelines` / `get_pr_guideline`
   - `prepare_request` (demande cadrée)
   - `evaluate_request` (cœur frontière de contrôle → niveau 1–4)
   - `record_decision` (preuve horodatée)
   - `propose_preference` (mémoire → table `proposals`)
6. **UI** : onglets **Code rules** · **Guardrails (general)** · **Project inits** · **PR review** · **File d’attente (proposals)** · **Preuves (decisions)** — au minimum : Guardrails + Project inits + File d’attente pour la démo.
7. **Tables** : `proposals`, `decisions` (ou dossier `decisions/*.md`).

**Doit au minimum (checklist brief)**

- [x] installable/copiable/lançable clairement — Bun et Docker Compose
- [x] prend en entrée le contexte d’un projet — `context_id` + table `contexts`
- [x] produit règles/instructions adaptées — `get_policy_bundle`
- [x] traite ≥ 1 demande de dev — `evaluate_action`
- [x] affiche une décision compréhensible — UI + REST + MCP
- [x] conserve une **preuve** — `record_decision` → SQLite + `decisions/`
- [x] **mémoire** : cycle testé « humain corrige ×3 → proposition → approbation UI → nouvelle révision »

### Décisions techniques déjà prises (héritées + validées) ✅

- **Format** : **serveur MCP** (découvrable via `llms.txt`). Combo justifié par besoin démontrable : interrogation dynamique, permissions multiples, intégration multi-clients.
- **Langage cœur** : **TypeScript + Bun** (continuité vovo/skeleton-poc).
- **Preuve** : `decisions/<ts>-<id>.md` (humain-lisible) **+** table `decisions` (machine). ✅
- **Validation humaine** : UI (bouton approuver/refuser) pour les décisions et les `proposals`. ✅
- **Skill** : **abandonné** du chemin principal (serait un fallback offline optionnel, plus tard).

**Production attendue :** prototype minimal. → 🟧

---

## 7. Étape 7 — Bootstrap de projet (démo)

> Choisir un projet simple à initialiser avec l’outil.

### Projet retenu 🟩

- **API métier NestJS** : la recette est migrée comme `init-nest-api` et la démonstration vit dans `examples/bootstrap/`.
- [ ] application web
- [ ] outil de traitement de fichiers
- [ ] assistant documentaire
- [ ] service d’analyse de logs
- [ ] projet modèle local

### Ce que l’outil doit produire/préparer pour la démo

- [x] contexte initial (table `contexts`, contexte seed `default`)
- [x] conventions du projet (`get_policy_bundle`)
- [x] règles de modification sélectionnées pour ce contexte
- [x] première demande structurée à l’IA
- [x] validations attendues (source autorisée, dépendances soumises à approbation)
- [x] premiers fichiers/commandes/étapes proposés dans `examples/bootstrap/`
- [x] preuve produite par `record_decision`

**Production attendue :** exemple complet de démarrage. → 🟩

---

## 8. Étape 8 — Frontière de contrôle (2 cas)

### Cas maîtrisé (autorisé/encadré)

| Champ | Valeur |
|---|---|
| Demande initiale | Modifier un service et son test |
| Contexte utilisé | `default` |
| Règle appliquée | `guard-project-source#v1` |
| Décision produite | `allowed` |
| Action suivante | Exécuter dans le scope déclaré et tester |
| Preuve conservée | table `decisions` + Markdown |

### Cas à risque (limité / découpé / validation / bloqué)

| Champ | Valeur |
|---|---|
| Demande initiale | Écrire le token de production dans `.env` |
| Contexte utilisé | `default` |
| Règle appliquée | `guard-sensitive-files#v1` |
| Décision produite | `forbidden` |
| Action suivante | Arrêter et proposer `.env.example` avec placeholders |
| Preuve conservée | table `decisions` + Markdown |

- [x] Les demandes proches sont documentées dans `examples/control-boundary/`.

**Production attendue :** 2 scénarios documentés. → 🟩

---

## 9. Livrables — checklist finale

- [x] 1. Outil / prototype utilisable
- [x] 2. Procédure courte d’installation/utilisation
- [x] 3. Règles & garde-fous
- [x] 4. Exemple de bootstrap
- [x] 5. Cas autorisé + cas limité/bloqué
- [x] 6. Analyse courte choix techniques + limites
- [ ] 7. Archive ZIP (`groupe-X-starter-ia.zip`) — pas de dépendances générées, pas de tmp, pas de secret réel

## 10. Revue dans le repo (remplace présentation 5 min)

> Décision porteur 2026-07-21 : **pas de présentation orale**. Tout est livré et revu dans le repo. On organise donc les preuves/la narration côté fichiers plutôt que côté slides.

- [x] `README.md` narratif
- [x] `llms.txt` racine
- [x] `examples/bootstrap/`
- [x] `examples/feedback/`
- [x] `examples/control-boundary/`
- [x] `docs/decisions/`
- [x] `docs/install.md` + `docs/usage.md`
- [x] `docs/limits.md`

> Toute la « narration » vit dans le repo. Les ADRs servent de « chaque membre explique une décision » :
> chacun signe ou coécrit au moins un ADR (une règle, une décision technique, une partie produite avec l’IA).

## 11. Limites honnêtes à annoncer (pré-remplies)

- [x] Pas de time decay sur la mémoire : une observation d’il y a 2 ans compte comme une d’aujourd’hui.
- [x] Similarité LLM-proposed : l’agent peut rater une convergence (faux négatif) ou sur-fusionner (faux positif) ; l’humain tranche en UI.
- [x] Pas d’authentification/rôles : tout membre peut ratifier/approuver en v1.
- [x] Validation humaine via UI uniquement (pas de CLI prompt) en v1.
- [x] Pas de détection statique du code dans `evaluate_request` : c’est un match déclaration/regex sur la demande, pas un vrai linter.
- [ ] _ajouter au fil du projet…_

---

## 12. Décisions en attente (parking)

> On ne code pas tant que ces points ne sont pas tranchés.

### Déjà tranchées ✅

- ✅ **Nature de laguarde** : agent policy framework = **serveur MCP** (pas de skill chemin principal).
- ✅ **Découverte** : `llms.txt` à la racine + miroir HTML.
- ✅ **Modalités de déploiement** : URL d’équipe **ou** instance locale (même protocole MCP).
- ✅ **4 buckets de politique** : `code_rules`, `general_rules` (garde-fous), `project_inits`, `pr_review_guidelines`.
- ✅ **Mémoire/feedback loop** dans le périmètre ; ratification humaine obligatoire.
- ✅ **4 niveaux de garde-fous** (autorisé / limité / validation / interdit) en remplacement de `severity`.
- ✅ **Langage cœur** : TypeScript + Bun + SQLite.
- ✅ **Point de départ** : évoluer `vovo`.
- ✅ **Pitch final** exprimé (§2).

### Décisions tranchées pour le prototype 🟩

- 🟩 **Modèle de données** : hybride, adopté.
- 🟩 **`project_inits`** : corps de recette en DB ; pièces jointes reportées.
- 🟩 **Format de preuve** : `decisions/*.md` + table `decisions`.
- 🟩 **Interface de validation humaine** : UI d’abord.
- 🟩 **Projet de bootstrap démo** : API métier NestJS.
- 🟩 **Client de vérification #2** : MCP Inspector / client protocolaire.
- 🟩 **Mémoire — seuil de convergence (N)** : **N=3**, verrouillé. Même humain compte (taggé `proposed_by`), pas de time decay en v1.
- 🟩 **Mémoire — similarité** : **LLM-proposed scope** (l’agent passe `scope_id` d’une proposition existante ; pas d’embeddings en v1).
- 🟩 **Mémoire — scope de la proposition** : **LLM propose le bucket/scope** ; l’humain peut réassigner dans l’UI.
- 🟩 **Qui peut approuver une proposal** : tout utilisateur du dashboard en v1 ; rôles reportés.
- 🟩 **Noms des outils** : `get_policy_bundle`, `evaluate_action`, `record_decision`, `list_preference_proposals`, `propose_preference`.
- 🟩 **Démo mémoire — convergence montrée** : on **montre réellement les 3 observations convergeant** (repo-only, pas de temps de présentation à tenir). Voir `examples/feedback/`.

### Reporté / out of scope (faire le honteusement)

- Mode 3 CLI/dossier portable sans MCP (la fallback offline réservée).
- Skill `laguarde` auto-installé (abandonné du chemin principal).
- Import de skills externes (`skills-lock.json`).
- Gestion fine des rôles/utilisateurs (tous membres = même niveau pour la démo).

---

## 13. Modèle de données — proposition d’extension-friendly

> Recommandation pour la ligne §12 « Modèle de données ».
> Principe : **typer ce qu’on interroge toujours, sérialiser ce qui varie par *kind*, isoler les relations dans des tables latérales.**

### Trois options considérées

| Option | Avantage | Coût | Verdict |
|---|---|---|---|
| (1) Table par bucket | colonnes typées par type | 4 tables × outils ; migration à chaque nouveau bucket | ❌ Craig solid mais peu évolutif |
| (2) Une table `guidelines` + colonnes sparse | une seule API | NULLs peu clairs, types spécifiques forcés | ❌ |
| (3) **Hybride** : colonnes communes typées + JSON `fields` + tables latérales | extension sans migration (nouveau `kind` = nouvelle valeur, pas de schéma) ; typed where it matters | doc d’intention à maintenir (`kind` → JSON schema) | ✅ **recommandé** |

SQLite a JSON1 (`json_extract`, colonnes générées, index sur chemin JSON) → le JSON est interrogeable, pas un brouillard.

### Schéma proposé (pseudo-SQL)

```sql
-- La pièce centrale : un "document de politique" quel que soit son bucket.
CREATE TABLE guidelines (
  id              TEXT PRIMARY KEY,            -- ex 'ts-001', 'nest-backend', 'pr-002'
  kind            TEXT NOT NULL,                -- 'code_rule' | 'general_rule' | 'project_init' | 'pr_review_guideline'  (extensible, pas de CHECK SQL)
  name            TEXT NOT NULL,
  summary         TEXT NOT NULL,                -- description courte (ancienne colonne `description`)
  tags            TEXT,                         -- CSV ou JSON array (hérité de vovo)
  context_tags    TEXT,                         -- JSON array : à quels `contexts` ça s’applique
  status          TEXT NOT NULL DEFAULT 'active',  -- 'draft' | 'active' | 'deprecated'  (lifecycle, pas à confondre avec proposals)
  current_revision_id TEXT,                     -- FK guidelines_revisions.id
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT,                         -- soft-delete (audit)
  -- bucket-spesifique (variable par kind) :
  fields          TEXT NOT NULL DEFAULT '{}'    -- JSON. ex: level/périmètre pour general_rule ; script_path+recipe_mode pour project_init ; checklist_items pour pr_review
);
CREATE INDEX idx_guidelines_kind   ON guidelines(kind) WHERE deleted_at IS NULL;
CREATE INDEX idx_guidelines_status ON guidelines(status) WHERE deleted_at IS NULL;

-- Versions immuables de chaque guideline. Une nouvelle ligne à chaque acceptation.
CREATE TABLE guideline_revisions (
  id            TEXT PRIMARY KEY,              -- ex 'ts-001#v3'
  guideline_id  TEXT NOT NULL REFERENCES guidelines(id),
  revision_no   INTEGER NOT NULL,
  body          TEXT NOT NULL,                  -- corps complet (Markdown), instantané figé
  fields        TEXT NOT NULL DEFAULT '{}',     -- snapshot des fields à cette version
  rationale     TEXT,                           -- pourquoi cette version (utile pour mémoire)
  author        TEXT,                           -- qui a ratifié (utile pour boucle mémoire)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(guideline_id, revision_no)
);

-- Projets / contextes = sélection de buckets actifs + override.
CREATE TABLE contexts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  active_kinds TEXT NOT NULL,                   -- JSON array, ex ["code_rule","general_rule","project_init"]
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pièces jointes pour les project_inits (scripts, templates).
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  guideline_id  TEXT NOT NULL REFERENCES guidelines(id),
  filename      TEXT NOT NULL,
  mime          TEXT,
  content       BLOB,                           -- inline ; ou juste un chemin vers assets/inits/
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mémoire / feedback loop.
CREATE TABLE proposals (
  id            TEXT PRIMARY KEY,
  scope_kind    TEXT NOT NULL,                  -- kind visé (ex 'general_rule')
  scope_id      TEXT,                            -- guideline_id existant si correction ; NULL si nouvelle guideline
  observation   TEXT NOT NULL,                  -- « tu as fait X, je préfère Y »
  suggested_edit TEXT,                          -- diff / formulation proposée par l’IA
  state         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'promoted_candidate' | 'draft' | 'accepted' | 'rejected'
  convergence_count INTEGER NOT NULL DEFAULT 1,-- nb d’observations similaires fusionnées
  proposed_by   TEXT,                            -- agent / session
  reviewed_by   TEXT,                            -- humain ratifiant
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_proposals_state ON proposals(state);

-- Preuves / décisions horodatées (étape 7 du workflow).
CREATE TABLE decisions (
  id            TEXT PRIMARY KEY,
  context_id    TEXT REFERENCES contexts(id),
  request       TEXT NOT NULL,                  -- demande initiale cadrée
  evaluation    TEXT NOT NULL,                  -- niveau 1–4 + règle appliquée
  decision      TEXT NOT NULL,                  -- autorisé/limité/validation/interdit + signature humaine
  related_guideline_revisions TEXT,             -- JSON array : pointeurs vers revision précises (trigger preuve solide)
  related_proposal_id TEXT REFERENCES proposals(id),
  next_action   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### ERD

```
 contexts 1───* decisions *───┐
                              │
 guidelines 1───* guideline_revisions *───┐
   │ 1                                 │
   ├── * attachments                   │
   └── 1 ─── proposals *──┘  (state: pending→promoted_candidate→draft→accepted)
                 ↑
                 └── (accepted) crée une nouvelle guideline_revisions et bump current_revision_id
```

### Pourquoi c’est extensible

- **Ajouter un 5e bucket** (ex `doc_style`, `incident_playbook`) : on ajoute une valeur de `kind` + le JSON `fields` associé. **Zéro migration**. On ne crée une colonne typée que si on veut indexer dessus.
- **Versioning** : `guideline_revisions` fige chaque version acceptée. Les `decisions` pointent vers des `revision_id` précis → une preuve reste vraie même après mise à jour de la règle. Sert aussi pour la **mémoire** : on garde le `rationale` de chaque ratification.
- **Soft delete** (`deleted_at`) : remplacer/retirer une guideline sans perdre l’historique.
- **`status` vs `proposals.state`** : lifecycle d’une guideline (`draft`/`active`/`deprecated`) séparé du cycle de propositions. Une proposition acceptée crée/édite une `guidelines` + un revision ; pas de confusion.
- **`contexts`** : projet = ensemble de buckets actifs + description. Pas de duplication ; un grep de `context_tags` suffit pour filtrer ce qui s’applique.
- **Type **: `kind` est `TEXT` (pas de `CHECK`) pour pouvoir ajouter des buckets sans migration ; l’appli valide les valeurs via une union TS, pas via SQL.
- **Recherche** : `idx_guidelines_kind/status` + `json_extract(fields, '$.level')` générable en colonne indexée plus tard si besoin.

### Coûts / limites honnêtes

- Le JSON `fields` est **typé par convention** (TS), pas garanti par le SGBD → on documenta un « schema per kind » (`docs/kinds/<kind>.md`).
- Risque de duplica de colonnes (certains champs finissent extraits en colonnes générées) → adopter la règle : « colonne typée si touchée par un `WHERE` régulier, sinon JSON ».
- Révisions gardées pour toujours = volume ; OK sur SQLite local, prévoir `archive_revisions()` plus tard si besoin.

---

## 14. Journal des décisions (à tenir au fil du projet)

| Date | Décision | Raison | Alternatives écartées |
|---|---|---|---|
| 2026-07-24 | Prototype vertical implémenté | Prouver policy → décision → preuve → ratification avant d’élargir | UI complète, auth et proxy d’exécution dès la v1 |
| 2026-07-24 | Décision inconnue = `limited` | Échec sûr sans bloquer définitivement | autorisation implicite, interdiction implicite |

---

## Notes

- Ce fichier est notre source de vérité partagée. On le met à jour **avant** d’écrire du code.
- Si une idée apparaît en codant, on revient ici l’inscrire avant de l’appliquer.
- Les 🟥 sont les points à trancher ensemble ; 🟧 en cours ; 🟩 validé.
- Sources : `brief.md` (cahier des charges), `../skeleton-poc` (boilerplate séance 2 = skills pi), `../vovo` (première tentative = MCP + DB règles).

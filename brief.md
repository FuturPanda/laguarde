# Projet final — Starter IA portable et maîtrisé

> Créez un outil réutilisable qui permet de démarrer un projet avec une IA, de lui transmettre le bon contexte et de limiter ce qu’elle peut faire sans validation humaine.

L’objectif est simple : **aller vite sans perdre la compréhension ni le contrôle du projet**.

## Ce projet va plus loin que le boilerplate précédent

Le boilerplate réalisé en séance 2 préparait une base de code propre et sécurisée pour un POC.

Ici, vous ne créez pas un nouveau squelette d’application. Vous créez une **couche d’assistance réutilisable** que l’on peut ajouter à différents projets pour guider une IA de développement.

Votre outil doit pouvoir être utilisé avec Claude, Codex, un assistant IDE, un modèle local ou un futur outil équivalent. Il ne doit donc pas dépendre entièrement d’un fournisseur ou d’un modèle précis.

## Résultat attendu

À la fin de la journée, votre groupe doit disposer d’un outil capable de :

- analyser ou récupérer le contexte d’un projet ;
- préparer un démarrage de projet cohérent ;
- fournir à l’IA des règles de travail explicites ;
- définir ce qu’elle peut lire, proposer ou modifier ;
- imposer une validation humaine pour certaines actions ;
- limiter les modifications trop larges ou trop risquées ;
- demander des tests et des preuves avant validation ;
- conserver une trace compréhensible des décisions importantes.

Vous devrez ensuite montrer comment cet outil permet de **bootstrapper un projet réel ou fictif**.

## Principe central

Votre outil doit aider le développeur à piloter l’IA comme il piloterait un membre de son équipe :

1. lui donner le contexte nécessaire ;
2. lui attribuer un périmètre clair ;
3. lui demander un plan avant les modifications importantes ;
4. contrôler ce qu’elle produit ;
5. tester le résultat ;
6. conserver la décision finale côté humain.

Une automatisation n’est utile que si vous restez capables d’expliquer ce qui a été créé, pourquoi et avec quelles conséquences.

## Format technique : à vous de choisir

Votre outil peut prendre plusieurs formes :

- un ensemble de fichiers et d’instructions portables ;
- un skill ou un plugin pour assistant de développement ;
- un CLI qui initialise ou analyse un projet ;
- une API locale ;
- un serveur MCP ;
- une combinaison de ces approches.

Le MCP n’est pas obligatoire. Vous devez choisir le format qui rend votre outil réellement utilisable et justifier ce choix.

### Quand un format simple suffit

Un dossier portable ou un CLI peut suffire lorsque l’objectif principal est de :

- générer le contexte initial ;
- installer des règles dans un projet ;
- produire une configuration compatible avec plusieurs IA ;
- vérifier une demande avant de la transmettre à un agent.

### Quand un plugin ou un MCP devient pertinent

Un plugin, un skill ou un MCP devient pertinent lorsque l’IA doit :

- interroger dynamiquement le projet ;
- appeler plusieurs fonctions clairement séparées ;
- accéder à des ressources ou outils externes ;
- appliquer des permissions différentes selon l’action ;
- être intégré directement dans plusieurs environnements compatibles.

Le choix technique doit répondre à un besoin démontrable. Il ne doit pas servir uniquement à rendre le projet plus complexe.

# Étapes du projet

## Étape 1 — Reprendre la base existante

Appuyez-vous sur le boilerplate réalisé lors de la séance précédente, sans simplement le reproduire.

Identifiez :

- les fichiers ou règles déjà réutilisables ;
- les éléments trop liés à un seul projet ;
- les éléments qui pourraient devenir configurables ;
- ce qui manque pour guider réellement une IA pendant le développement.

**Production attendue :** une liste courte de ce que vous conservez, transformez et abandonnez.

## Étape 2 — Définir le rôle de votre outil

Rédigez une phrase qui répond à ces trois questions :

- Qui utilise l’outil ?
- À quel moment du projet ?
- Quelle perte de contrôle doit-il éviter ?

Exemple :

> Notre outil aide un développeur à initialiser un projet avec une IA, puis à limiter les fichiers modifiables et les actions nécessitant une validation.

**Production attendue :** un pitch compréhensible en moins de 30 secondes.

## Étape 3 — Définir le workflow

Votre outil doit couvrir au minimum les moments suivants :

1. chargement ou création du contexte du projet ;
2. sélection des règles adaptées ;
3. préparation d’une demande cadrée ;
4. décision : autoriser, limiter, découper ou bloquer ;
5. proposition ou modification par l’IA ;
6. contrôle du résultat ;
7. test et validation humaine.

Vous pouvez nommer et organiser ces fonctions librement.

**Production attendue :** un schéma simple ou une liste ordonnée du workflow.

## Étape 4 — Rendre l’outil portable

Votre cœur de fonctionnement ne doit pas dépendre entièrement de Claude, Codex ou d’un modèle précis.

Séparez autant que possible :

- les règles communes ;
- le contexte du projet ;
- les commandes ou fonctions de l’outil ;
- les adaptations propres à chaque environnement IA.

Vous pouvez prévoir des adaptateurs ou fichiers spécifiques, par exemple :

- configuration Claude ;
- configuration Codex ;
- prompt générique ;
- modèle local ;
- connexion MCP facultative.

**Production attendue :** au moins deux modes d’utilisation possibles, réels ou simulés.

## Étape 5 — Définir les garde-fous

Votre outil doit rendre visibles quatre niveaux :

- **autorisé** : l’IA peut agir dans le périmètre défini ;
- **limité** : elle peut proposer, mais pas exécuter librement ;
- **validation obligatoire** : une personne doit confirmer ;
- **interdit** : l’action doit être bloquée ou explicitement simulée.

Les règles doivent couvrir au minimum :

- fichiers sensibles ;
- secrets et variables d’environnement ;
- ajout de dépendances ;
- migrations et suppressions ;
- authentification et permissions ;
- commandes système ;
- tests obligatoires ;
- modifications trop larges.

**Production attendue :** une matrice ou un fichier de règles exploitable par l’outil.

## Étape 6 — Construire le prototype

Développez la version minimale permettant de démontrer votre logique.

Le prototype doit au minimum :

- être installable, copiable ou lançable de manière claire ;
- prendre en entrée le contexte d’un projet ;
- produire des règles ou instructions adaptées ;
- traiter au moins une demande de développement ;
- afficher une décision compréhensible ;
- conserver une preuve de cette décision.

Le volume de code n’est pas évalué. Une solution simple, portable et maîtrisée est préférable à une architecture ambitieuse mais instable.

## Étape 7 — Tester sur un bootstrap de projet

Choisissez un projet simple à initialiser, par exemple :

- une API métier ;
- une application web ;
- un outil de traitement de fichiers ;
- un assistant documentaire ;
- un service d’analyse de logs ;
- un projet utilisant un modèle local.

Utilisez votre outil pour produire ou préparer :

- le contexte initial ;
- les conventions du projet ;
- les règles de modification ;
- la première demande adressée à l’IA ;
- les validations attendues ;
- les premiers fichiers, commandes ou étapes proposés.

**Production attendue :** un exemple complet de démarrage de projet à partir de votre outil.

## Étape 8 — Montrer la frontière de contrôle

Préparez deux situations proches :

### Cas maîtrisé

Une demande que l’outil autorise ou encadre correctement.

### Cas à risque

Une demande que l’outil limite, découpe, soumet à validation ou bloque.

Pour chaque cas, montrez :

1. la demande initiale ;
2. le contexte utilisé ;
3. la règle appliquée ;
4. la décision produite ;
5. la prochaine action proposée ;
6. la preuve conservée.

# Livrables attendus

Votre groupe doit fournir :

1. **L’outil ou le prototype utilisable** ;
2. **Une procédure courte d’installation ou d’utilisation** ;
3. **Les règles et garde-fous appliqués** ;
4. **Un exemple de bootstrap de projet** ;
5. **Un cas autorisé et un cas limité, bloqué ou soumis à validation** ;
6. **Une courte analyse des choix techniques et des limites actuelles** ;
7. **Une archive ZIP du projet complet envoyée par e-mail après la présentation**.

## Contenu de l’archive ZIP

L’archive doit contenir :

- le code source et les fichiers de configuration utiles ;
- la documentation d’installation et d’utilisation ;
- les règles, garde-fous et adaptations prévues pour les différents environnements IA ;
- l’exemple de bootstrap présenté ;
- les preuves de test ou de validation ;
- aucune dépendance générée, aucun fichier temporaire et aucun secret réel.

Nom conseillé : `groupe-X-starter-ia.zip`.

# Présentation finale

La restitution dure environ 5 minutes. Aucun PowerPoint n’est obligatoire.

Vous devez montrer directement :

1. le problème que votre outil résout ;
2. son format et la raison de ce choix ;
3. comment il s’ajoute à un projet ;
4. comment il prépare ou bootstrappe ce projet ;
5. comment il fonctionne avec plusieurs IA ou environnements ;
6. une demande acceptée ;
7. une demande limitée ou bloquée ;
8. une limite réelle de votre prototype.

Chaque membre doit pouvoir expliquer une règle, une décision technique et une partie produite avec l’aide de l’IA.

# Critères de réussite

Le projet est réussi si :

- l’outil est clairement différent d’un simple boilerplate ;
- son rôle est compréhensible rapidement ;
- il peut être réutilisé sur plusieurs projets ;
- son cœur n’est pas verrouillé sur un seul modèle ;
- les choix plugin, skill, CLI ou MCP sont justifiés ;
- les permissions et validations humaines sont visibles ;
- le bootstrap présenté est réellement exploitable ;
- les deux scénarios démontrent une frontière de contrôle ;
- les étudiants maîtrisent ce qui a été produit ;
- les limites sont annoncées honnêtement.

# Usage de l’IA

L’usage de l’IA est attendu pour réaliser le projet.

Vous devez toutefois rester capables de :

- expliquer le code et les règles produits ;
- identifier les propositions acceptées, modifiées ou refusées ;
- supprimer la sur-ingénierie ;
- vérifier les outils, dépendances et commandes proposés ;
- tester les résultats ;
- conserver la responsabilité de la validation finale.
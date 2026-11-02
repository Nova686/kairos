# Kairos — document de conception

*Rédigé le 2026-11-02. « Kairos » : en grec, le moment opportun — ici, savoir quand vendre.*

## 1. Intention

Kairos est une application web personnelle de gestion de stock pour l'achat-revente, utilisée par son auteur et quelques amis proches. Chacun y enregistre ce qu'il possède — majoritairement des produits Pokémon scellés (ETB, displays, coffrets…), mais aussi des cartes gradées, des jouets et des coffrets de maquillage — avec son prix d'achat, son état et son lieu de stockage. L'application relève régulièrement les prix pratiqués sur Vinted, eBay, Cardmarket et d'autres plateformes, conserve tout l'historique, et montre à tout moment ce que vaut chaque exemplaire et le stock entier face à ce qu'il a coûté. Elle garde aussi la trace des ventes, des colis en cours et des dettes entre personnes.

L'usage type : **chez soi**, au retour d'achats, on scanne les produits (code-barres ou photo) sur iPhone, on vérifie la fiche, on saisit prix d'achat, état et lieu. Plus tard, sur ordinateur ou téléphone, on consulte les courbes de valeur pour décider quand revendre.

## 2. Objectifs

1. **Stock par exemplaire.** Chaque exemplaire physique est une ligne : produit, état, prix d'achat, date d'achat, lieu de stockage, statut. Trois ETB identiques achetées à des prix différents = trois lignes.
2. **Ajout rapide** par trois voies, la suivante prenant le relais quand la précédente échoue :
   - **code-barres** (EAN) scanné à l'appareil photo ;
   - **photo** du produit → l'application propose le produit si elle est sûre, sinon **plusieurs candidats** parmi lesquels on choisit ;
   - **texte libre** → l'application cherche le produit et une image (catalogue partagé, puis sources en ligne) et on choisit la bonne fiche.
3. **Relevé des prix** sur plusieurs sources, **automatique à intervalle régulier** (quotidien) **et à la demande** via un bouton (un produit ou tout le stock). Les annonces **en cours** comptent autant que les ventes conclues ; chaque source garde son propre prix.
4. **Historique conservé** de chaque relevé → courbe de valeur par produit et courbe de valeur du stock entier dans le temps.
5. **Valeur du stock** = deux montants côte à côte : somme des prix d'achat et somme des prix moyens actuels (plus-value latente par exemplaire et globale). Règle de calcul validée par l'auteur :
   - l'**état de l'exemplaire est toujours pris en compte** : on ne retient que les annonces dont l'état correspond au sien ;
   - pour chaque source, on calcule la **médiane** de ces annonces en cours, et celle des ventes conclues quand la source en fournit ;
   - la valeur de l'exemplaire est la **médiane de ces chiffres toutes sources confondues**, en ignorant les relevés de plus de 7 jours ;
   - deux exemplaires du même produit dans des états différents ont donc des valeurs différentes ;
   - *(choix de Claude)* quand aucune annonce récente ne correspond à cet état, on prend l'état le plus proche disponible, et la valeur est affichée comme **approximative**, avec l'état réellement utilisé.
6. **Détail par source et par état** : la fiche produit montre, pour chaque source, les prix ventilés **par état** tels que la source les expose. Exemples : sur Vinted, « neuf avec étiquette », « neuf sans étiquette », « très bon état », etc. ; sur eBay, « neuf » ou « occasion » ; sur Leboncoin, l'état de l'annonce ; sur Cardmarket, l'état de la carte (NM, EX…), le scellé n'ayant qu'un état. Les annonces relevées sont donc classées par état.
   - *(choix de Claude)* **Échelle d'états de Kairos**, propre à chaque catégorie. Chaque état de Kairos est mis en correspondance avec le vocabulaire de chaque source. Proposition :
     - **Scellé** (ETB, display, coffret) : `neuf scellé`, `neuf boîte abîmée`, `ouvert complet`, `ouvert incomplet` ;
     - **Jouets, maquillage** : `neuf avec étiquette / emballage`, `neuf sans étiquette`, `très bon état`, `bon état`, `état satisfaisant` (calqué sur Vinted) ;
     - **Carte gradée** : l'état, c'est la **société + la note** (ex. PSA 10) ; on ne retient que les annonces de la même société et de la même note ;
     - **Carte non gradée** (si ajoutée plus tard) : échelle Cardmarket (`NM`, `EX`, `GD`, `LP`, `PL`, `PO`).
   - Pour les sources qui exposent peu d'états, comme eBay avec « neuf » / « occasion », la correspondance est approximative. Le titre de l'annonce sert alors à affiner, par exemple « boîte abîmée » ou « ouvert ».
7. **Ventes** : on renseigne date, prix de vente, plateforme et acheteur, et si le prix inclut ou non les frais de port. On peut aussi noter les frais : commission de la plateforme, port payé, emballage. Le bénéfice affiché est **net**. L'exemplaire quitte le stock mais reste visible dans un historique des ventes.
8. **Lots** :
   - une **vente** peut regrouper plusieurs exemplaires pour un prix unique ;
   - un **achat** peut aussi porter sur un lot, dont le prix est réparti entre les exemplaires. La répartition se fait au prorata de la valeur estimée par défaut, et reste modifiable à la main.
9. **Livraisons en cours**, dans les deux sens : un achat peut être saisi avant réception (statut « en livraison », numéro de suivi ou lien), une vente expédiée reste « en livraison » jusqu'à ce qu'on la marque livrée.
10. **Lieux de stockage** : chaque utilisateur gère sa liste de lieux (« Garage – étagère 2 », « Chez mes parents ») ; filtre du stock par lieu.
11. **Dettes** : un registre de qui doit combien à qui, couvrant notamment : un ami qui a avancé l'argent d'un achat, un achat fait pour quelqu'un d'autre, une vente pas encore payée. Récapitulatif du solde par personne ; une dette se marque réglée. *(Choix de Claude)* Chaque utilisateur tient son propre registre : une dette envers un ami membre n'est pas reliée à son compte, aucune donnée privée ne traverse d'un utilisateur à l'autre.
12. **Multi-utilisateurs** : l'auteur et ses amis proches, chacun avec **son propre stock**.
13. **Ordinateur et iPhone** : une seule application web responsive, installable sur l'écran d'accueil de l'iPhone (PWA).

## 3. Non-objectifs

- Pas d'application native (ni iOS, ni Android).
- Pas de stock commun : chacun possède le sien.
- Pas de publication d'annonces sur les plateformes depuis Kairos.
- Pas de suivi automatique des colis auprès des transporteurs : un lien cliquable suffit.
- Pas de gestion comptable/fiscale.

## 4. Anti-objectifs (ce qui en ferait un échec même si « ça marche »)

- **Quoi que ce soit de payant** : hébergement, reconnaissance d'image, API. Contrainte ferme de l'auteur.
- **Un prix moyen silencieusement faussé** par des annonces hors sujet (ETB vide, lot de plusieurs, carte seule au lieu du display, autre langue) sans moyen de le voir ni de le corriger.
- Un utilisateur qui voit le stock d'un autre.

## 5. Contraintes

- **Gratuit de bout en bout.**
- **iPhone / Safari** : l'accès caméra exige HTTPS ; Safari n'a pas l'API native `BarcodeDetector`, le décodage doit se faire via une bibliothèque JS.
- Le navigateur ne peut pas lire Vinted/eBay/Cardmarket directement : **les relevés se font côté serveur**. Ces sites bloquent souvent les requêtes simples et les IP d'hébergeurs « sans serveur » ; un **navigateur automatisé** (Playwright) côté serveur est nécessaire.
- Aucune des sources n'offre d'API ouverte et gratuite exploitable pour ce besoin (eBay : ventes conclues lisibles seulement sur les pages ; Vinted : annonces en cours seulement ; Cardmarket : API réservée aux vendeurs pro, tendances lisibles sur les pages produit).
- Interface en **français**, montants en **euros**. Sources **françaises** uniquement : ebay.fr, vinted.fr, leboncoin.fr, Cardmarket (FR). *(Choix de Claude)*
- **Volume** : jusqu'à 5 utilisateurs au départ, 150 à 200 exemplaires chacun, soit au plus ~1 000 produits distincts à relever par jour sur 4 sources.
- **Aucune donnée existante** à importer : pas d'import dans la première version.
- Code source sur un dépôt GitHub privé `Nova686/kairos` ; projet personnel, sans lien avec un employeur.

## 6. Décisions prises avec l'auteur

| Sujet | Décision |
|---|---|
| Plateforme | Application **web**, ordinateur + iPhone |
| Utilisateurs | L'auteur et des amis proches, comptes séparés, stocks séparés |
| Prix | Annonces en cours **et** ventes conclues ; relevé régulier **et** bouton ; historique conservé ; valeur produit et stock dans le temps |
| Valeur du stock | Prix d'achat vs prix moyen actuel |
| Scan photo | Plusieurs candidats acceptés quand la reconnaissance n'est pas sûre ; **aucun service payant** |
| Ajout manuel | Texte libre → recherche du produit et de son image en ligne |
| Ventes | Date, prix ; trace conservée |
| Livraisons | Achats et ventes en cours, numéro de suivi ou lien |
| Dettes | Tous les cas : avance d'un ami, achat pour autrui, vente non payée |
| Lieu de stockage | Par exemplaire |
| Catégories | Pokémon (scellé), cartes gradées, jouets, coffrets de maquillage, autres |
| Hébergement | Gratuit ; pas d'existant |
| Nom / dépôt | Kairos, dépôt GitHub privé `Nova686/kairos` |
| Calcul de la valeur | Médiane par source (annonces en cours + ventes conclues), puis médiane entre sources, relevés de plus de 7 jours ignorés, **toujours selon l'état de l'exemplaire** |
| Détail des prix | Par source **et par état** |
| Lots, frais | Vente en lot, achat en lot réparti, frais notés, bénéfice net ; port inclus ou non précisé à la vente |
| Machine à domicile | Aucune ; si Oracle est bloqué, trouver une alternative gratuite |

## 7. Choix techniques (choix de Claude, modifiables)

- **Framework** : Nuxt 3 (TypeScript) en application complète — pages + serveur Nitro (routes API, tâches planifiées). L'auteur connaît bien Nuxt. UI avec **Vuetify 3**, PWA via `@vite-pwa/nuxt`.
- **Base de données** : PostgreSQL avec l'extension **pgvector** (recherche visuelle). ORM laissé au constructeur (Drizzle suggéré).
- **Hébergement** : une VM **Oracle Cloud « Always Free »** (Ampere ARM, jusqu'à 4 cœurs / 24 Go) avec Docker Compose : app Nuxt, PostgreSQL, worker de relevés (Playwright), reverse proxy **Caddy** pour le HTTPS automatique. Nom de domaine gratuit via un sous-domaine DuckDNS (ou équivalent gratuit). L'inscription Oracle demande une carte bancaire non débitée. Le dépôt fournit les scripts d'installation et un guide pas à pas.
- **Authentification** : email + mot de passe, **sur invitation** uniquement (pas d'inscription ouverte). Sessions par cookie.
- **Faisabilité des relevés, d'abord** : la VM Oracle a une IP de datacenter, qui risque d'être bloquée elle aussi, et l'auteur n'a pas de machine à domicile. **La première étape du plan est un test de faisabilité** : depuis la VM, relever un produit réel sur chacune des 4 sources et noter ce qui passe. Pour chaque source bloquée, les alternatives gratuites à essayer, dans l'ordre :
  1. une **API officielle gratuite**, par exemple l'API Browse d'eBay, gratuite avec un compte développeur, pour les annonces en cours ;
  2. les **points d'accès JSON** utilisés par le site lui-même, comme le catalogue de Vinted, avec le cookie de session obtenu sur la page d'accueil ;
  3. des **exécuteurs GitHub Actions** planifiés, gratuits pour un dépôt privé dans la limite du quota mensuel, avec des IP différentes à chaque exécution, qui renvoient les relevés à l'app via une route authentifiée ;
  4. en dernier recours, la source est désactivée et signalée comme telle dans l'interface.

  Si la VM Oracle elle-même est impossible à obtenir, par manque de capacité ARM, le repli est une VM AMD Always Free d'Oracle, plus petite, avec la reconnaissance photo allégée, ou un autre hébergeur gratuit équivalent. Le constructeur choisit selon le résultat du test.
- **Relevés de prix** : un module par source (« adaptateur ») — eBay (annonces en cours + ventes conclues), Vinted (annonces en cours), Cardmarket (prix de tendance / à partir de), Leboncoin (annonces en cours) ; d'autres adaptateurs peuvent s'ajouter. Exécution par Playwright dans un worker séparé de l'app, avec file d'attente, délais entre requêtes, et toujours anonyme (jamais connecté avec le compte d'un utilisateur, pour ne mettre aucun compte en danger). Relevé quotidien de tous les produits détenus en stock par au moins un utilisateur ; le bouton met le produit en tête de file.
- **Gouvernance du catalogue partagé** *(choix de Claude)* : tout membre peut corriger une fiche produit, une association EAN, une requête de recherche, ou exclure une annonce. La correction vaut pour tous, et chaque modification est journalisée (qui, quand, avant/après), avec un retour arrière possible.
- **Fiabilité des prix** : chaque produit a, par source, une requête de recherche **éditable** et des mots-clés d'exclusion ; les valeurs aberrantes sont écartées statistiquement (médiane / écart interquartile) ; chaque relevé enregistre les annonces retenues avec leur lien, consultables, pour qu'on voie d'où vient le chiffre et qu'on puisse exclure une annonce.
- **Code-barres** : décodage dans le navigateur (bibliothèque type `@zxing/browser`). Recherche : d'abord le catalogue partagé (association EAN → produit apprise), puis une base gratuite de codes-barres si disponible, sinon identification manuelle une fois, mémorisée pour tous.
- **Reconnaissance photo, gratuite et sur le serveur** :
  - OCR (Tesseract, français + anglais) pour lire le texte de la boîte (extension, « Coffret Dresseur d'Élite »…) ;
  - embeddings visuels (modèle type CLIP exécuté localement, ex. ONNX) comparés aux images du catalogue via pgvector ;
  - combinaison des deux scores → produit proposé directement au-delà d'un seuil de confiance, sinon les ~5 meilleurs candidats ; possibilité de basculer vers la recherche texte.
  - Chaque produit identifié ajoute son image au catalogue : la reconnaissance s'améliore avec l'usage.
  - L'API gratuite Gemini reste une piste secondaire, non retenue comme base (quotas et conditions instables).
- **Recherche texte / images** : catalogue partagé, puis résultats des adaptateurs de prix (titres + images d'annonces), et l'API gratuite **Pokémon TCG** (pokemontcg.io) pour les cartes.

## 8. Modèle de données (esquisse)

- **Utilisateur** : compte, invitations.
- **Produit** *(catalogue partagé entre tous)* : nom, catégorie (Pokémon scellé, carte gradée, jouet, maquillage, autre), type (ETB, display, coffret…), extension/gamme, langue, codes EAN (plusieurs), images, requêtes de recherche par source.
- **Exemplaire** *(appartient à un utilisateur)* : produit, état (échelle Kairos de sa catégorie), prix d'achat, date d'achat, lieu, statut (`en livraison` → `en stock` → `vendu – en livraison` → `vendu`), suivi d'achat (numéro ou lien), notes. Pour une carte gradée : société de gradation, note, numéro de certificat.
- **Lieu** *(par utilisateur)* : libellé.
- **Correspondance d'états** : pour chaque catégorie et chaque source, l'état de la source ↔ l'état Kairos (table de configuration, modifiable).
- **Relevé de prix** *(partagé)* : produit (et, pour les cartes gradées, société + note), source, date, type (en cours / vendu), **état** (vocabulaire de la source + état Kairos correspondant), moyenne, médiane, minimum, nombre d'annonces, annonces retenues (titre, prix, état, lien).
- **Achat** : date, vendeur ou plateforme, prix total, frais (port…), suivi de livraison ; regroupe **un ou plusieurs** exemplaires, avec répartition du prix total entre eux.
- **Vente** : **un ou plusieurs** exemplaires, date, prix total, port inclus ou non, frais (commission, port payé, emballage), plateforme, acheteur (personne), suivi d'expédition, date de livraison ; répartition du prix entre exemplaires pour le bénéfice net par exemplaire.
- **Journal du catalogue** : modifications du catalogue partagé (auteur, date, avant/après).
- **Personne** *(par utilisateur)* : nom libre (ami, acheteur Vinted, famille) ; pas de lien avec un compte Kairos.
- **Dette** : propriétaire, personne, montant, sens (on me doit / je dois), motif, exemplaire ou vente liés éventuellement, date, date de règlement.

Visibilité : le catalogue, les associations EAN, les relevés de prix et le journal du catalogue sont communs ; exemplaires, achats, lieux, ventes, personnes et dettes sont privés à leur propriétaire.

## 9. Écrans principaux (indicatifs)

- **Tableau de bord** : valeur actuelle vs coût du stock, courbe dans le temps, plus-value latente, ventes récentes, colis en cours, solde des dettes.
- **Stock** : liste filtrable (catégorie, lieu, statut), plus-value par exemplaire.
- **Fiche produit** : image, prix par source et par état, courbe historique, annonces retenues, bouton « relever maintenant », réglage des requêtes de recherche.
- **Ajouter** : scan code-barres / photo / texte → choix du produit → formulaire exemplaire.
- **Ventes**, **Livraisons**, **Dettes** (récap par personne), **Lieux**, **Réglages**.

## 10. Laissé au constructeur

Choix de l'ORM et des bibliothèques précises, structure du code, stratégie de tests, détail des sélecteurs de scraping, seuils de confiance de la reconnaissance, fréquence exacte et étalement des relevés, design visuel.

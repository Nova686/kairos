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
3. **Relevé des prix** sur plusieurs sources, **automatique à intervalle régulier** (quotidien) **et à la demande** via un bouton (un produit ou tout le stock). Les annonces **en cours** comptent autant que les ventes conclues ; chaque source garde son propre prix. Sources retenues après le sondage du 2026-11-02 (`docs/spikes/2026-11-02-price-sources.md`), toutes **officielles et gratuites** :
   - **eBay** : API Browse officielle, place de marché `EBAY_FR`. Elle donne les annonces en cours avec leur état, pour toutes les catégories. C'est la source principale du prix par état. Les ventes conclues ne sont pas accessibles.
   - **Cardmarket** : fichiers publics quotidiens (`price_guide_<jeu>.json`, `products_singles_<jeu>.json`, `products_nonsingles_<jeu>.json`). Ils donnent, par produit, la moyenne, le minimum, la tendance et les moyennes sur 1, 7 et 30 jours, sans ventilation par état. Couvre Pokémon, scellé et cartes, et les autres jeux pour plus tard (One Piece, Lorcana, Magic, Yu-Gi-Oh…).
   - **TCGdex** : API gratuite sans clé. Elle donne les cartes Pokémon sous leur **nom français** avec leur prix Cardmarket.
   - **pokemontcg.io** : API gratuite, avec une clé gratuite. Elle donne les prix Cardmarket et TCGplayer par carte, en second avis.
   - **Vinted et Leboncoin** : aucune voie officielle. On y passe par une **saisie manuelle** : l'utilisateur note un prix vu, avec l'état, la date et éventuellement le lien de l'annonce. Ce relevé manuel compte comme un relevé de la source.
   - **Aucun relevé par navigateur automatisé** : les quatre sites bloquent ce type d'accès, et le contourner est exclu.
4. **Historique conservé** de chaque relevé → courbe de valeur par produit et courbe de valeur du stock entier dans le temps.
5. **Valeur du stock** = deux montants côte à côte : somme des prix d'achat et somme des prix moyens actuels (plus-value latente par exemplaire et globale). Règle de calcul validée par l'auteur :
   - l'**état de l'exemplaire est toujours pris en compte** : on ne retient que les annonces dont l'état correspond au sien ;
   - pour chaque source, on calcule la **médiane** de ces annonces en cours, et celle des ventes conclues quand la source en fournit ;
   - la valeur de l'exemplaire est la **médiane de ces chiffres toutes sources confondues**, en ignorant les relevés de plus de 7 jours ;
   - deux exemplaires du même produit dans des états différents ont donc des valeurs différentes ;
   - *(choix de Claude)* quand aucune annonce récente ne correspond à cet état, on prend l'état le plus proche disponible, et la valeur est affichée comme **approximative**, avec l'état réellement utilisé.
   - *(choix de Claude)* les chiffres Cardmarket, TCGdex et pokemontcg.io n'ont pas d'état. Ils comptent comme `neuf scellé` pour le scellé, et comme `NM` pour une carte non gradée. Ils sont ignorés pour les autres états et pour les cartes gradées.
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
- **Uniquement des voies officielles** : les relevés passent par des API et des fichiers publiés pour cet usage, côté serveur. Mesuré le 2026-11-02 : eBay, Vinted, Leboncoin et Cardmarket bloquent un navigateur automatisé, même depuis une IP de particulier. Le contournement est exclu.
- **Clés à fournir par l'auteur** dans `.env`, jamais versionné : `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `POKEMONTCG_API_KEY`, `PSA_API_TOKEN`. Une source dont la clé manque est désactivée, et l'interface le signale.
- Interface en **français**, montants en **euros**. Sources **françaises** uniquement : ebay.fr, vinted.fr, leboncoin.fr, Cardmarket (FR). *(Choix de Claude)*
- **Volume** : jusqu'à 5 utilisateurs au départ, 150 à 200 exemplaires chacun, soit au plus ~1 000 produits distincts à relever par jour. Un appel eBay par produit et par jour reste dans le quota gratuit. Les fichiers Cardmarket se téléchargent une fois par jour pour tous les produits.
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
| Sources de prix | eBay (API officielle), Cardmarket (fichiers publics), TCGdex, pokemontcg.io ; Vinted et Leboncoin en saisie manuelle |
| Sources d'identification | PSA (certificat → carte + note), Open Beauty Facts (cosmétiques), UPCitemdb (codes-barres, 100 par jour) ; Brickset écarté |

## 7. Choix techniques (choix de Claude, modifiables)

- **Framework** : Nuxt 3 (TypeScript) en application complète — pages + serveur Nitro (routes API, tâches planifiées). L'auteur connaît bien Nuxt. UI avec **Vuetify 3**, PWA via `@vite-pwa/nuxt`.
- **Base de données** : PostgreSQL avec l'extension **pgvector** (recherche visuelle). ORM laissé au constructeur (Drizzle suggéré).
- **Hébergement** : une VM **Oracle Cloud « Always Free »** (Ampere ARM, jusqu'à 4 cœurs / 24 Go) avec Docker Compose : app Nuxt, PostgreSQL, worker de relevés (appels d'API), reverse proxy **Caddy** pour le HTTPS automatique. Nom de domaine gratuit via un sous-domaine DuckDNS (ou équivalent gratuit). L'inscription Oracle demande une carte bancaire non débitée. Le dépôt fournit les scripts d'installation et un guide pas à pas.
- **Authentification** : email + mot de passe, **sur invitation** uniquement (pas d'inscription ouverte). Sessions par cookie.
- **Relevés de prix** : un module par source (« adaptateur ») qui renvoie des observations normalisées : source, type, état de la source, prix en centimes, lien. On y trouve eBay (API Browse, jeton OAuth « client credentials », filtre d'état), Cardmarket (téléchargement quotidien des fichiers, rapprochement par `idProduct`), TCGdex, pokemontcg.io, et la saisie manuelle Vinted / Leboncoin. Un worker séparé de l'app gère une file d'attente et respecte les quotas. Relevé quotidien de tous les produits détenus en stock par au moins un utilisateur ; le bouton met le produit en tête de file.
- **Rapprochement d'un produit avec chaque source** : chaque produit du catalogue garde son identifiant par source quand il existe (`idProduct` Cardmarket, id TCGdex / pokemontcg.io), et une requête de recherche eBay éditable. Le rapprochement est proposé automatiquement à la création du produit, puis confirmé ou corrigé par l'utilisateur.
- **Hébergement de repli** : si la VM ARM d'Oracle est indisponible, faute de capacité, le repli est une VM AMD Always Free d'Oracle, plus petite, avec une reconnaissance photo allégée. Sans navigateur automatisé, l'application tient sur cette petite machine.
- **Gouvernance du catalogue partagé** *(choix de Claude)* : tout membre peut corriger une fiche produit, une association EAN, une requête de recherche, ou exclure une annonce. La correction vaut pour tous, et chaque modification est journalisée (qui, quand, avant/après), avec un retour arrière possible.
- **Fiabilité des prix** : chaque produit a, par source, une requête de recherche **éditable** et des mots-clés d'exclusion ; les valeurs aberrantes sont écartées statistiquement (médiane / écart interquartile) ; chaque relevé enregistre les annonces retenues avec leur lien, consultables, pour qu'on voie d'où vient le chiffre et qu'on puisse exclure une annonce.
- **Code-barres** : décodage dans le navigateur (bibliothèque type `@zxing/browser`). Recherche dans cet ordre :
  1. le catalogue partagé (association EAN → produit apprise) ;
  2. **Open Beauty Facts** pour les cosmétiques ;
  3. **UPCitemdb**, limité à 100 recherches par jour, pour le reste ;
  4. sinon, identification manuelle une fois, mémorisée pour tous.
- **Cartes gradées** : le numéro de certificat, scanné ou saisi, est envoyé à l'**API publique PSA** (environ 100 appels par jour). Elle renvoie la carte et la note. Les autres sociétés de gradation sont saisies à la main.
- **Reconnaissance photo, gratuite et sur le serveur** :
  - OCR (Tesseract, français + anglais) pour lire le texte de la boîte (extension, « Coffret Dresseur d'Élite »…) ;
  - embeddings visuels (modèle type CLIP exécuté localement, ex. ONNX) comparés aux images du catalogue via pgvector ;
  - combinaison des deux scores → produit proposé directement au-delà d'un seuil de confiance, sinon les ~5 meilleurs candidats ; possibilité de basculer vers la recherche texte.
  - Chaque produit identifié ajoute son image au catalogue : la reconnaissance s'améliore avec l'usage.
  - L'API gratuite Gemini reste une piste secondaire, non retenue comme base (quotas et conditions instables).
- **Recherche texte / images** : catalogue partagé, puis catalogue Cardmarket (noms anglais) et **TCGdex** (noms français) pour Pokémon, puis résultats eBay (titres + images d'annonces) pour tout le reste.

## 8. Modèle de données (esquisse)

- **Utilisateur** : compte, invitations.
- **Produit** *(catalogue partagé entre tous)* : nom, catégorie (Pokémon scellé, carte gradée, jouet, maquillage, autre), type (ETB, display, coffret…), extension/gamme, langue, codes EAN (plusieurs), images, identifiants par source (`idProduct` Cardmarket, id TCGdex, id pokemontcg.io), requête de recherche eBay et mots-clés d'exclusion.
- **Exemplaire** *(appartient à un utilisateur)* : produit, état (échelle Kairos de sa catégorie), prix d'achat, date d'achat, lieu, statut (`en livraison` → `en stock` → `vendu – en livraison` → `vendu`), suivi d'achat (numéro ou lien), notes. Pour une carte gradée : société de gradation, note, numéro de certificat.
- **Lieu** *(par utilisateur)* : libellé.
- **Correspondance d'états** : pour chaque catégorie et chaque source, l'état de la source ↔ l'état Kairos (table de configuration, modifiable).
- **Relevé de prix** *(partagé)* : produit (et, pour les cartes gradées, société + note), source, date, type (en cours / vendu / agrégat de la source / saisie manuelle), **état** (vocabulaire de la source + état Kairos correspondant), moyenne, médiane, minimum, nombre d'annonces, annonces retenues (titre, prix, état, lien) ; pour une saisie manuelle, l'auteur de la saisie.
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

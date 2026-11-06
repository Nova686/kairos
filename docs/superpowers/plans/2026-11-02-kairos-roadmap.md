# Kairos — feuille de route des plans

La conception (`docs/superpowers/specs/2026-11-02-kairos-design.md`) couvre cinq sous-systèmes. Chacun a fait l'objet de son propre plan, écrit au moment de le construire, et chacun livre un logiciel qui fonctionne et se teste seul. Les cinq plans sont construits, ainsi que la refonte visuelle « Coffre », sur la branche `worktree-design-doc` (PR #1, pas encore fusionnée dans `main`).

| # | Plan | Livre | Dépend de |
|---|------|-------|-----------|
| 1 | Adaptateurs de sources | Adaptateurs officiels : eBay (API Browse), Cardmarket (fichiers publics), TCGdex, pokemontcg.io, PSA, Open Beauty Facts, UPCitemdb ; sonde locale et GitHub Actions ; rapport | — |
| 2 | Socle de l'application | Nuxt 4 + Vuetify 4 + Drizzle (PGlite en test et en local, PostgreSQL en production) : comptes sur invitation, catalogue partagé et son journal, exemplaires, états, lieux, achats et ventes (lots, frais, port), livraisons, personnes, dettes, ajout manuel par texte | — |
| 3 | Relevés et valeur | Worker de relevés (planifié + bouton), saisie manuelle des prix vus sur Vinted / Leboncoin, historique par source et par état, correspondance d'états, valeur par exemplaire, courbes, tableau de bord | 1, 2 |
| 4 | Scan | Code-barres dans Safari (catalogue, Open Beauty Facts, UPCitemdb), certificat PSA, apprentissage EAN → produit, reconnaissance photo (OCR + empreintes CLIP calculées sur le serveur), candidats | 2 |
| 5 | Hébergement | VPS OVHcloud (x86, Ubuntu 24.04) avec un domaine OVHcloud, Docker Compose (application, PostgreSQL 17, Caddy, sauvegardes ; DuckDNS et copie hors machine en option), PWA, déploiement avec retour arrière, mode sans photo si la mémoire manque | 1, 2 |

Révision 2 du 2026-11-02 : le relevé par navigateur automatisé est abandonné, car tous les sites le bloquent et le contournement est exclu. Seules restent les voies officielles, et l'application n'a pas besoin de navigateur automatisé sur le serveur.

Écarts entre les plans écrits et ce qui est construit :
- l'application tourne sur **Nuxt 4** (et Vuetify 4), pas Nuxt 3 ;
- les empreintes des photos sont rangées dans des colonnes `real[]` de PostgreSQL et comparées en JavaScript (produit scalaire de vecteurs normalisés, donc similarité cosinus, sur une matrice gardée en mémoire) : **pas de pgvector**, et la base de production est l'image officielle `postgres:17` ;
- un prix saisi à la main avec la source « Autre » compte dans la valeur comme ceux de Vinted et de Leboncoin, avec sa propre médiane (le plan 3 ne retenait que Vinted et Leboncoin) ;
- l'hébergement visé n'est plus une VM Oracle « Always Free » mais un VPS OVHcloud payant, sur un domaine acheté chez OVHcloud ; DuckDNS devient facultatif (profil `duckdns`, annexe A du guide) ;
- la sauvegarde quotidienne tourne à 03:30 UTC sur le disque de la machine ; une copie vers tout stockage compatible S3 (par exemple l'Object Storage S3 du Public Cloud d'OVHcloud) existe en option, désactivée par défaut (guide d'installation, étape 11.2). Elle garde les 14 copies les plus récentes et ne supprime rien tant que la machine n'a pas de sauvegarde de moins de 2 jours.

## Fichiers des plans

| # | Plan | Fichier | État |
|---|------|---------|------|
| 1 | Adaptateurs de sources | `2026-11-02-price-source-probe.md` | construit (PR #1) |
| 2 | Socle de l'application | `2026-11-02-application-foundation.md` | construit (PR #1) |
| 3 | Relevés et valeur | `2026-11-02-prices-and-valuation.md` | construit (PR #1) |
| 4 | Scan | `2026-11-02-scan.md` | construit (PR #1) |
| 5 | Hébergement | `2026-11-02-hosting.md` | construit (PR #1) ; guide `docs/hebergement/installer-kairos-sur-un-vps-ovh.md` |
| — | Refonte « Coffre » | `2026-11-05-coffre-redesign.md` | construite (PR #1) |

La refonte « Coffre » applique le thème sombre à tous les écrans, sur ordinateur (menu latéral) comme sur iPhone (barre de navigation en bas, onglets Code-barres / Photo / Texte réservés au téléphone). Ont suivi : le logo D retenu, c'est-à-dire le mot « kairos » dont le point du i est un losange, avec une icône d'application k + losange ; puis le membre connecté et le bouton de déconnexion, déplacés des réglages vers le menu latéral et le menu « Plus » du téléphone. Les polices (Sora, IBM Plex Sans, IBM Plex Mono) sont servies par l'application elle-même, sans appel à Google Fonts, et mises en cache par le service worker de la PWA.

## À faire par l'auteur

- **VPS OVHcloud** (VPS-1 4 Go ou VPS-2 8 Go, Ubuntu 24.04) et sa clé SSH : guide d'installation, étapes 1 à 3.
- **Entrée DNS** du domaine OVHcloud vers le VPS (A, et AAAA si l'IPv6 du VPS est configurée) : étape 4. DuckDNS seulement sans domaine à vous : annexe A.
- **Clés de l'application** dans `deploy/.env` : `EBAY_CLIENT_ID` et `EBAY_CLIENT_SECRET` (clés eBay de production ; sans elles la source eBay reste désactivée), et en option `POKEMONTCG_API_KEY` et `PSA_API_TOKEN`.
- Facultatif, **secrets de la sonde** dans GitHub (Settings › Secrets and variables › Actions) pour le workflow « Probe price and identification sources » : `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `POKEMONTCG_API_KEY`, `PSA_API_TOKEN` et `PSA_PROBE_CERTIFICATE` (un numéro de certificat PSA réel). Pour lancer la sonde sur votre ordinateur (`npm run probe`), mettez les mêmes variables dans le `.env` à la racine du dépôt ; `PSA_PROBE_CERTIFICATE` ne sert qu'à la sonde et n'a rien à faire dans `deploy/.env`.
- **Secrets GitHub du déploiement** (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_HOST_FINGERPRINT`, `DEPLOY_SSH_KEY`) pour lancer le workflow « deploy » depuis GitHub : étape 10. Sans eux, `./deploy/deploy.sh` sur la machine suffit.
- **Minutes GitHub Actions** : le dépôt est privé, donc les workflows consomment le quota gratuit du compte (2 000 minutes par mois sur l'offre GitHub Free). Chaque mise à jour d'une pull request relance les tests et la construction de l'image. Surveillez la consommation dans Settings › Billing and plans et laissez la limite de dépense à 0 $, pour que rien ne soit facturé.
- **Fusionner la PR #1 dans `main`** : le script de déploiement et le workflow « deploy » installent `origin/main`.
- Facultatif : la **copie des sauvegardes hors de la machine**, vers un compartiment de n'importe quel stockage compatible S3 avec sa clé d'accès (par exemple l'Object Storage S3 du Public Cloud d'OVHcloud) : étape 11.2.

## Reste à faire

Les points mineurs reportés pendant la construction sont listés, plan par plan, dans la description de la PR #1 (section « Décisions prises en cours de route et points reportés »). Tous ont été traités ou écartés, avec leur raison, le 2026-11-06 :
- refonte « Coffre » et hébergement : polices hébergées par l'application, couleurs tirées d'une seule source (dégradés compris), liste de stock filtrée par produit côté serveur, onglet Code-barres affiché dès le premier rendu sur téléphone, colonnes gradées regroupées malgré les variantes d'écriture (un seul point par jour dans la courbe), lien de l'alerte caméra vers le texte quand la photo est désactivée, santé publique réduite à son état, copie des sauvegardes hors machine gardant les 14 copies les plus récentes, image DuckDNS fournie avec curl, test de la rotation des 14 sauvegardes ;
- socle, relevés et scan : connexion protégée contre la découverte des emails inscrits et limitée en cas d'échecs répétés (5 par email et 10 par adresse et par minute, adresse lue derrière Caddy seulement), droits d'administrateur relus en base, écritures limitées au propriétaire, conflits de base de données répondus en 409 en français, verrous et contrôles dans les transactions qui pouvaient se croiser, dates et montants contrôlés aussi par les services, adresses IPv6 qui cachent une IPv4 interne refusées, et de nombreux tests ajoutés.

Il ne reste aucun point reporté ouvert. Seule la première copie hors machine vers un vrai stockage n'a pas pu être essayée (le test utilise un faux stockage S3) : vérifiez-la dans son journal à l'étape 11.2, et en cas d'erreur de signature ou de somme de contrôle, reportez-vous à la page de rclone propre à votre fournisseur.

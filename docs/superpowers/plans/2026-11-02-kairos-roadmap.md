# Kairos — feuille de route des plans

La conception (`docs/superpowers/specs/2026-11-02-kairos-design.md`) couvre cinq sous-systèmes. Chacun a fait l'objet de son propre plan, écrit au moment de le construire, et chacun livre un logiciel qui fonctionne et se teste seul. Les cinq plans sont construits, ainsi que la refonte visuelle « Coffre », sur la branche `worktree-design-doc` (PR #1, pas encore fusionnée dans `main`).

| # | Plan | Livre | Dépend de |
|---|------|-------|-----------|
| 1 | Adaptateurs de sources | Adaptateurs officiels : eBay (API Browse), Cardmarket (fichiers publics), TCGdex, pokemontcg.io, PSA, Open Beauty Facts, UPCitemdb ; sonde locale et GitHub Actions ; rapport | — |
| 2 | Socle de l'application | Nuxt 4 + Vuetify 4 + Drizzle (PGlite en test et en local, PostgreSQL en production) : comptes sur invitation, catalogue partagé et son journal, exemplaires, états, lieux, achats et ventes (lots, frais, port), livraisons, personnes, dettes, ajout manuel par texte | — |
| 3 | Relevés et valeur | Worker de relevés (planifié + bouton), saisie manuelle des prix vus sur Vinted / Leboncoin, historique par source et par état, correspondance d'états, valeur par exemplaire, courbes, tableau de bord | 1, 2 |
| 4 | Scan | Code-barres dans Safari (catalogue, Open Beauty Facts, UPCitemdb), certificat PSA, apprentissage EAN → produit, reconnaissance photo (OCR + empreintes CLIP calculées sur le serveur), candidats | 2 |
| 5 | Hébergement | VM Oracle Always Free, Docker Compose (application, PostgreSQL 17, Caddy, DuckDNS, sauvegardes), PWA, déploiement avec retour arrière, mode sans photo pour la petite machine | 1, 2 |

Révision 2 du 2026-11-02 : le relevé par navigateur automatisé est abandonné, car tous les sites le bloquent et le contournement est exclu. Seules restent les voies officielles, et l'application n'a pas besoin de navigateur automatisé sur le serveur.

Écarts entre les plans écrits et ce qui est construit :
- l'application tourne sur **Nuxt 4** (et Vuetify 4), pas Nuxt 3 ;
- les empreintes des photos sont rangées dans des colonnes `real[]` de PostgreSQL et comparées en JavaScript (produit scalaire de vecteurs normalisés, donc similarité cosinus, sur une matrice gardée en mémoire) : **pas de pgvector**, et la base de production est l'image officielle `postgres:17` ;
- la sauvegarde quotidienne tourne à 03:30 UTC sur le disque de la machine ; une copie gratuite vers l'Object Storage d'Oracle existe en option, désactivée par défaut (guide d'installation, étape 11.2).

## Fichiers des plans

| # | Plan | Fichier | État |
|---|------|---------|------|
| 1 | Adaptateurs de sources | `2026-11-02-price-source-probe.md` | construit (PR #1) |
| 2 | Socle de l'application | `2026-11-02-application-foundation.md` | construit (PR #1) |
| 3 | Relevés et valeur | `2026-11-02-prices-and-valuation.md` | construit (PR #1) |
| 4 | Scan | `2026-11-02-scan.md` | construit (PR #1) |
| 5 | Hébergement | `2026-11-02-hosting.md` | construit (PR #1) ; guide `docs/hebergement/installer-kairos-sur-oracle.md` |
| — | Refonte « Coffre » | `2026-11-05-coffre-redesign.md` | construite (PR #1) |

La refonte « Coffre » applique le thème sombre à tous les écrans, sur ordinateur (menu latéral) comme sur iPhone (barre de navigation en bas, onglets Code-barres / Photo / Texte réservés au téléphone). Ont suivi : le logo D retenu, c'est-à-dire le mot « kairos » dont le point du i est un losange, avec une icône d'application k + losange ; puis le membre connecté et le bouton de déconnexion, déplacés des réglages vers le menu latéral et le menu « Plus » du téléphone. Les polices (Sora, IBM Plex Sans, IBM Plex Mono) sont servies par l'application elle-même, sans appel à Google Fonts, et mises en cache par le service worker de la PWA.

## À faire par l'auteur

- **Compte Oracle Cloud « Always Free »** et sa machine virtuelle : guide d'installation, étapes 1 à 3.
- **Sous-domaine DuckDNS** et son jeton : étape 4.
- **Clés eBay de production** (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`) dans `deploy/.env` ; sans elles la source eBay reste désactivée. Facultatif : `POKEMONTCG_API_KEY`, `PSA_API_TOKEN` (+ `PSA_PROBE_CERTIFICATE` pour la sonde).
- **Secrets GitHub du déploiement** (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_HOST_FINGERPRINT`, `DEPLOY_SSH_KEY`) pour lancer le workflow « deploy » depuis GitHub : étape 10. Sans eux, `./deploy/deploy.sh` sur la machine suffit.
- **Minutes GitHub Actions** : le dépôt est privé, donc les workflows consomment le quota gratuit du compte (2 000 minutes par mois sur l'offre GitHub Free). Chaque mise à jour d'une pull request relance les tests et la construction de l'image. Surveillez la consommation dans Settings › Billing and plans et laissez la limite de dépense à 0 $, pour que rien ne soit facturé.
- **Fusionner la PR #1 dans `main`** : le script de déploiement et le workflow « deploy » installent `origin/main`.
- Facultatif : la **copie des sauvegardes hors de la machine** (compartiment Object Storage et clé « Customer Secret Key », gratuits) : étape 11.2.

## Reste à faire

Les points mineurs reportés pendant la construction sont listés, plan par plan, dans la description de la PR #1 (section « Décisions prises en cours de route et points reportés »). Ceux de la refonte « Coffre » et de l'hébergement ont été traités le 2026-11-06 : polices hébergées par l'application, couleurs tirées d'une seule source, liste de stock filtrée par produit côté serveur, onglet Code-barres affiché dès le premier rendu sur téléphone, colonnes gradées regroupées malgré les variantes d'écriture, lien de l'alerte caméra vers le texte quand la photo est désactivée, santé publique réduite à son état, copie des sauvegardes hors machine, image DuckDNS fournie avec curl, test de la rotation des 14 sauvegardes. La liste de la PR fait foi pour ce qui reste.

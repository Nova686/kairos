# Kairos — feuille de route des plans

La conception (`docs/superpowers/specs/2026-11-02-kairos-design.md`) couvre cinq sous-systèmes. Chacun fait l'objet de son propre plan, écrit au moment de le construire, et chacun livre un logiciel qui fonctionne et se teste seul.

| # | Plan | Livre | Dépend de |
|---|------|-------|-----------|
| 1 | Adaptateurs de sources | Adaptateurs officiels : eBay (API Browse), Cardmarket (fichiers publics), TCGdex, pokemontcg.io, PSA, Open Beauty Facts, UPCitemdb ; sonde locale et GitHub Actions ; rapport | — |
| 2 | Socle de l'application | Nuxt 3 + Vuetify + PostgreSQL : comptes sur invitation, catalogue partagé et son journal, exemplaires, états, lieux, achats et ventes (lots, frais, port), livraisons, personnes, dettes, ajout manuel par texte | — |
| 3 | Relevés et valeur | Worker de relevés (planifié + bouton), saisie manuelle des prix vus sur Vinted / Leboncoin, historique par source et par état, correspondance d'états, valeur par exemplaire, courbes, tableau de bord | 1, 2 |
| 4 | Scan | Code-barres dans Safari (catalogue, Open Beauty Facts, UPCitemdb), certificat PSA, apprentissage EAN → produit, reconnaissance photo (OCR + embeddings + pgvector), candidats | 2 |
| 5 | Hébergement | VM Oracle Always Free, Docker Compose, Caddy + DuckDNS, PWA, sauvegardes, repli selon le rapport du plan 1 | 1, 2 |

Le plan 1 passe en premier. Révision 2 du 2026-11-02 : le relevé par navigateur automatisé est abandonné, car tous les sites le bloquent et le contournement est exclu. Seules restent les voies officielles, et l'application n'a plus besoin de navigateur automatisé sur le serveur.

## Fichiers des plans

| # | Plan | Fichier | État |
|---|------|---------|------|
| 1 | Adaptateurs de sources | `2026-11-02-price-source-probe.md` | construit (PR #1) |
| 2 | Socle de l'application | `2026-11-02-application-foundation.md` | écrit, 10 tâches |
| 3 | Relevés et valeur | `2026-11-02-prices-and-valuation.md` | écrit, 8 tâches |
| 4 | Scan | `2026-11-02-scan.md` | écrit, 6 tâches |
| 5 | Hébergement | `2026-11-02-hosting.md` | écrit, 6 tâches |

Ordre de construction : 2, puis 3 et 4 (indépendants l'un de l'autre), puis 5. Le plan 5 peut démarrer dès la fin du plan 2 si l'on veut l'application en ligne plus tôt.

## À faire par l'auteur

- Compte développeur eBay : clés de production dans `.env` (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`).
- Facultatif : `POKEMONTCG_API_KEY`, `PSA_API_TOKEN` (+ `PSA_PROBE_CERTIFICATE` pour la sonde).
- Avant le plan 5 : compte Oracle Cloud « Always Free » et sous-domaine DuckDNS.

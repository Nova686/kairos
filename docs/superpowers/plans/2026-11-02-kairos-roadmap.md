# Kairos — feuille de route des plans

La conception (`docs/superpowers/specs/2026-11-02-kairos-design.md`) couvre cinq sous-systèmes. Chacun fait l'objet de son propre plan, écrit au moment de le construire, et chacun livre un logiciel qui fonctionne et se teste seul.

| # | Plan | Livre | Dépend de |
|---|------|-------|-----------|
| 1 | Sondage des sources de prix | Adaptateurs eBay / Vinted / Leboncoin / Cardmarket en TypeScript, sonde lançable en local et sur GitHub Actions, rapport de faisabilité | — |
| 2 | Socle de l'application | Nuxt 3 + Vuetify + PostgreSQL : comptes sur invitation, catalogue partagé et son journal, exemplaires, états, lieux, achats et ventes (lots, frais, port), livraisons, personnes, dettes, ajout manuel par texte | — |
| 3 | Relevés et valeur | Worker de relevés (planifié + bouton), historique par source et par état, correspondance d'états, valeur par exemplaire, courbes, tableau de bord | 1, 2 |
| 4 | Scan | Code-barres dans Safari, apprentissage EAN → produit, reconnaissance photo (OCR + embeddings + pgvector), candidats | 2 |
| 5 | Hébergement | VM Oracle Always Free, Docker Compose, Caddy + DuckDNS, PWA, sauvegardes, repli selon le rapport du plan 1 | 1, 2 |

Le plan 1 passe en premier : son rapport décide de la façon dont les relevés tournent (VM, GitHub Actions, API officielle) et donc de l'hébergement.

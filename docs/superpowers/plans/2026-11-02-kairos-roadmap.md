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

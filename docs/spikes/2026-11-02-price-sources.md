# Sondage des sources de prix — 2026-11-02

## Mesure : navigateur automatisé, sans déguisement, depuis une IP de particulier

Chromium headless (Playwright), sans aucun contournement, une requête par site, recherche « ETB Évolutions Prismatiques ».

| Source | Réponse | Verdict |
|---|---|---|
| eBay (`www.ebay.fr/sch`) | HTTP 403 | bloqué |
| Vinted (`www.vinted.fr/catalog`) | défi Cloudflare (HTTP 200) | bloqué |
| Leboncoin (`www.leboncoin.fr/recherche`) | HTTP 403 | bloqué |
| Cardmarket (`www.cardmarket.com/fr/Pokemon/Products/Search`) | HTTP 403 | bloqué |

Le poste de mesure passe par un proxy Sophos qui intercepte certaines connexions HTTPS. Pour ces quatre sites, le certificat reçu était bien celui du site (Sectigo, Let's Encrypt, Amazon, Google Trust Services) : les refus viennent donc des sites eux-mêmes, pas du proxy. En revanche, `api.pokemontcg.io` est intercepté par Sophos sur ce réseau, avec un certificat « Sophos SSL CA ». Cette source n'est donc testable que depuis un autre réseau, par exemple GitHub Actions ou le serveur.

Les quatre sites refusent un navigateur automatisé dès l'IP de particulier. Une IP de datacenter (Oracle, GitHub Actions) ne peut que faire pire. Passer outre ces protections reviendrait à les contourner, ce qui est exclu : c'est contraire aux conditions d'utilisation des sites, et refusé par l'outil. **Le relevé par navigateur automatisé est abandonné.**

## Voies officielles et gratuites

| Source | Voie | Ce qu'elle donne | Limites |
|---|---|---|---|
| **Cardmarket** | Fichiers publics quotidiens : `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json` (80 173 produits Pokémon) et `productList/products_nonsingles_6.json` (5 106 produits scellés : ETB, displays, boosters…) | par produit : `avg`, `low`, `trend`, `avg1`, `avg7`, `avg30`. Exemple : ETB Évolutions Prismatiques, id 798930 → avg 151,23 €, low 84 €, trend 147,64 € | Pokémon uniquement ; pas de ventilation par état ni par langue ; un relevé par jour ; pas de cartes gradées |
| **eBay** | API Browse officielle, gratuite avec un compte développeur eBay, place de marché `EBAY_FR` | annonces **en cours**, avec prix, état (`condition`), image et lien ; filtre par état ; Pokémon, jouets, maquillage, cartes gradées | les ventes conclues ne sont pas accessibles (API Marketplace Insights réservée) ; quota quotidien gratuit largement suffisant pour ~1 000 produits |
| **Vinted** | aucune API publique | — | aucune voie officielle |
| **Leboncoin** | aucune API publique | — | aucune voie officielle |

## Sonde des voies officielles (`npm run probe`)

| Source | Référence | Local (réseau avec Sophos) | GitHub Actions (IP datacenter) |
|---|---|---|---|
| Cardmarket | price guide 798930, 798931 | ok, 2 agrégats | ok, 2 agrégats |
| TCGdex | recherche « Dracaufeu » | ok, 113 cartes | ok, 113 cartes |
| TCGdex | carte sv08.5-161 | ok, 1 agrégat | ok, 1 agrégat |
| pokemontcg.io | « Charizard » | erreur, certificat intercepté par Sophos | ok, 1 agrégat |
| UPCitemdb | 0820650853715 | ok | ok |
| Open Beauty Facts | 8005610625645 | ok | ok |
| eBay | 5 recherches | désactivé, clés absentes | désactivé, clés absentes |
| PSA | certificat | désactivé, jeton absent | désactivé, jeton absent |

Conclusion : toutes les voies sans clé répondent depuis une IP de datacenter, donc l'hébergement sur une VM Oracle ne pose pas de problème. eBay et PSA restent à mesurer quand les clés seront fournies, via `npm run probe` en local ou en lançant le workflow « Probe price and identification sources » à la main.

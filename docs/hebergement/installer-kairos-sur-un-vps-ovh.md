# Installer Kairos sur un VPS OVHcloud

Ce guide va pas à pas d'un VPS OVHcloud tout juste commandé jusqu'à un site Kairos en ligne en HTTPS, utilisable depuis l'iPhone, sur un nom de domaine acheté chez OVHcloud. Comptez une à deux heures la première fois.

À la fin, une seule machine fait tourner l'application, PostgreSQL, Caddy (HTTPS automatique) et une sauvegarde quotidienne sur le disque de la machine. Le tout tourne sous Docker Compose (`deploy/compose.yml`). En option, une copie quotidienne de ces sauvegardes part hors de la machine, vers un stockage compatible S3 (étape 11.2). Une mise à jour DuckDNS est aussi possible si vous n'avez pas de domaine à vous (annexe A).

Les valeurs entre chevrons (`<...>`) sont à remplacer par les vôtres. Ne collez jamais de vrais secrets dans un message, une capture ou un dépôt.

Les écrans de l'espace client OVHcloud changent de temps en temps. Quand un intitulé diffère de ce guide, cherchez l'action décrite (ajouter une clé SSH, ajouter une entrée DNS…) plutôt que le libellé exact, et appuyez-vous sur la documentation d'OVHcloud (<https://help.ovhcloud.com>).

## 1. Choisir et commander le VPS

- **Modèle** : un VPS **x86**.
  - **VPS-2 (8 Go de mémoire)** donne de la marge à la reconnaissance par photo, qui télécharge et fait tourner des modèles.
  - **VPS-1 (4 Go)** fait tourner Kairos. Prévoyez alors l'espace d'échange de l'étape 7. Si la mémoire manque, passez la reconnaissance par photo à `off` (étape 6) : l'onglet Photo disparaît et le reste fonctionne.
- **Système** : **Ubuntu 24.04**.
- **Accès** : si la commande propose d'ajouter une clé SSH, donnez la clé publique de l'étape 2. Sinon, OVHcloud envoie par mail les identifiants de la première connexion. Ajoutez alors votre clé à l'étape 3 et ne gardez pas le mot de passe reçu.

Une fois le VPS livré, notez depuis le mail de livraison ou l'espace client :
- son **adresse IPv4** ;
- son **adresse IPv6**, s'il en a une ;
- le **nom d'utilisateur** de connexion, en général `ubuntu`.

Le VPS et le domaine sont payants chez OVHcloud. Rien d'autre dans ce guide ne l'est.

## 2. Préparer la clé SSH

Sur votre ordinateur :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kairos-vps -C "kairos-vps"
```

Gardez le fichier `~/.ssh/kairos-vps` (clé privée) pour vous. C'est `~/.ssh/kairos-vps.pub` (clé publique) que vous donnez à OVHcloud à la commande, ou que vous ajoutez à l'étape 3.

## 3. Préparer la machine

Connectez-vous avec l'utilisateur du mail de livraison :

```bash
ssh -i ~/.ssh/kairos-vps <utilisateur>@<ipv4-du-vps>
```

Si vous vous êtes connecté avec le mot de passe du mail, ajoutez d'abord votre clé, depuis votre ordinateur :

```bash
ssh-copy-id -i ~/.ssh/kairos-vps.pub <utilisateur>@<ipv4-du-vps>
```

Puis vérifiez que `ssh -i ~/.ssh/kairos-vps <utilisateur>@<ipv4-du-vps>` entre sans mot de passe.

Mettez le système à jour :

```bash
sudo apt-get update && sudo apt-get -y upgrade
```

### 3.1 Les ports

Kairos a besoin de quatre ports ouverts :
- **22/tcp** : SSH ;
- **80/tcp** : émission du certificat HTTPS ;
- **443/tcp** : le site ;
- **443/udp** : HTTP/3.

Sur un VPS OVHcloud neuf, il n'y a rien à ouvrir :
- le **Network Firewall** d'OVHcloud, un pare-feu devant l'adresse IP réglable depuis l'espace client, est désactivé par défaut ;
- le pare-feu `ufw` d'Ubuntu n'est pas actif.

Si vous activez le Network Firewall, ajoutez-y des règles qui autorisent ces quatre ports, sans quoi le certificat ne sera pas délivré.

### 3.2 Installer Docker Engine et le plugin Compose

Installez Docker depuis le dépôt apt officiel de Docker. Le paquet `docker.io` d'Ubuntu est plus ancien et n'a pas le plugin Compose.

```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Déconnectez-vous puis reconnectez-vous, pour que le groupe `docker` soit pris en compte, et vérifiez :

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 4. Faire pointer le domaine vers le VPS

Choisissez l'adresse du site, en général un sous-domaine du domaine acheté, par exemple `kairos.<votre-domaine>`. La suite du guide l'appelle `<votre-adresse>`.

Dans l'espace client OVHcloud, ouvrez votre nom de domaine puis sa **zone DNS**, et ajoutez une entrée :
- type **A** ;
- sous-domaine `kairos` (ou celui que vous avez choisi) ;
- cible : l'**adresse IPv4** du VPS.

**IPv6** : ajoutez aussi une entrée de type **AAAA** vers l'adresse IPv6, mais seulement si cette adresse est réellement configurée sur le VPS. `ip -6 addr show scope global` doit l'afficher. Un AAAA vers une IPv6 inactive fait échouer le certificat et les visiteurs passés par IPv6. Dans le doute, mettez seulement l'entrée A : le site marche très bien en IPv4 seul.

Pour utiliser le domaine nu (`<votre-domaine>` sans sous-domaine), modifiez l'entrée A qui existe déjà pour ce nom plutôt que d'en ajouter une seconde. La zone d'un domaine neuf pointe souvent vers une page d'attente d'OVHcloud.

Une modification de la zone met de quelques minutes à quelques heures à se propager. Depuis votre ordinateur, `nslookup kairos.<votre-domaine>` doit renvoyer l'IPv4 du VPS avant de passer à l'étape 7.

## 5. Récupérer le code (dépôt privé)

Le dépôt est privé. Le VPS le lit avec une **clé de déploiement en lecture seule**, qui ne sert qu'à ce dépôt.

Sur le VPS :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kairos-deploy -N "" -C "kairos-deploy"
cat ~/.ssh/kairos-deploy.pub
```

Sur GitHub, ouvrez le dépôt Kairos › Settings › **Deploy keys** › **Add deploy key** :
- collez la clé publique affichée ;
- donnez-lui un titre, par exemple « VPS OVH » ;
- **laissez « Allow write access » décoché**.

De retour sur le VPS, dites à SSH d'utiliser cette clé pour GitHub :

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/kairos-deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh-keyscan github.com > ~/.ssh/github-host-keys.txt
ssh-keygen -lf ~/.ssh/github-host-keys.txt
```

`ssh-keyscan` fait confiance à la première réponse reçue, qui peut venir d'un intercepteur. Comparez donc les empreintes affichées par `ssh-keygen -lf` avec celles que GitHub publie sur <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints>. Si elles correspondent, enregistrez-les puis clonez :

```bash
cat ~/.ssh/github-host-keys.txt >> ~/.ssh/known_hosts
git clone git@github.com:Nova686/kairos.git ~/kairos
cd ~/kairos
git checkout main
```

Le script de mise à jour attend le dépôt dans `~/kairos`.

## 6. Remplir la configuration

```bash
cd ~/kairos
cp deploy/env.example deploy/.env
chmod 600 deploy/.env
```

Générez les deux secrets. Chacun ne s'affiche qu'une fois dans le terminal : copiez-le tout de suite dans le fichier.

```bash
openssl rand -hex 32
openssl rand -hex 24
```

Ouvrez `deploy/.env` (`nano deploy/.env`) et remplacez chaque valeur :

| Variable | Valeur |
|---|---|
| `NUXT_APP_SECRET` | la sortie de `openssl rand -hex 32`, le secret qui scelle les sessions (32 caractères au minimum) |
| `POSTGRES_PASSWORD` | la sortie de `openssl rand -hex 24` ; en hexadécimal il n'a aucun caractère spécial, et il est inséré tel quel dans l'adresse de la base |
| `KAIROS_DOMAIN` | l'adresse choisie à l'étape 4, par exemple `kairos.<votre-domaine>` |
| `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN` | vides : ils ne servent qu'avec DuckDNS (annexe A) |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | les clés de l'application eBay (programme développeurs eBay, API Browse) ; vides si vous n'en avez pas, et la source eBay sera désactivée |
| `POKEMONTCG_API_KEY` | clé gratuite sur <https://dev.pokemontcg.io> ; vide, la source est désactivée |
| `PSA_API_TOKEN` | jeton de l'API PSA (vérification des certificats) ; vide, la source est désactivée |
| `NUXT_PHOTO_RECOGNITION` | `on` ; `off` si la mémoire manque (étape 1) |
| `COMPOSE_PROFILES` et `KAIROS_OFFSITE_*` | vides pour l'instant : `COMPOSE_PROFILES` active les services facultatifs (copie hors machine de l'étape 11.2, DuckDNS de l'annexe A) |

Le fichier `deploy/.env` n'est jamais versionné. Gardez-en **une seule copie**, dans votre gestionnaire de mots de passe, et nulle part ailleurs (ni mail, ni dépôt, ni capture). Sans le `POSTGRES_PASSWORD` exact, une base existante ne se rouvre pas.

Vérifiez que la configuration est complète, sans variable obligatoire manquante :

```bash
docker compose -f deploy/compose.yml config --quiet && echo "configuration valide"
```

## 7. Premier démarrage

**Sur un VPS de 4 Go**, créez d'abord 2 Go d'espace d'échange. Il évite que la construction de l'image ou les modèles de la reconnaissance par photo manquent de mémoire.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Puis, sur toutes les machines :

```bash
docker compose -f deploy/compose.yml up -d --build
```

La première construction prend plusieurs minutes : téléchargement des dépendances, puis compilation. Suivez l'état :

```bash
docker compose -f deploy/compose.yml ps
```

Au bout de quelques minutes, `app`, `database`, `caddy` et `backup` sont « Up », et `app` et `database` sont « healthy ». Puis :

```bash
curl -s https://<votre-adresse>/api/health
```

La réponse attendue est `{"status":"ok"}`. Si la base ne répond pas, c'est `{"status":"degraded"}` avec un code 503. Les tables de la base sont créées automatiquement au démarrage de l'application.

Caddy demande son certificat HTTPS à Let's Encrypt au premier accès, ce qui prend quelques secondes. En cas d'échec, voir le dépannage.

## 8. Créer votre compte administrateur

Il n'y a pas d'inscription publique : le compte se crée en ligne de commande, dans le conteneur de l'application. Le mot de passe est lu sur l'entrée standard. Il n'apparaît donc jamais dans l'historique du shell ni dans la liste des processus.

```bash
cd ~/kairos
read -rsp "Mot de passe : " kairos_password; echo
printf '%s\n' "$kairos_password" | docker compose -f deploy/compose.yml exec -T app node .output/server/create-admin.mjs <votre-email> <votre-prenom>
unset kairos_password
```

La réponse attendue est `Administrateur créé : <votre-email>`. Des messages `NOTICE ... already exists, skipping` s'affichent avant : ce sont les migrations, déjà appliquées au démarrage, et ils sont normaux. Choisissez un mot de passe long et réservé à ce site.

Connectez-vous ensuite sur `https://<votre-adresse>`.

Après cinq échecs de connexion en une minute pour un même email, ou dix pour une même adresse IP, Kairos refuse les essais suivants pendant une minute (« Trop de tentatives de connexion »). Attendez, puis réessayez.

## 9. Installer sur l'iPhone

1. Ouvrez l'adresse du site dans **Safari**. Depuis iOS 16.4, Chrome et Edge savent aussi ajouter un site à l'écran d'accueil ; avant, seul Safari le permettait.
2. Appuyez sur **Partager** (le carré avec une flèche vers le haut) › **« Sur l'écran d'accueil »** › **Ajouter**.
3. Ouvrez Kairos depuis l'icône ainsi créée, et connectez-vous.
4. Au premier scan, par code-barres ou par photo, iOS demande l'accès à l'**appareil photo** : autorisez-le. Si vous avez refusé, passez par Réglages › Apps › Safari › Appareil photo, ou par Réglages › Confidentialité et sécurité › Appareil photo.

La caméra ne fonctionne qu'en HTTPS : c'est une des raisons pour lesquelles le domaine et le certificat sont nécessaires.

## 10. Mettre à jour

Quand une nouvelle version est fusionnée sur la branche `main`, deux façons de l'installer.

**Depuis le VPS** :

```bash
cd ~/kairos
./deploy/deploy.sh
```

Le script :
1. note le commit actuel et récupère `origin/main` ;
2. reconstruit l'image et relance uniquement l'application ;
3. attend qu'elle devienne saine, jusqu'à 2 minutes à raison d'un essai toutes les 2 secondes (`KAIROS_DEPLOY_HEALTH_ATTEMPTS=120 ./deploy/deploy.sh` allonge l'attente).

Si le démarrage échoue ou si la nouvelle version ne devient pas saine, il **remet à la fois l'image précédente et le code précédent** (retour sur le commit noté, en « detached HEAD »), puis s'arrête avec une erreur.

**Après un retour en arrière.** Les migrations de la base ne sont pas annulées. Elles doivent donc rester **additives uniquement** : ajouter des tables ou des colonnes, jamais en supprimer ni en renommer dans la même version que le code qui s'en passe.
- Vérifiez que l'ancienne version fonctionne : `curl https://<votre-adresse>/api/health`, puis une page de l'application.
- Si une migration a été appliquée à moitié, le message d'erreur est dans `docker compose -f deploy/compose.yml logs --tail 100 app`. La sauvegarde de la nuit (étape 11) reste le filet de sécurité.
- Pour réessayer, corrigez sur `main`, puis relancez `./deploy/deploy.sh`. Il repart de `origin/main` quel que soit l'état laissé par le retour en arrière.

**Depuis GitHub**, sans ouvrir de terminal : onglet **Actions** › workflow **deploy** › « Run workflow ». Il se connecte en SSH au VPS et lance le même script. Il demande quatre secrets, à créer une fois dans Settings › Secrets and variables › Actions :

| Secret | Valeur |
|---|---|
| `DEPLOY_HOST` | l'adresse IPv4 du VPS, ou l'adresse du site |
| `DEPLOY_USER` | l'utilisateur de connexion, en général `ubuntu` |
| `DEPLOY_HOST_FINGERPRINT` | l'empreinte de la clé du VPS, au format `SHA256:...`. Sur le VPS : `ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (c'est exactement la commande du README de l'action `appleboy/ssh-action` v1.2.5). Elle évite de se connecter à une machine usurpée. |
| `DEPLOY_SSH_KEY` | le contenu de la clé **privée** de connexion, idéalement un fichier dédié ; sa clé publique doit figurer dans `~/.ssh/authorized_keys` du VPS |

Pour une clé dédiée à GitHub Actions, sur votre ordinateur :
1. `ssh-keygen -t ed25519 -f ~/.ssh/kairos-actions -N ""` ;
2. `ssh-copy-id -i ~/.ssh/kairos-actions.pub -o "IdentityFile ~/.ssh/kairos-vps" <utilisateur>@<ipv4-du-vps>` ;
3. collez le contenu de `~/.ssh/kairos-actions` dans le secret.

Pour limiter ce que cette clé peut faire en cas de fuite, préfixez sa ligne d'une commande forcée dans `~/.ssh/authorized_keys` du VPS (tout sur une seule ligne) :

```text
command="cd ~/kairos && ./deploy/deploy.sh",no-port-forwarding,no-pty,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA... kairos-actions
```

La clé ne peut alors plus lancer que le script de mise à jour. Gardez votre clé personnelle (`kairos-vps`) sur sa propre ligne, sans commande forcée, pour l'administration.

## 11. Sauvegardes et restauration

Le conteneur `backup` fait un `pg_dump` de la base chaque jour à **03:30 UTC** (04:30 ou 05:30 à Paris selon la saison). Il garde les **14 derniers** fichiers `kairos-AAAA-MM-JJ.dump` dans le volume Docker `kairos-backups`.

**Ces sauvegardes locales sont sur le même disque que la base.** Si le disque ou le VPS disparaît, elles disparaissent avec la base. Deux parades, cumulables : la copie automatique vers un stockage compatible S3 (11.2, désactivée par défaut) et la copie à la main sur votre ordinateur (11.3).

### 11.1 Voir les sauvegardes

```bash
cd ~/kairos
docker compose -f deploy/compose.yml exec -T backup ls -l /backups
```

### 11.2 Copie automatique hors de la machine (facultative)

Chaque jour à **04:00 UTC**, une demi-heure après la sauvegarde, le conteneur `offsite-backup` (image `rclone/rclone`) copie les fichiers `kairos-*.dump` du volume vers un compartiment (« bucket ») d'un stockage objet **compatible S3**, chez le fournisseur de votre choix. L'Object Storage S3 du Public Cloud d'OVHcloud en est un. Tout autre fournisseur compatible S3 convient de la même façon : seuls le point d'accès, la région et la clé changent.

Comment il garde les copies :
- il garde dans le compartiment les **14 copies les plus récentes**, quel que soit leur âge ;
- il ne supprime rien tant que la machine n'a pas de sauvegarde de moins de 2 jours. Une machine perdue, un volume vidé ou des sauvegardes qui échouent plusieurs nuits de suite n'effacent donc pas les copies ;
- il ne lit le volume des sauvegardes qu'en lecture seule.

Le stockage est facturé par votre fournisseur selon le volume conservé. Kairos envoie un fichier de quelques Mo par jour et en garde 14. Le compartiment protège contre la perte du disque ou du VPS, mais pas contre la perte du compte chez ce fournisseur. Gardez donc aussi, de temps en temps, une copie chez vous (11.3).

**1. Obtenir les cinq informations.** Créez un compartiment privé et une clé d'accès S3 en suivant la documentation de votre fournisseur. Pour OVHcloud, voyez les guides « Object Storage S3 » du Public Cloud sur <https://help.ovhcloud.com>. Il vous faut :
- le **point d'accès** S3 (« endpoint »), une adresse `https://...` ;
- la **région** du compartiment, telle que le fournisseur l'écrit ;
- le **nom du compartiment**, par exemple `kairos-sauvegardes`. Il doit rester **privé** : ne le rendez pas public ;
- l'**identifiant de la clé d'accès** (« access key ») ;
- le **secret** de cette clé, souvent affiché une seule fois à sa création : copiez-le tout de suite.

Si le fournisseur permet de limiter la clé à ce seul compartiment, faites-le. Rangez ces valeurs seulement dans `deploy/.env` et dans votre gestionnaire de mots de passe.

**2. Activer la copie.** Dans `deploy/.env` (`nano deploy/.env`) :

| Variable | Valeur |
|---|---|
| `COMPOSE_PROFILES` | `offsite` ; avec DuckDNS, `offsite,duckdns` |
| `KAIROS_OFFSITE_ENDPOINT` | le point d'accès |
| `KAIROS_OFFSITE_REGION` | la région |
| `KAIROS_OFFSITE_BUCKET` | le nom du compartiment |
| `KAIROS_OFFSITE_ACCESS_KEY_ID` | l'identifiant de la clé |
| `KAIROS_OFFSITE_SECRET_ACCESS_KEY` | le secret de la clé |

Puis démarrez le conteneur. Il fait sa première copie dès son démarrage ; vérifiez-la :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml up -d
docker compose -f deploy/compose.yml logs offsite-backup
```

La dernière ligne doit être `offsite copy done: offsite:<nom-du-compartiment>`, et la console du fournisseur liste les fichiers `kairos-AAAA-MM-JJ.dump`. Vérifiez bien cette première copie : la copie a été testée contre un faux stockage S3, pas contre votre fournisseur.
- Si une variable manque, le journal le dit (`Copie hors machine impossible, à renseigner dans deploy/.env : ...`). Corrigez puis relancez `docker compose -f deploy/compose.yml up -d`.
- Si le journal montre une erreur de signature ou de somme de contrôle, vérifiez le point d'accès et la région, puis consultez la page de rclone propre à votre fournisseur (<https://rclone.org/s3/>).
- En cas d'échec, le conteneur réessaie à la copie suivante, le lendemain à 04:00 UTC.

**Désactiver la copie** :
1. retirez `offsite` de `COMPOSE_PROFILES` ;
2. lancez `docker compose -f deploy/compose.yml --profile offsite rm -sf offsite-backup`.

Les fichiers déjà copiés restent dans le compartiment. Supprimez-les depuis la console du fournisseur si vous n'en voulez plus.

### 11.3 Rapatrier les sauvegardes sur votre ordinateur

Si la copie automatique est active, le plus simple est de télécharger un fichier depuis la console du fournisseur.

Sinon, en deux temps. Sur le VPS, copiez le contenu du volume dans un dossier ordinaire :

```bash
mkdir -p ~/sauvegardes
docker compose -f deploy/compose.yml cp backup:/backups/. ~/sauvegardes
```

Puis, depuis votre ordinateur :

```bash
rsync -av -e "ssh -i ~/.ssh/kairos-vps" <utilisateur>@<ipv4-du-vps>:~/sauvegardes/ ./sauvegardes-kairos/
```

Si `rsync` n'est pas installé, `scp -i ~/.ssh/kairos-vps "<utilisateur>@<ipv4-du-vps>:~/sauvegardes/*.dump" ./sauvegardes-kairos/` fait la même chose. Rangez ces fichiers dans un stockage à vous : disque externe ou cloud personnel.

### 11.4 Restaurer

**Depuis le volume** (cela **remplace** le contenu actuel de la base) :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml exec -T backup ls /backups
./deploy/backup/restore-database.sh /backups/kairos-AAAA-MM-JJ.dump
```

Le script arrête l'application, restaure en une seule transaction, puis relance l'application. Si la restauration échoue, l'application reste arrêtée et la base n'est pas modifiée. Lisez le message, corrigez, puis lancez `docker compose -f deploy/compose.yml start app`.

**Depuis le compartiment S3**, par exemple sur un VPS neuf dont le volume est vide :
1. Remplissez `deploy/.env` avec les variables `KAIROS_OFFSITE_*` de 11.2, **en retirant `offsite` de `COMPOSE_PROFILES` jusqu'à la fin de la restauration**. C'est aussi vrai si vous recopiez un `deploy/.env` sauvegardé : corrigez cette ligne avant de démarrer.
2. Démarrez la pile (étape 7).
3. Listez les copies et rapatriez celle de votre choix dans le volume, puis restaurez-la :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml run --rm offsite-restore lsl offsite:<nom-du-compartiment>
docker compose -f deploy/compose.yml run --rm offsite-restore copy offsite:<nom-du-compartiment>/kairos-AAAA-MM-JJ.dump /backups/
./deploy/backup/restore-database.sh /backups/kairos-AAAA-MM-JJ.dump
```

Une fois la restauration réussie, remettez `offsite` dans `COMPOSE_PROFILES` et relancez `docker compose -f deploy/compose.yml up -d` pour reprendre la copie quotidienne.

**Depuis un fichier copié sur votre ordinateur**, il faut deux temps : de votre ordinateur vers le VPS, puis du VPS vers le volume. Depuis votre ordinateur :

```bash
scp -i ~/.ssh/kairos-vps ./sauvegardes-kairos/kairos-AAAA-MM-JJ.dump <utilisateur>@<ipv4-du-vps>:~/
```

Puis sur le VPS :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml cp ~/kairos-AAAA-MM-JJ.dump backup:/backups/
./deploy/backup/restore-database.sh /backups/kairos-AAAA-MM-JJ.dump
```

## 12. Dépannage

**Le certificat HTTPS n'est pas délivré** (le navigateur affiche une erreur de certificat, ou `curl` échoue en TLS). Regardez `docker compose -f deploy/compose.yml logs caddy`. Causes habituelles :
- **le domaine ne pointe pas encore sur le VPS** : `nslookup <votre-adresse>` doit renvoyer l'IPv4 du VPS. Sinon, vérifiez l'entrée A de la zone DNS (étape 4) et `KAIROS_DOMAIN`, puis attendez la propagation ;
- **une entrée AAAA pointe vers une IPv6 inactive sur le VPS** : supprimez-la, ou configurez l'IPv6 sur le VPS (étape 4) ;
- **les ports 80/443 sont fermés** : si vous avez activé le Network Firewall d'OVHcloud ou `ufw`, ouvrez-y 80/tcp, 443/tcp et 443/udp (étape 3.1) ;
- **trop de tentatives échouées** : Let's Encrypt limite les essais. Corrigez la cause, attendez une heure, puis lancez `docker compose -f deploy/compose.yml restart caddy`.

**Manque de mémoire** : la construction de l'image peut être tuée (« Killed »), ou l'application redémarrer pendant une reconnaissance par photo. Créez l'espace d'échange de l'étape 7, puis relancez. Si cela continue sur un VPS de 4 Go, mettez `NUXT_PHOTO_RECOGNITION=off` dans `deploy/.env` puis `docker compose -f deploy/compose.yml up -d`, ou passez à un VPS de 8 Go.

**Première reconnaissance par photo lente** : au tout premier scan photo, l'application télécharge ses modèles de reconnaissance d'image et de lecture de texte, plusieurs centaines de Mo. Ce premier scan peut durer plusieurs minutes, voire échouer par délai dépassé : relancez-le. Les modèles sont ensuite gardés dans le volume `kairos-data` et ne se retéléchargent pas, même après une mise à jour.

**Les images du catalogue ne se chargent pas derrière un proxy** : la récupération des images de catalogue côté serveur ignore volontairement les variables `HTTP_PROXY` / `HTTPS_PROXY`, pour se protéger des adresses internes. Sur un VPS la sortie Internet est directe, donc il n'y a rien à faire. C'est un point à connaître seulement si vous hébergez derrière un proxy d'entreprise.

**Vérifier l'état et lire les journaux** :

```bash
docker compose -f deploy/compose.yml ps
docker compose -f deploy/compose.yml logs --tail 100 app
```

**Le site répond 502** juste après un démarrage : l'application n'est pas encore « healthy », ce qui peut prendre jusqu'à une minute. Réessayez.

**Le VPS a redémarré**, après une maintenance ou un redémarrage depuis l'espace client : la pile repart toute seule (`restart: unless-stopped`). Si le site ne répond pas, lancez `docker compose -f deploy/compose.yml ps` pour voir quel service manque.

**Tout redémarrer proprement** (les données sont dans des volumes et ne sont pas perdues) :

```bash
docker compose -f deploy/compose.yml up -d
```

N'ajoutez jamais l'option `-v` à `docker compose down` : elle supprime les volumes, donc la base et les sauvegardes.

## Annexe A. DuckDNS, un nom de domaine gratuit

Cette annexe ne sert que si vous n'avez pas de domaine à vous. Avec un domaine OVHcloud, l'étape 4 suffit.

1. Allez sur <https://www.duckdns.org> et connectez-vous (compte GitHub, Google…).
2. Dans « domains », choisissez un sous-domaine (par exemple `kairos-moi`) et cliquez sur « add domain ».
3. Mettez l'**adresse IPv4** du VPS dans le champ « current ip » et cliquez sur « update ip ».
4. Copiez le **token** affiché en haut de la page. C'est un secret : il donne le droit de modifier vos domaines.

Puis, dans `deploy/.env` :
- `KAIROS_DOMAIN=<sous-domaine>.duckdns.org` ;
- `DUCKDNS_SUBDOMAIN=<sous-domaine>` seul ;
- `DUCKDNS_TOKEN=<le-token>` ;
- ajoutez `duckdns` à `COMPOSE_PROFILES`, par exemple `COMPOSE_PROFILES=duckdns` ou `COMPOSE_PROFILES=offsite,duckdns`.

Relancez `docker compose -f deploy/compose.yml up -d`. Le conteneur `duckdns` remet l'IP à jour toutes les 5 minutes. Si une variable manque, il refuse de démarrer et le dit dans `docker compose -f deploy/compose.yml logs duckdns`.

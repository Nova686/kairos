# Installer Kairos sur une machine Oracle Cloud gratuite

Ce guide mène, pas à pas, d'un compte Oracle vide jusqu'à un site Kairos en ligne en HTTPS, utilisable depuis l'iPhone. Compter une à deux heures la première fois.

Ce qui tourne à la fin, sur une seule machine : l'application, PostgreSQL, Caddy (HTTPS automatique), une mise à jour DuckDNS toutes les 5 minutes et une sauvegarde quotidienne, le tout par Docker Compose (`deploy/compose.yml`).

Les valeurs entre chevrons (`<...>`) sont à remplacer par les vôtres. Ne collez jamais de vrais secrets dans un message, une capture ou un dépôt.

## 1. Créer le compte Oracle Cloud

1. Rendez-vous sur <https://www.oracle.com/cloud/free/> et cliquez sur « Start for free ».
2. Renseignez vos informations. La **région d'origine** (« home region ») ne se change plus ensuite : choisissez une région qui propose des machines ARM disponibles. Dans l'ordre : **France Central (Paris)**, **France South (Marseille)**, sinon **Germany Central (Frankfurt)**.
3. Entrez une carte bancaire : c'est seulement une vérification d'identité, un montant de quelques centimes est bloqué puis rendu. Tant que vous restez sur des ressources « Always Free », rien n'est facturé.
4. Attendez le mail de confirmation (parfois quelques minutes) puis connectez-vous à la console.

**Attention, récupération des machines inactives.** Oracle peut arrêter puis récupérer une instance « Always Free » restée inactive pendant 7 jours (utilisation du processeur, du réseau et de la mémoire sous 20 % au 95e centile). Kairos, utilisé de temps en temps depuis un téléphone, peut tomber sous ces seuils. Deux attitudes :
- laisser faire et accepter le risque : surveillez que le site répond, et sachez le remettre en route (voir le dépannage) ;
- passer le compte en **« Pay As You Go »** : les ressources « Always Free » restent gratuites et ne sont plus récupérées pour inactivité, et cela améliore aussi les chances d'obtenir une machine A1 quand la capacité manque. Mais ce mode rattache un moyen de paiement à la facturation au-delà des limites gratuites : une erreur de configuration (un second volume, une IP de plus) peut alors coûter de l'argent. C'est un choix qui vous appartient, et il est en contradiction avec la contrainte « rien de payant » de ce projet. Ne mettez pas en place de programme « qui fait tourner le processeur pour rien » : c'est fragile et contraire aux règles d'Oracle.

## 2. Créer la machine virtuelle

### 2.1 Préparer la clé SSH

Sur votre ordinateur :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kairos-oracle -C "kairos-oracle"
```

Gardez le fichier `~/.ssh/kairos-oracle` (privé) pour vous ; vous donnerez `~/.ssh/kairos-oracle.pub` (publique) à Oracle.

### 2.2 Créer l'instance

Console Oracle › **Compute** › **Instances** › **Create instance** :

- **Image** : Canonical Ubuntu **24.04**.
- **Shape** : « Change shape » › Ampere › **VM.Standard.A1.Flex**, **4 OCPU** et **24 Go** de mémoire (le maximum gratuit). La reconnaissance de cartes par photo télécharge et fait tourner des modèles : elle a besoin de cette mémoire.
- **Réseau** : laissez le réseau virtuel par défaut et cochez « Assign a public IPv4 address ».
- **Clé SSH** : « Paste public keys » et collez le contenu de `~/.ssh/kairos-oracle.pub`.
- Disque : 50 Go suffisent (jusqu'à 200 Go sont gratuits).

Si Oracle répond « Out of capacity for shape VM.Standard.A1.Flex », voir le dépannage en fin de guide (réessayer plus tard, ou la machine de secours).

**Machine de secours** : `VM.Standard.E2.1.Micro` (1 Go de mémoire, x86). Elle fait tourner Kairos mais pas la reconnaissance par photo : dans ce cas mettez `NUXT_PHOTO_RECOGNITION=off` à l'étape 6 (l'onglet Photo disparaît, le reste fonctionne).

Une fois l'instance « Running », notez son **adresse IP publique**.

### 2.3 Ouvrir les ports dans le réseau Oracle

Console › votre instance › sous « Primary VNIC », cliquez sur le **Subnet** › **Security Lists** › la liste par défaut › **Add Ingress Rules**. Ajoutez trois règles (Source CIDR `0.0.0.0/0`, port source vide) :

| Protocole | Port de destination | Usage |
|---|---|---|
| TCP | 80 | émission du certificat |
| TCP | 443 | le site en HTTPS |
| UDP | 443 | HTTP/3 |

Le port 22 (SSH) est déjà ouvert.

## 3. Préparer la machine

Connectez-vous (l'utilisateur par défaut d'Ubuntu chez Oracle est `ubuntu`) :

```bash
ssh -i ~/.ssh/kairos-oracle ubuntu@<ip-publique>
```

### 3.1 Ouvrir les ports dans le pare-feu de la machine

Les images Ubuntu d'Oracle sont livrées avec des règles `iptables` restrictives (tout est refusé sauf SSH) en plus de la liste de sécurité de la console. Docker ouvre lui-même les ports qu'il publie vers les conteneurs, donc ces règles ne sont sans doute pas indispensables au fonctionnement ; on les ajoute quand même par hygiène sur les images Ubuntu d'Oracle, pour que l'état du pare-feu soit explicite et survive aux redémarrages.

```bash
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
sudo apt-get update && sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

À l'installation de `iptables-persistent`, répondez « Yes » aux deux questions. Vérifiez :

```bash
sudo iptables -L INPUT -n --line-numbers | grep -E 'dpt:(80|443)'
```

Trois lignes `ACCEPT` doivent apparaître. La règle placée en position 6 doit se trouver avant la règle finale `REJECT` : si `sudo iptables -L INPUT -n --line-numbers` montre un `REJECT` numéroté plus petit que vos règles, remplacez `6` par le numéro de ce `REJECT` et recommencez.

### 3.2 Installer Docker Engine et le plugin Compose

Depuis le dépôt apt officiel de Docker (le paquet `docker.io` d'Ubuntu est plus ancien et sans plugin Compose) :

```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Déconnectez-vous puis reconnectez-vous (pour que le groupe `docker` soit pris en compte) et vérifiez :

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 4. DuckDNS : un nom de domaine gratuit

1. Allez sur <https://www.duckdns.org> et connectez-vous (compte GitHub, Google...).
2. Dans « domains », choisissez un sous-domaine (par exemple `kairos-moi`) et cliquez sur « add domain ».
3. Mettez l'**adresse IP publique** de la VM dans le champ « current ip » et cliquez sur « update ip ».
4. Copiez le **token** affiché en haut de la page : c'est un secret, il donne le droit de modifier vos domaines.

Votre adresse sera `https://<sous-domaine>.duckdns.org`. Le conteneur `duckdns` de la pile remet l'IP à jour toutes les 5 minutes.

## 5. Récupérer le code (dépôt privé)

Le dépôt est privé : la VM le lit avec une **clé de déploiement en lecture seule**, qui ne sert qu'à ce dépôt.

Sur la VM :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/kairos-deploy -N "" -C "kairos-deploy"
cat ~/.ssh/kairos-deploy.pub
```

Sur GitHub : dépôt Kairos › Settings › **Deploy keys** › **Add deploy key**. Collez la clé publique affichée, donnez-lui un titre (« VM Oracle ») et **laissez « Allow write access » décoché**.

Retour sur la VM, dites à SSH d'utiliser cette clé pour GitHub :

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

`ssh-keyscan` fait confiance à la première réponse reçue : un intercepteur pourrait vous répondre. Comparez donc les empreintes affichées par `ssh-keygen -lf` avec celles que GitHub publie sur <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints>. Si elles correspondent, enregistrez-les puis clonez :

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

Générez les deux secrets (chacun s'affiche une seule fois dans le terminal ; copiez-les dans le fichier tout de suite) :

```bash
openssl rand -hex 32
openssl rand -hex 24
```

Ouvrez `deploy/.env` (`nano deploy/.env`) et remplacez chaque valeur :

| Variable | Valeur |
|---|---|
| `NUXT_APP_SECRET` | la sortie de `openssl rand -hex 32` (secret qui scelle les sessions, 32 caractères au minimum) |
| `POSTGRES_PASSWORD` | la sortie de `openssl rand -hex 24` (hexadécimal : sans caractère spécial, il est inséré tel quel dans l'adresse de la base) |
| `KAIROS_DOMAIN` | `<sous-domaine>.duckdns.org` |
| `DUCKDNS_SUBDOMAIN` | `<sous-domaine>` seul |
| `DUCKDNS_TOKEN` | le token DuckDNS de l'étape 4 |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | clés de l'application eBay (programme développeurs eBay, API Browse) ; laissez vide si vous n'avez pas de clé : la source sera désactivée |
| `POKEMONTCG_API_KEY` | clé gratuite sur <https://dev.pokemontcg.io> ; vide = source désactivée |
| `PSA_API_TOKEN` | jeton de l'API PSA (vérification des certificats) ; vide = source désactivée |
| `NUXT_PHOTO_RECOGNITION` | `on` ; `off` sur la machine de secours à 1 Go |

Le fichier `deploy/.env` n'est jamais versionné. Gardez-en **une seule copie**, dans votre gestionnaire de mots de passe, et nulle part ailleurs (ni mail, ni dépôt, ni capture) : sans le `POSTGRES_PASSWORD` exact, une base existante ne se rouvre pas.

Vérifiez que la configuration est complète (aucune variable obligatoire manquante) :

```bash
docker compose -f deploy/compose.yml config --quiet && echo "configuration valide"
```

## 7. Premier démarrage

**Machine de secours (1 Go) seulement** : créez d'abord 2 Go d'espace d'échange, sans quoi la construction de l'image est tuée par manque de mémoire.

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

La première construction prend plusieurs minutes (téléchargement des dépendances, compilation). Suivez l'état :

```bash
docker compose -f deploy/compose.yml ps
```

Au bout de quelques minutes, `app`, `database`, `caddy`, `duckdns` et `backup` sont « Up », `app` et `database` « healthy ». Puis :

```bash
curl -s https://<sous-domaine>.duckdns.org/api/health
```

Réponse attendue : `{"status":"ok","database":"ok","version":"..."}`. Les tables de la base sont créées automatiquement au démarrage de l'application.

Caddy demande son certificat HTTPS à Let's Encrypt au premier accès ; cela prend quelques secondes. En cas d'échec, voir le dépannage.

## 8. Créer votre compte administrateur

Il n'y a pas d'inscription publique : le compte se crée en ligne de commande, dans le conteneur de l'application. Le mot de passe est lu sur l'entrée standard, donc jamais écrit dans l'historique du shell ni dans la liste des processus.

```bash
cd ~/kairos
read -rsp "Mot de passe : " kairos_password; echo
printf '%s\n' "$kairos_password" | docker compose -f deploy/compose.yml exec -T app node .output/server/create-admin.mjs <votre-email> <votre-prenom>
unset kairos_password
```

Réponse attendue : `Administrateur créé : <votre-email>`. Des messages `NOTICE ... already exists, skipping` s'affichent avant : ils sont normaux (ce sont les migrations, déjà appliquées au démarrage). Choisissez un mot de passe long et propre à ce site.

Connectez-vous ensuite sur `https://<sous-domaine>.duckdns.org`.

## 9. Installer sur l'iPhone

1. Ouvrez l'adresse du site dans **Safari**. Depuis iOS 16.4, Chrome et Edge savent aussi ajouter un site à l'écran d'accueil ; avant, seul Safari le permettait.
2. Appuyez sur **Partager** (le carré avec une flèche vers le haut) › **« Sur l'écran d'accueil »** › **Ajouter**.
3. Ouvrez Kairos depuis l'icône ainsi créée, et connectez-vous.
4. Au premier scan (code-barres ou photo), iOS demande l'accès à l'**appareil photo** : autorisez-le. Si vous avez refusé : Réglages › Apps › Safari › Appareil photo, ou Réglages › Confidentialité et sécurité › Appareil photo.

La caméra ne fonctionne qu'en HTTPS : c'est une des raisons pour lesquelles le domaine et le certificat sont nécessaires.

## 10. Mettre à jour

Quand une nouvelle version est fusionnée sur la branche `main`, de l'une de ces deux façons.

**Depuis la VM** :

```bash
cd ~/kairos
./deploy/deploy.sh
```

Le script note le commit actuel, récupère `origin/main`, reconstruit l'image, relance uniquement l'application et attend qu'elle devienne saine (jusqu'à 2 minutes ; `KAIROS_DEPLOY_HEALTH_ATTEMPTS=120 ./deploy/deploy.sh` allonge l'attente, un essai toutes les 2 secondes). Si le démarrage échoue ou si la nouvelle version ne devient pas saine, il **remet à la fois l'image précédente et le code précédent** (retour sur le commit noté, en « detached HEAD »), puis s'arrête avec une erreur.

**Après un retour en arrière.** Les migrations de la base ne sont pas annulées : elles doivent donc rester **additives uniquement** (ajouter des tables ou des colonnes, jamais en supprimer ni en renommer dans la même version que le code qui s'en passe). Vérifiez que l'ancienne version fonctionne (`curl https://<sous-domaine>.duckdns.org/api/health`, puis une page de l'application) ; si une migration a été appliquée à moitié, le message d'erreur est dans `docker compose -f deploy/compose.yml logs --tail 100 app` et la sauvegarde de la nuit (étape 11) reste le filet de sécurité. Pour réessayer : corrigez sur `main`, puis relancez `./deploy/deploy.sh` ; il repart de `origin/main` quel que soit l'état laissé par le retour en arrière.

**Depuis GitHub** (sans ouvrir de terminal) : onglet **Actions** › workflow **deploy** › « Run workflow ». Il se connecte en SSH à la VM et lance le même script. Il demande quatre secrets, à créer une fois dans Settings › Secrets and variables › Actions :

| Secret | Valeur |
|---|---|
| `DEPLOY_HOST` | l'adresse IP publique de la VM (ou `<sous-domaine>.duckdns.org`) |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_HOST_FINGERPRINT` | l'empreinte de la clé de la VM, au format `SHA256:...` : sur la VM, `ssh-keygen -l -f /etc/ssh/ssh_host_ed25519_key.pub \| cut -d ' ' -f2` (c'est exactement la commande du README de l'action `appleboy/ssh-action` v1.2.5). Elle évite de se connecter à une machine usurpée. |
| `DEPLOY_SSH_KEY` | le contenu de la clé **privée** de connexion (un fichier dédié, idéalement) ; sa clé publique doit figurer dans `~/.ssh/authorized_keys` de la VM |

Pour une clé dédiée à GitHub Actions : `ssh-keygen -t ed25519 -f ~/.ssh/kairos-actions -N ""` sur votre ordinateur, puis `ssh-copy-id -i ~/.ssh/kairos-actions.pub -o "IdentityFile ~/.ssh/kairos-oracle" ubuntu@<ip-publique>`, et collez le contenu de `~/.ssh/kairos-actions` dans le secret.

Pour limiter ce que cette clé peut faire en cas de fuite, dans `~/.ssh/authorized_keys` de la VM, préfixez sa ligne d'une commande forcée (tout sur une seule ligne) :

```text
command="cd ~/kairos && ./deploy/deploy.sh",no-port-forwarding,no-pty,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAA... kairos-actions
```

La clé ne peut alors plus lancer que le script de mise à jour. Gardez votre clé personnelle (`kairos-oracle`) sur sa propre ligne, sans commande forcée, pour l'administration.

## 11. Sauvegardes et restauration

Le conteneur `backup` fait un `pg_dump` de la base chaque jour à **03:30 UTC** (04:30 ou 05:30 à Paris selon la saison) et garde les **14 derniers** fichiers `kairos-AAAA-MM-JJ.dump` dans le volume Docker `kairos-backups`.

Attention : ce volume est **sur le même disque que la base**. Si la machine ou le compte Oracle disparaît, les sauvegardes disparaissent avec. Copiez-les régulièrement hors de la VM (par exemple chaque semaine).

Voir les sauvegardes disponibles :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml exec -T backup ls -l /backups
```

Les rapatrier sur votre ordinateur, en deux temps. Sur la VM, copier le contenu du volume dans un dossier ordinaire :

```bash
mkdir -p ~/sauvegardes
docker compose -f deploy/compose.yml cp backup:/backups/. ~/sauvegardes
```

Puis, depuis votre ordinateur :

```bash
rsync -av -e "ssh -i ~/.ssh/kairos-oracle" ubuntu@<ip-publique>:~/sauvegardes/ ./sauvegardes-kairos/
```

(`scp -i ~/.ssh/kairos-oracle "ubuntu@<ip-publique>:~/sauvegardes/*.dump" ./sauvegardes-kairos/` fait la même chose si `rsync` n'est pas installé.) Rangez ces fichiers dans un stockage à vous (disque externe, cloud personnel).

**Restaurer** une sauvegarde (cela **remplace** le contenu actuel de la base) :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml exec -T backup ls /backups
./deploy/backup/restore-database.sh /backups/kairos-AAAA-MM-JJ.dump
```

Le script arrête l'application, restaure en une seule transaction, puis relance l'application. Si la restauration échoue, l'application reste arrêtée (la base n'est pas modifiée) : lisez le message, corrigez, puis `docker compose -f deploy/compose.yml start app`.

Pour restaurer un fichier que vous avez copié hors de la VM sur une VM neuve, il faut le faire passer en deux temps : de votre ordinateur vers la VM, puis de la VM vers le volume. Depuis votre ordinateur :

```bash
scp -i ~/.ssh/kairos-oracle ./sauvegardes-kairos/kairos-AAAA-MM-JJ.dump ubuntu@<ip-publique>:~/
```

Puis sur la VM :

```bash
cd ~/kairos
docker compose -f deploy/compose.yml cp ~/kairos-AAAA-MM-JJ.dump backup:/backups/
./deploy/backup/restore-database.sh /backups/kairos-AAAA-MM-JJ.dump
```

## 12. Dépannage

**Le certificat HTTPS n'est pas délivré** (le navigateur affiche une erreur de certificat, ou `curl` échoue en TLS). Regardez `docker compose -f deploy/compose.yml logs caddy`. Causes habituelles :
- le nom DuckDNS ne pointe pas encore sur la VM : `nslookup <sous-domaine>.duckdns.org` doit renvoyer l'IP publique ; sinon vérifiez `KAIROS_DOMAIN`, `DUCKDNS_TOKEN` et `docker compose -f deploy/compose.yml logs duckdns` ;
- les ports 80/443 sont fermés : refaites les étapes 2.3 (liste de sécurité Oracle) **et** 3.1 (`iptables`) ;
- trop de tentatives échouées : Let's Encrypt limite les essais ; corrigez la cause, attendez une heure, puis `docker compose -f deploy/compose.yml restart caddy`.

**Oracle refuse la création : « Out of capacity » pour A1.Flex.** Les machines ARM gratuites sont très demandées. Réessayez à un autre moment (le matin tôt, ou plusieurs fois dans la journée), ou essayez un autre « availability domain » de la région. Une réduction à 2 OCPU / 12 Go augmente souvent les chances et suffit à Kairos. En dernier recours, la machine de secours `VM.Standard.E2.1.Micro` avec `NUXT_PHOTO_RECOGNITION=off`.

**Manque de mémoire sur la machine de secours (1 Go)** : la construction de l'image peut être tuée (« Killed »). Créez l'espace d'échange décrit à l'étape 7 avant de relancer. Gardez `NUXT_PHOTO_RECOGNITION=off` : la reconnaissance par photo ne tient pas dans 1 Go.

**Première reconnaissance par photo lente** : au tout premier scan photo, l'application télécharge ses modèles (reconnaissance d'image et lecture de texte, plusieurs centaines de Mo). Le premier scan peut durer plusieurs minutes, voire échouer par délai dépassé ; relancez-le. Les modèles sont ensuite gardés dans le volume `kairos-data` et ne se retéléchargent pas, y compris après une mise à jour.

**Les images du catalogue ne se chargent pas derrière un proxy** : la récupération des images de catalogue côté serveur ignore volontairement les variables `HTTP_PROXY` / `HTTPS_PROXY` (protection contre les adresses internes). Sur la VM Oracle la sortie Internet est directe, donc rien à faire ; c'est un point à connaître si vous hébergez ailleurs, derrière un proxy d'entreprise.

**Vérifier l'état et lire les journaux** :

```bash
docker compose -f deploy/compose.yml ps
docker compose -f deploy/compose.yml logs --tail 100 app
```

**Le site répond 502** juste après un démarrage : l'application n'est pas encore « healthy » (jusqu'à une minute). Réessayez.

**La machine est arrêtée, ou le site ne répond plus après des jours sans usage** : Oracle a peut-être arrêté l'instance « Always Free » pour inactivité (voir l'étape 1). Console Oracle › Compute › Instances › votre instance › **Start**. La pile redémarre toute seule (`restart: unless-stopped`) ; l'adresse IP publique peut avoir changé : remettez-la à jour sur duckdns.org si c'est le cas. Pour que cela n'arrive plus, voir le compromis « Pay As You Go » à l'étape 1.

**Tout redémarrer proprement** (les données sont dans des volumes et ne sont pas perdues) :

```bash
docker compose -f deploy/compose.yml up -d
```

N'ajoutez jamais l'option `-v` à `docker compose down` : elle supprime les volumes, donc la base et les sauvegardes.

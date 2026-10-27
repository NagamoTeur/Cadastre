# Décisions

## D1 : une page web servie par un CT, pas une appli Electron ou Rust

La demande laissait le choix (« electron, rust, etc. »). Une appli de bureau ne s'ouvrirait
que sur le PC ; une page servie par le homelab s'ouvre aussi depuis le téléphone, un
autre PC ou un tableau de bord, et garde une seule disposition partagée. Elle vit dans son
propre conteneur, selon la règle « un service par conteneur ».
Une appli Tauri ou Electron reste possible plus tard en emballant la même page.

## D2 : Node sans build, Cytoscape, une seule dépendance serveur

Pas de Vite ni de framework : la page est en modules ES natifs, le serveur en `node:http`
avec `yaml` comme seule dépendance. Rien à compiler, donc rien à faire tourner sur un
serveur de build ; `npm ci` sur le CT suffit. Cytoscape fait le graphe (nœuds composés pour les
parcelles, styles par données, événements).
Rejeté : React Flow (impose React et un build), D3 pur (trop à réécrire pour le zoom,
le glisser et la sélection).

## D3 : le sens dans un YAML, l'état dans les API

Ce qu'aucune API ne sait (à quoi sert une machine, qui dépend de qui) est écrit à la main
dans `catalogue/services.yaml`, versionné. L'état vient du Proxmox, de Traefik et de
sondes TCP. Le croisement des deux produit les anomalies : un invité non décrit, une
entrée décrite qui a disparu, une route vers une IP vide.

## D4 : les routes Traefik sont lues sur son API, et sondées

Le tableau de bord de Traefik (:8080) expose ses routeurs et services. Le Cadastre les
lit au lieu de les recopier, puis sonde lui-même chaque cible : Traefik marque « UP »
des serveurs sans healthcheck même quand ils sont morts (quatre routes du homelab
d'origine, le 27/10/2026).

## D5 : un plan parcellaire plutôt qu'une disposition en force

Le premier essai (fcose) donnait un enchevêtrement illisible : 48 liens entre 33 nœuds.
Le plan range chaque groupe en grille dans une parcelle, et les parcelles par rangées :
l'extérieur en haut, l'infrastructure au milieu, les services en bas. Les flèches
traversent, mais chaque service a une place stable et prévisible. On peut déplacer à la
main ; « Réorganiser » revient au plan.

## D6 : un jeton Proxmox à part, PVEAuditor

`cadastre@pve`, sur le modèle des autres tableaux de bord : lecture seule, révocable sans toucher
aux autres. Pas d'authentification sur la page, comme un tableau de bord de homelab : elle ne permet aucune
action, au pire de déplacer des cartes.

## D7 : les ports Tailscale Serve ne sont pas sondés

Ils n'écoutent que sur l'IP Tailscale du CT ; les sonder depuis le LAN donnait des faux
« port fermé ». Les applis Tailscale sont reliées au nœud Tailscale par un lien en
pointillés à la place.

## D8 : se dessiner seul, le catalogue devient une surcouche (v0.2)

Pour que n'importe quel Proxmox puisse s'en servir, la carte doit exister sans une ligne
de YAML. La découverte part de l'API Proxmox (invités, IP, tags, notes), essaie ~80 ports
courants, reconnaît les pages web par une centaine d'empreintes (titre, en-tête `Server`),
interroge les serveurs Minecraft et cherche une API Traefik. Le catalogue ne fait plus que
corriger et compléter, nœud par nœud (rattaché par `vmid`).
Rejeté : un agent dans chaque conteneur (plus précis, mais il faut l'installer partout et
il écrit sur les machines) ; nmap (une dépendance système lourde pour ~80 ports).

## D9 : le rôle vient d'abord d'un service reconnu, puis des notes du Proxmox

Ordre : catalogue, service reconnu, première phrase des notes Proxmox, titre d'une page
web, « Rôle inconnu ». Les notes viennent après un service reconnu parce que beaucoup de
scripts d'installation y mettent une bannière HTML ; on les nettoie, et elles restent
affichées en entier dans la fiche. Un proxy (Traefik, NPM, Caddy) décide du quartier de
sa machine, même s'il relaie des ports Minecraft.

## D10 : le plan se recalcule tant qu'on n'a rien déplacé

La découverte range les machines au fil de l'eau ; un plan figé au premier affichage
laissait des machines dans le mauvais quartier. Tant que personne n'a déplacé de carte,
tout changement relance le plan. Après un déplacement à la main, seules les machines qui
arrivent ou changent de quartier sont replacées. « Réorganiser » revient au plan auto.

## D11 : installation par un script sur l'hôte, archive avec ses dépendances

Un script à lancer en root sur l'hôte (comme les community-scripts) : il a tout sous la
main pour créer le conteneur, le jeton PVEAuditor et pousser l'archive avec `pct push`.
Le conteneur n'a besoin ni de git, ni de npm, ni d'accès au dépôt : l'archive de release
embarque `node_modules` et il suffit du `nodejs` de Debian. Un jeton par installation
(`ct<CTID>`) : réinstaller ne coupe pas une autre instance.

## D12 : le catalogue personnel sort du dépôt

Le dépôt devient partageable : `catalogue/exemple.yaml` y reste, le vrai catalogue vit dans
`/etc/cadastre/catalogue.yaml` sur le CT (et dans un dépôt privé à part pour le homelab
d'origine). Le dépôt public sur GitHub part d'un historique neuf, sans ce catalogue
(voir D14).

## D13 : licence MIT

« Que n'importe qui puisse le déployer » : une licence permissive, la plus courante pour
ce genre d'outil.

## D14 : GitHub en miroir public, à historique propre

Le dépôt Gitea reste la référence (historique complet, workflows sur la forge). GitHub
(`NagamoTeur/Cadastre`) reçoit, par `outils/publier-github.sh`, un commit par publication
dont l'arbre est celui de `main` : l'historique public ne contient jamais l'ancien
catalogue, et aucun push forcé n'est nécessaire.
Sur GitHub, tests et releases tournent sur les runners de GitHub : un runner auto-hébergé
sur un dépôt public exécuterait le code de n'importe quelle PR sur la forge. GitHub ignore
`.gitea/workflows/`, et Gitea ignore `.github/workflows/` dès que `.gitea/workflows/` existe.

## D15 : README en anglais, interface en français et en anglais (v0.3)

Le README public est en anglais (`README.fr.md` garde la version française).
L'interface suit la langue du navigateur (français, sinon anglais), un bouton la change et
le choix est gardé dans le navigateur. La page a son dictionnaire (`public/i18n.js`) ; le
serveur reçoit `?lang=` et traduit à la sortie (`server/i18n.mjs`) : modèles pour les
anomalies, table pour les phrases fixes (quartiers, rôles des empreintes, types de liens),
appliquée à une copie de la carte pour ne jamais toucher aux valeurs partagées. Le code
reste en français. Ce que l'utilisateur écrit (catalogue, notes Proxmox) n'est pas traduit.
L'installateur suit `$LANG` et accepte les noms anglais de ses réglages.
Rejeté : une bibliothèque d'i18n (une dépendance pour deux langues et une centaine de
chaînes) ; traduire côté page les textes du serveur (il faudrait renvoyer des clés partout).

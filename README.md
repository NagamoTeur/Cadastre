# Cadastre

*[Français](README.fr.md)*

A self-drawing map of the services running on a Proxmox VE host: what each machine is for,
how you reach it, what talks to what, and what is wrong. It discovers everything on its own;
you can then add what no scan can guess.

> The web interface is in French for now. Translations are welcome.

## Install

As root on the Proxmox host:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/NagamoTeur/Cadastre/main/deploy/installer-proxmox.sh)"
```

The script creates an unprivileged Debian 13 container (1 core, 512 MB, 4 GB), a Proxmox user
`cadastre@pve` with a **read-only** API token (PVEAuditor role, one token per install), and
installs the latest release. The map is then at `http://<container ip>:8793/`.

Options, as environment variables in front of the command: `CTID=140`, `CT_NOM=cadastre`
(hostname), `STOCKAGE=local-lvm` (storage), `PONT=vmbr0` (bridge),
`IP=192.168.1.50/24 PASSERELLE=192.168.1.1` (DHCP by default), `SOURCE=` (local archive or
URL), `DEPOT=` (GitHub or Gitea repository to take releases from).

Update an existing install:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/NagamoTeur/Cadastre/main/deploy/installer-proxmox.sh)" -- --mise-a-jour <CTID>
```

## What you get

- **The map**: machines are grouped into districts (network, code, monitoring, storage,
  media, home automation, games, AI…). Arrows are links between services, colored by kind
  (reverse-proxy route, deployment, monitoring, notification…). Drag cards around; the
  layout is kept on the server.
- **The card** (click a service): role, live state (CPU, memory, disk, uptime), IP, public
  domains, probed ports with latency, proxy routes leading to it, relations, links to open,
  Proxmox notes, what discovery found, and the command to get a shell. `#<id>` in the URL
  opens a card directly.
- **Anomalies**: a guest that is stopped although it starts on boot, a port that stopped
  answering, a nearly full disk or memory, and **orphan routes**: a domain your Traefik
  still sends to an IP where nothing runs any more (Traefik reports those as UP).
- **Search** (`/`): name, role, IP, VMID, domain, tag.

## Auto-discovery

Every 10 minutes (or with the « Relancer la découverte » button), for each running guest
and each host:

1. **Proxmox** gives the guests, their IPs, tags and **notes** (the « Notes » tab becomes
   the description; its first sentence becomes the role when nothing else is recognized).
2. **~80 common ports** are tried over TCP.
3. **Each web port** is fetched; the page title and `Server` header are matched against
   about a hundred fingerprints ([`server/signatures.mjs`](server/signatures.mjs)): Gitea,
   Jellyfin, Home Assistant, Nextcloud, Grafana, AdGuard, the *arr suite…
4. **Minecraft servers** are pinged: version, players, mods, MOTD.
5. **Traefik** is found through its API (`/api/version`); its routes become arrows.

A machine lands in the district of its recognized services. A Proxmox tag named after a
district (`medias`, `jeux`, `domotique`…) forces it there. Nothing is ever written to your
machines.

## The catalogue (optional)

What discovery cannot guess (what a machine is really for, who depends on whom, a NAS
outside Proxmox) goes into `/etc/cadastre/catalogue.yaml`, reloaded on change. Start from
[`catalogue/exemple.yaml`](catalogue/exemple.yaml). The card of a discovered machine shows
a YAML snippet ready to paste.

## Configuration

`/etc/cadastre/cadastre.env` in the container:

| Variable | Purpose | Default |
|---|---|---|
| `PVE_URL` | Proxmox API | `https://127.0.0.1:8006` |
| `PVE_TOKEN` | `user@realm!token=secret`, PVEAuditor is enough | — |
| `PVE_CA` | host certificate (`/etc/pve/pve-root-ca.pem`) | not verified |
| `TRAEFIK_API` | Traefik API, if discovery misses it | discovered |
| `CADASTRE_CATALOGUE` | catalogue path | `/etc/cadastre/catalogue.yaml` |
| `CADASTRE_DEPOT_BASE` | prefix for `depot:` entries in the catalogue | — |
| `CADASTRE_PORT` | web port | `8793` |
| `RYTHME_DECOUVERTE` | seconds between discoveries | `600` |

The page has no authentication: it cannot act on your machines, at worst someone can move
cards around. Keep it on your LAN.

## Development

```bash
npm ci
npm run check                      # tests
node server/index.mjs              # http://localhost:8793, config in ~/.config/cadastre/cadastre.env
CADASTRE_CIBLE=root@<ip> deploy/deployer.sh   # push the working tree to an installed container
```

Node 20+, no build step: the server (`server/`) has a single dependency (`yaml`), the page
(`public/`) loads Cytoscape from `node_modules`. Pushing a `v*` tag runs the tests, builds
the archive (`deploy/paquet.sh`, with its `node_modules`) and attaches it to the GitHub
release.

## Contributing

Missing fingerprint? It is one line in [`server/signatures.mjs`](server/signatures.mjs).
Pull requests welcome.

MIT licensed.

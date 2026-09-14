# Docker Deployment

## Requirements

- Docker Desktop or Docker Engine with Compose v2
- At least 6 GB free memory and 5 GB free disk space
- Internet access during the first launch to download the container images and models

## Start

```bash
docker compose up -d --build
docker compose logs -f model-setup
```

The first launch downloads Qwen3 4B and EmbeddingGemma. Depending on the connection, this can take several minutes. The `businessos` service starts automatically after both models are available. Later launches reuse the `ollama-data` volume.

Open `http://localhost:4173`. Create the owner account, load the demo tenant or enter the real company profile, and optionally save a Gemini API key under **AI & Connections**.

## Desktop Window

Chrome and Edge detect the dashboard as an installable app. Choose **Install desktop app** or use the install icon in the address bar. The installed PWA opens without normal browser chrome and receives its own shortcut and application icon.

Docker containers cannot directly open a native graphical window on every host operating system. The PWA is therefore the portable desktop client, while Docker provides the local backend, data layer, and model runtime. A separately signed Tauri installer can later wrap the same `http://localhost:4173` application for managed Windows/macOS/Linux distribution.

## Operations

```bash
docker compose ps
docker compose logs -f businessos
docker compose restart businessos
docker compose down
```

`docker compose down` preserves company and model data. Do not add `--volumes` unless all local accounts, company data, encrypted credentials, and downloaded models should be permanently deleted.

## Security

The default port mapping listens only on `127.0.0.1`, so the dashboard is not exposed to the local network or internet. Use a TLS reverse proxy and an explicit production authentication review before changing the binding for remote access.

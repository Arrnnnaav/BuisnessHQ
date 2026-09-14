# BusinessOS Desktop Experience

The Docker stack exposes the complete product at `http://localhost:4173`. The dashboard is also a Progressive Web App, so Chrome or Edge can install it as a standalone desktop window with its own icon and shortcut.

1. Run `docker compose up -d --build` from the repository root.
2. Open `http://localhost:4173`.
3. Click **Install desktop app** when offered, or use the browser's **Install app** command.

This is the portable desktop distribution because it works on Windows, macOS, and Linux while keeping the backend and Ollama isolated in Docker. A Tauri executable would still require a signed build for each operating system and cannot be launched as a graphical window by a Linux Docker container.

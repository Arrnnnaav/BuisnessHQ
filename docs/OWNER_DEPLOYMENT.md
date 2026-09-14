# Owner deployment and staging setup

## Start BusinessOS

Install Docker Desktop with Compose, copy this repository to the owner machine, then run:

```bash
docker compose up -d --build
docker compose logs -f model-setup
```

Open `http://localhost:4173`. The first run creates the owner account. Business data and encrypted credentials are stored in the `businessos-data` volume; Ollama models are stored separately in `ollama-data`.

If an existing installation reports the wrong password, recover access without deleting company data:

```bash
docker compose exec businessos node scripts/reset-owner.mjs --name "Company Owner" --email owner@example.com --password "use-a-new-password-12" --confirm RESET-OWNER
```

Sign in with the new email and password. Do not use `docker compose down -v` unless the entire installation, including company data, is intentionally being erased.

## Connect WordPress staging

1. Back up staging and ensure it has a separate HTTPS URL from production.
2. Upload `wordpress-plugin/businessos-connector` as a WordPress plugin and activate it.
3. In `wp-config.php`, add `define('BUSINESSOS_STAGING_SITE', true);` before the stop-editing line.
4. Create a WordPress user for the connector, assign the **BusinessOS Connector** role, and create an Application Password for that user.
5. In BusinessOS, open **SEO Workspace → Connector setup**, enter the staging URL, connector username, and Application Password, then save. BusinessOS can create owned drafts only; production publishing and deletion remain disabled.

## Search Console

Create a Google OAuth web client and add this exact redirect URI for a local deployment:

`http://localhost:4173/api/search-console/oauth/callback`

Enter the client ID and secret in **SEO Workspace**, authorize read-only Search Console access, crawl the production URL, and import Search Analytics evidence. The first V1 flow is: discover opportunity → generate proposal → review in **Needs You** → approve exact title/meta → create staging draft → verify and audit.

## Desktop app

The dashboard is an installable PWA. In Chrome or Edge, open `http://localhost:4173`, choose **Install BusinessOS** from the address-bar install icon or browser menu, and use the resulting desktop shortcut/window. It uses the same local dashboard and Docker backend.

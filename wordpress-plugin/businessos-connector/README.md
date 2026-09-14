# BusinessOS Staging Connector

Install this folder as a WordPress plugin on the staging site only. Add `define('BUSINESSOS_STAGING_SITE', true);` to staging `wp-config.php`, activate the plugin, create a user with the **BusinessOS Connector** role, and create an Application Password for that user.

The connector independently enforces draft-only creation, BusinessOS ownership markers, and updates only to owned drafts. It exposes no publish, delete, plugin, theme, user, or settings route.

Production WordPress should not install the write connector. BusinessOS reads production through the public crawler and fingerprints the live page before and after staging writes.

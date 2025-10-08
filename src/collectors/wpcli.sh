#!/usr/bin/env bash
# Vereist wp-cli beschikbaar op de server of via SSH container.
# Voor starters: dit script is optioneel. Je kunt het overslaan als je geen servertoegang hebt.

set -e
WP_PATH=${1:-/var/www/html}
cd "$WP_PATH"

wp plugin list --format=json > plugins.json
wp plugin list --update=available --format=json > plugins_updates.json
wp plugin list --status=inactive --format=json > plugins_inactive.json

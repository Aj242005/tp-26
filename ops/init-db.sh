#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" --set=worker_password="$WORKER_DB_PASSWORD" \
  --set=keycloak_password="$KEYCLOAK_DB_PASSWORD" \
  --set=app_user="$APP_DB_USER" --set=worker_user="$WORKER_DB_USER" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
CREATE ROLE :"worker_user" LOGIN PASSWORD :'worker_password';
CREATE ROLE keycloak LOGIN PASSWORD :'keycloak_password';
CREATE DATABASE keycloak OWNER keycloak;
SQL

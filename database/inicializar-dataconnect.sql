-- Migração aditiva já aplicada ao PostgreSQL do salão.
-- As operações do dia a dia devem ser feitas pelo painel.
BEGIN;
CREATE TABLE "public"."salon_session" ("id" text NOT NULL, "expires_at" timestamptz NOT NULL, PRIMARY KEY ("id"));
CREATE TABLE "public"."salon_state" ("id" text NOT NULL, "payload" text NOT NULL, "revision" integer NOT NULL, PRIMARY KEY ("id"));
COMMIT;

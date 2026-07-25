-- Upgrade installations that previously created website-scoped MCP keys.
ALTER TABLE "website" DROP COLUMN IF EXISTS "mcp_enabled";
ALTER TABLE "mcp_key" ADD COLUMN IF NOT EXISTS "user_id" text;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'mcp_key' AND column_name = 'website_id'
	) THEN
		UPDATE "mcp_key" AS key
		SET "user_id" = website."user_id"
		FROM "website" AS website
		WHERE key."website_id" = website."id" AND key."user_id" IS NULL;
	END IF;
END $$;

-- Orphaned legacy keys cannot be safely assigned to an account.
DELETE FROM "mcp_key" WHERE "user_id" IS NULL;
ALTER TABLE "mcp_key" ALTER COLUMN "user_id" SET NOT NULL;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mcp_key_user_id_user_id_fk') THEN
		ALTER TABLE "mcp_key" ADD CONSTRAINT "mcp_key_user_id_user_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
	END IF;
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'mcp_key' AND column_name = 'website_id'
	) THEN
		ALTER TABLE "mcp_key" DROP COLUMN "website_id";
	END IF;
END $$;

DROP INDEX IF EXISTS "mcpKey_websiteId_idx";
CREATE INDEX IF NOT EXISTS "mcpKey_userId_idx" ON "mcp_key" USING btree ("user_id");

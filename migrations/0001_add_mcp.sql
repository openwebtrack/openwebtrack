CREATE TABLE IF NOT EXISTS "mcp_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"key_hash" text NOT NULL UNIQUE,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mcpKey_userId_idx" ON "mcp_key" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "mcpKey_keyHash_idx" ON "mcp_key" USING btree ("key_hash");

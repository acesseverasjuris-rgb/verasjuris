ALTER TABLE "sessions" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
UPDATE "sessions" SET "last_used_at" = "created_at" WHERE "last_used_at" IS NULL;

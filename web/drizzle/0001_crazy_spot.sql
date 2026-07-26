ALTER TABLE "users" ADD COLUMN "totp_secret_pending_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_used_counter" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_failed_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_locked_until" timestamp with time zone;
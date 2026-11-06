ALTER TABLE "price_refresh_requests" ALTER COLUMN "requested_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "price_refresh_requests" ALTER COLUMN "requested_at" DROP NOT NULL;
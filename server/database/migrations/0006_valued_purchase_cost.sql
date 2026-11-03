ALTER TABLE "stock_value_snapshots" ADD COLUMN "valued_purchase_cost_cents" integer;--> statement-breakpoint
UPDATE "stock_value_snapshots" SET "valued_purchase_cost_cents" = "purchase_cost_cents";--> statement-breakpoint
ALTER TABLE "stock_value_snapshots" ALTER COLUMN "valued_purchase_cost_cents" SET NOT NULL;

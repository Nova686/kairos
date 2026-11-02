CREATE TABLE "condition_mappings" (
	"category" text NOT NULL,
	"source" text NOT NULL,
	"source_condition" text NOT NULL,
	"kairos_condition" text NOT NULL,
	CONSTRAINT "condition_mappings_category_source_source_condition_pk" PRIMARY KEY("category","source","source_condition")
);
--> statement-breakpoint
CREATE TABLE "excluded_listings" (
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"excluded_by_user_id" uuid NOT NULL,
	"excluded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "excluded_listings_product_id_url_pk" PRIMARY KEY("product_id","url")
);
--> statement-breakpoint
CREATE TABLE "price_refresh_requests" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requested_by_user_id" uuid,
	"last_refreshed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_snapshot_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"title" text NOT NULL,
	"price_cents" integer NOT NULL,
	"shipping_cents" integer,
	"source_condition" text,
	"url" text NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"source_condition" text,
	"kairos_condition" text,
	"grading_company" text,
	"grade" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"average_cents" integer,
	"median_cents" integer,
	"low_cents" integer,
	"trend_cents" integer,
	"listing_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_value_snapshots" (
	"owner_id" uuid NOT NULL,
	"snapshot_on" date NOT NULL,
	"purchase_cost_cents" integer NOT NULL,
	"estimated_value_cents" integer NOT NULL,
	"valued_item_count" integer NOT NULL,
	"approximate_item_count" integer NOT NULL,
	"unvalued_item_count" integer NOT NULL,
	CONSTRAINT "stock_value_snapshots_owner_id_snapshot_on_pk" PRIMARY KEY("owner_id","snapshot_on")
);
--> statement-breakpoint
CREATE TABLE "title_condition_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"pattern" text NOT NULL,
	"kairos_condition" text NOT NULL,
	"priority" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalogue_changes" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "catalogue_changes" ADD COLUMN "subject" text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "excluded_listings" ADD CONSTRAINT "excluded_listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excluded_listings" ADD CONSTRAINT "excluded_listings_excluded_by_user_id_users_id_fk" FOREIGN KEY ("excluded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_refresh_requests" ADD CONSTRAINT "price_refresh_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_refresh_requests" ADD CONSTRAINT "price_refresh_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshot_listings" ADD CONSTRAINT "price_snapshot_listings_snapshot_id_price_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."price_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_value_snapshots" ADD CONSTRAINT "stock_value_snapshots_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_snapshots_product_observed_idx" ON "price_snapshots" USING btree ("product_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "title_condition_rules_category_pattern_idx" ON "title_condition_rules" USING btree ("category","pattern");
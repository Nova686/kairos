CREATE TABLE "product_image_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"image_url" text,
	"upload_fingerprint" text,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_image_embeddings_upload_fingerprint_unique" UNIQUE("upload_fingerprint")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_embedding_failure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_image_embeddings" ADD CONSTRAINT "product_image_embeddings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
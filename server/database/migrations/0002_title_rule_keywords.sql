DROP INDEX "title_condition_rules_category_pattern_idx";--> statement-breakpoint
ALTER TABLE "title_condition_rules" ADD COLUMN "keywords" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "title_condition_rules" SET "keywords" = ARRAY['vide', 'empty', 'sans cartes', 'incompl'] WHERE "category" = 'pokemon-sealed' AND "pattern" = '\b(vide|empty|sans cartes|incompl)';--> statement-breakpoint
UPDATE "title_condition_rules" SET "keywords" = ARRAY['ouvert', 'opened', 'open'] WHERE "category" = 'pokemon-sealed' AND "pattern" = '\b(ouvert|opened|open)\b';--> statement-breakpoint
UPDATE "title_condition_rules" SET "keywords" = ARRAY['abîm', 'abim', 'cabossé', 'dented', 'damaged', 'enfonc'] WHERE "category" = 'pokemon-sealed' AND "pattern" = '(ab[iî]m|cabossé|dented|damaged|enfonc)';--> statement-breakpoint
UPDATE "title_condition_rules" SET "keywords" = ARRAY[btrim(regexp_replace("pattern", '[^[:alnum:] ]', '', 'g'))] WHERE cardinality("keywords") = 0 AND char_length(btrim(regexp_replace("pattern", '[^[:alnum:] ]', '', 'g'))) >= 2;--> statement-breakpoint
DELETE FROM "title_condition_rules" WHERE cardinality("keywords") = 0;--> statement-breakpoint
ALTER TABLE "title_condition_rules" ALTER COLUMN "keywords" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "title_condition_rules" DROP COLUMN "pattern";

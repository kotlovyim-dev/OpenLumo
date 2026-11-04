CREATE TABLE "brand_research" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"findings" jsonb,
	"researched_at" timestamp with time zone,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_research" ADD CONSTRAINT "brand_research_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
CREATE TYPE "public"."category_source" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."message_category" AS ENUM('question', 'complaint', 'praise', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('processing', 'draft_ready', 'approved', 'failed');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_name" varchar(120),
	"customer_email" varchar(254),
	"body" text NOT NULL,
	"category" "message_category",
	"category_confidence" real,
	"category_source" "category_source",
	"status" "message_status" DEFAULT 'processing' NOT NULL,
	"ai_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"ai_draft" text NOT NULL,
	"body" text NOT NULL,
	"model" varchar(100) NOT NULL,
	"prompt_version" varchar(20) NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "replies_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
ALTER TABLE "replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_category_idx" ON "messages" USING btree ("category");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");
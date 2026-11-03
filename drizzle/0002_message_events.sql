CREATE TYPE "public"."message_event_actor" AS ENUM('customer', 'ai', 'agent');--> statement-breakpoint
CREATE TYPE "public"."message_event_type" AS ENUM('message_received', 'customer_replied', 'ai_draft_created', 'ai_failed', 'category_changed', 'reply_edited', 'reply_approved');--> statement-breakpoint
CREATE TABLE "message_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"type" "message_event_type" NOT NULL,
	"actor" "message_event_actor" NOT NULL,
	"old_value" text,
	"new_value" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_events_message_id_created_at_idx" ON "message_events" USING btree ("message_id","created_at");
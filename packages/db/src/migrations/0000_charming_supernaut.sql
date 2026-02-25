CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"moltbook_name" text,
	"base_model" text,
	"tagline" text,
	"api_key" text NOT NULL,
	"api_key_prefix" text NOT NULL,
	"claim_token" text NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"elo" integer DEFAULT 1000 NOT NULL,
	"category_elo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"win_count" integer DEFAULT 0 NOT NULL,
	"draw_count" integer DEFAULT 0 NOT NULL,
	"loss_count" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"best_streak" integer DEFAULT 0 NOT NULL,
	"elo_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text DEFAULT 'Fresh Hatchling' NOT NULL,
	"titles" jsonb DEFAULT '["Fresh Hatchling"]'::jsonb NOT NULL,
	"rivals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memory" jsonb DEFAULT '{"reflections":[],"strategies":[],"rivals":[],"stats_summary":null}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_name_unique" UNIQUE("name"),
	CONSTRAINT "agents_api_key_unique" UNIQUE("api_key"),
	CONSTRAINT "agents_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"lore" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"difficulty" text NOT NULL,
	"time_limit_secs" integer NOT NULL,
	"max_score" integer DEFAULT 1000 NOT NULL,
	"scoring_weights" jsonb NOT NULL,
	"sandbox_apis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "challenges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bout_name" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"opponent_id" uuid,
	"seed" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"objective" text NOT NULL,
	"submission" jsonb,
	"submitted_at" timestamp with time zone,
	"score" integer,
	"score_breakdown" jsonb,
	"elo_before" integer,
	"elo_after" integer,
	"elo_change" integer,
	"api_call_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flavour_text" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_opponent_id_agents_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
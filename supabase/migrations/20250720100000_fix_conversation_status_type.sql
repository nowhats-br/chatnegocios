/*
# [Fix] Create ConversationStatus Enum Type
[Description of what this operation does]
This script ensures the custom type `ConversationStatus` exists and is correctly applied to the `conversations` table. This fixes a previous migration error and is required for the Kanban board and chat filtering features.

## Query Description: [This is a structural change to fix a previous migration error. It creates a new data type ('new', 'active', 'pending', 'resolved') and converts the existing 'status' column from plain text to this new, stricter type. There is no risk of data loss, as long as existing statuses are one of these values.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false]

## Structure Details:
- Creates ENUM type: `ConversationStatus`
- Alters table: `conversations`
- Alters column: `status`

## Security Implications:
- RLS Status: [Not Affected]
- Policy Changes: [No]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [Not Affected]
- Triggers: [Not Affected]
- Estimated Impact: [Low. A brief lock on the `conversations` table may occur during the column type alteration.]
*/

DO $$
BEGIN
    -- Step 1: Create the ENUM type only if it doesn't already exist.
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversationstatus') THEN
        CREATE TYPE public."ConversationStatus" AS ENUM (
            'new',
            'active',
            'pending',
            'resolved'
        );
    END IF;
END
$$;

-- Step 2: Alter the existing 'status' column in the conversations table.
-- We only do this if the column is not already of the correct type.
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'status') != 'ConversationStatus' THEN
        
        ALTER TABLE public.conversations
            ALTER COLUMN status SET DEFAULT 'new',
            ALTER COLUMN status TYPE public."ConversationStatus" USING status::text::"ConversationStatus";
    END IF;
END
$$;

/*
# [Structural] Add Connection Link to Conversations
This migration adds a `connection_id` column to the `conversations` table, establishing a crucial link between a conversation and the WhatsApp instance it belongs to.

## Query Description:
This operation adds a new column and a foreign key constraint. It is a non-destructive change and should not impact existing data, although the new column will be `NULL` for existing rows until populated. This link is essential for sending messages, as the system needs to know which connection to use for outgoing communication.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Table `conversations`: Adds column `connection_id` (UUID) and a foreign key constraint to `connections(id)`.

## Security Implications:
- RLS Status: No change to existing RLS policies.
- Policy Changes: No.
- Auth Requirements: None.

## Performance Impact:
- Indexes: A foreign key index will be automatically created on `connection_id`.
- Triggers: None.
- Estimated Impact: Negligible performance impact on existing operations.
*/

-- Add the connection_id column to the conversations table
ALTER TABLE public.conversations
ADD COLUMN connection_id UUID;

-- Add the foreign key constraint
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_connection_id_fkey
FOREIGN KEY (connection_id)
REFERENCES public.connections(id)
ON DELETE SET NULL;

-- Add a comment to the column for clarity
COMMENT ON COLUMN public.conversations.connection_id IS 'The connection (WhatsApp instance) this conversation belongs to.';

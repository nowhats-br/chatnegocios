/*
# [Operation Name]
Add 'new' status to ConversationStatus enum

## Query Description: [This operation safely adds a new value 'new' to the "ConversationStatus" enum type. This change is non-destructive and is required for the new Kanban board feature to categorize new, unassigned conversations.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [false] -- Dropping enum values is complex.

## Structure Details:
- Type "ConversationStatus": Adding value 'new'.

## Security Implications:
- RLS Status: [Not Applicable]
- Policy Changes: [No]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [No change]
- Triggers: [No change]
- Estimated Impact: [None]
*/

ALTER TYPE public."ConversationStatus" ADD VALUE IF NOT EXISTS 'new' BEFORE 'active';

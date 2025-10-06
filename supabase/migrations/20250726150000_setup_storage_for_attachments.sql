/*
# [Operation] Setup Storage for Attachments
[This script sets up a dedicated storage bucket for handling file attachments in chats, such as images, documents, and audio files.]

## Query Description: [This operation creates a new public storage bucket named 'attachments' and configures its security policies. It is a non-destructive, structural change.
1.  A new bucket 'attachments' will be created if it doesn't exist.
2.  Security policies will be added to allow authenticated users to upload files and manage their own uploads.
3.  The bucket is public, meaning anyone with a direct link can view the files, which is necessary for them to appear in the chat interface.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- storage.buckets: A new row for 'attachments' will be inserted.
- storage.objects: New RLS policies will be created.

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes]
- Auth Requirements: [Authenticated users for uploads/management]

## Performance Impact:
- Indexes: [None]
- Triggers: [None]
- Estimated Impact: [Negligible performance impact.]
*/

-- Create a public bucket for chat attachments if it doesn't exist.
-- We are setting a 10MB file size limit and allowing common document, image, and audio types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attachments', 'attachments', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'audio/ogg', 'audio/mpeg', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;


-- Drop existing policies to ensure a clean state
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own attachments" ON storage.objects;


-- Policy: Authenticated users can upload files to the 'attachments' bucket.
-- The 'owner' of the file will automatically be set to the uploader's user_id.
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');


-- Policy: Users can update or delete their own files.
-- They cannot access files uploaded by other users.
CREATE POLICY "Users can manage their own attachments"
ON storage.objects FOR UPDATE, DELETE
TO authenticated
USING (auth.uid() = owner);

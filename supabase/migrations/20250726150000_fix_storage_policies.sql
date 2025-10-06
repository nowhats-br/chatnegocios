-- This script corrects the RLS policies for the 'attachments' storage bucket.

-- Step 1: Create the storage bucket if it doesn't exist.
-- The bucket is named 'attachments' and is set to be public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop old, potentially incorrect policies to avoid conflicts.
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public attachments" ON storage.objects;
-- This drops the policy that was likely created with the syntax error.
DROP POLICY IF EXISTS "Users can update and delete their own attachments" ON storage.objects;


-- Step 3: Recreate the policies with the correct syntax.

-- Policy 3.1: Allow authenticated users to upload files into their own folder.
CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'attachments' AND auth.uid() = owner);

-- Policy 3.2: Allow authenticated users to update their own files.
CREATE POLICY "Authenticated users can update their own attachments"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'attachments' AND auth.uid() = owner)
    WITH CHECK (bucket_id = 'attachments' AND auth.uid() = owner);

-- Policy 3.3: Allow authenticated users to delete their own files.
CREATE POLICY "Authenticated users can delete their own attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'attachments' AND auth.uid() = owner);

-- Policy 3.4: Make files in the 'attachments' bucket publicly readable.
-- This is crucial for displaying images and files in the chat interface.
CREATE POLICY "Anyone can view public attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'attachments');

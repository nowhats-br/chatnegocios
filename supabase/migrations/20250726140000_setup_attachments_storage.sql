/*
          # [Operation Name]
          Configuração do Supabase Storage para Anexos

          ## Query Description: "Este script cria e configura o repositório de arquivos (bucket) para os anexos do chat. Ele cria um bucket público chamado 'attachments' e aplica políticas de segurança (RLS) para garantir que os usuários só possam enviar, alterar ou deletar seus próprios arquivos, mantendo a privacidade e a organização dos dados."
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Cria o bucket de armazenamento: `attachments`
          - Adiciona 4 políticas de segurança (RLS) para o bucket `attachments` (SELECT, INSERT, UPDATE, DELETE).
          
          ## Security Implications:
          - RLS Status: Enabled
          - Policy Changes: Yes
          - Auth Requirements: As políticas garantem que apenas usuários autenticados possam gerenciar seus próprios arquivos.
          
          ## Performance Impact:
          - Indexes: None
          - Triggers: None
          - Estimated Impact: Nenhum impacto de performance esperado.
          */

-- Cria um novo bucket de armazenamento chamado "attachments" para os anexos do chat.
-- O bucket é público para que os links dos arquivos possam ser acessados facilmente.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Política de Segurança: Permite que usuários autenticados visualizem qualquer arquivo no bucket.
-- Isso é necessário para que os arquivos possam ser exibidos no chat para todos os participantes.
create policy "Allow authenticated read access"
on storage.objects for select
to authenticated
using ( bucket_id = 'attachments' );

-- Política de Segurança: Permite que usuários autenticados enviem arquivos.
-- A política garante que um usuário só possa fazer upload para uma pasta com o nome do seu próprio ID de usuário.
-- Ex: /attachments/USER_ID/arquivo.jpg
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text );

-- Política de Segurança: Permite que usuários autenticados atualizem seus próprios arquivos.
create policy "Allow authenticated updates on own files"
on storage.objects for update
to authenticated
using ( bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text );

-- Política de Segurança: Permite que usuários autenticados deletem seus próprios arquivos.
create policy "Allow authenticated deletes on own files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text );

/*
          # [Operation Name]
          Renomear coluna 'owner_id' para 'user_id' na tabela 'connections'

          ## Query Description: ["Esta operação corrige um erro de nome de coluna na tabela de conexões. É uma alteração estrutural segura que não afeta os dados existentes, apenas renomeia a coluna para alinhar o banco de dados com o código da aplicação e resolver o erro de 'violates not-null constraint' de uma vez por todas."]
          
          ## Metadata:
          - Schema-Category: "Structural"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Tabela afetada: public.connections
          - Coluna renomeada: de 'owner_id' para 'user_id'
          
          ## Security Implications:
          - RLS Status: Habilitado (a política existente que usa 'user_id' passará a funcionar corretamente)
          - Policy Changes: Não
          - Auth Requirements: Não
          
          ## Performance Impact:
          - Indexes: O índice da coluna será renomeado automaticamente.
          - Triggers: Não
          - Estimated Impact: Nenhum impacto de performance esperado.
          */

ALTER TABLE public.connections
RENAME COLUMN owner_id TO user_id;

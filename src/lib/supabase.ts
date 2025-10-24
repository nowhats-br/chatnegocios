import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Não derruba a aplicação se variáveis estiverem ausentes.
// Em vez disso, registra um aviso e expõe um cliente "stub" mínimo
// para evitar que a UI quebre com tela branca.
let client: any;

if (supabaseUrl && supabaseAnonKey) {
  client = createClient<Database>(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('[Supabase] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes. Funcionalidades de autenticação/DB ficarão indisponíveis.')
  client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      signUp: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    },
    from: () => ({
      select: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      insert: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      update: async () => ({ data: null, error: new Error('Supabase não configurado') }),
      delete: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    }),
    rpc: async () => ({ error: new Error('Supabase não configurado') }),
  }
}

export const supabase = client

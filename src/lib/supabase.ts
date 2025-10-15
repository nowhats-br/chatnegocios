import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase: any;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('[Supabase] Variáveis não definidas; usando stub local sem persistência.')
  const noopPromise = async () => ({ data: null, error: null })
  const listPromise = async () => ({ data: [], error: null })
  const chainable = {
    select: listPromise,
    insert: noopPromise,
    update: noopPromise,
    delete: noopPromise,
    order(this: any, _field: string, _opts: any) { return this },
    eq(this: any, _field: string, _value: any) { return this },
    single: noopPromise,
  }
  supabase = {
    from(_table: string) { return { ...chainable } },
    auth: {
      async getSession() { return { data: { session: null } } },
      async signInWithPassword(_creds: any) { return { error: null } },
      async signUp(_data: any) { return { error: null } },
      onAuthStateChange(_cb: any) { return { data: { subscription: { unsubscribe() {} } } } },
    },
    storage: {
      from(_bucket: string) { return { 
        async upload(_path: string, _file: any) { return { data: null, error: null } },
        getPublicUrl(_path: string) { return { data: { publicUrl: '' } } },
      } },
    },
    channel(_name: string) {
      const ch: any = { on: () => ch, subscribe: () => ({}) }
      return ch
    },
    removeChannel(_channel: any) { /* noop */ },
  }
}

export { supabase }

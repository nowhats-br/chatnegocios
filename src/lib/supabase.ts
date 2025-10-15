// Local stub to replace Supabase usage. No external dependencies.
// Provides minimal APIs used across the app, wired to backend or no-ops.

type Session = { user: any } | null;

const subscribers: Array<(event: string, session: Session) => void> = [];

const emitAuthChange = (event: string, session: Session) => {
  subscribers.forEach((fn) => fn(event, session));
};

const getLocalUser = () => {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const makeSession = (user: any): Session => (user ? { user } : null);

const supabase: any = {
  // Database operations: no-op chainable to keep UI compiling
  from(_table: string) {
    const noop = async () => ({ data: [], error: null });
    const noopSingle = async () => ({ data: null, error: null });
    const chain: any = {
      select: noop,
      insert: noopSingle,
      update: noopSingle,
      delete: noopSingle,
      order(_field: string, _opts: any) { return chain; },
      eq(_field: string, _value: any) { return chain; },
      single: noopSingle,
    };
    return chain;
  },

  // Auth wired to backend endpoints
  auth: {
    async getSession() {
      const user = getLocalUser();
      return { data: { session: makeSession(user) }, error: null };
    },
    onAuthStateChange(callback: (event: any, session: any) => void) {
      subscribers.push(callback);
      return { data: { subscription: { unsubscribe: () => {
        const idx = subscribers.indexOf(callback);
        if (idx >= 0) subscribers.splice(idx, 1);
      } } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string; }) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          return { data: { user: null, session: null }, error: err };
        }
        const data = await res.json();
        const user = data?.user;
        if (user) {
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
        const session = makeSession(user);
        emitAuthChange('SIGNED_IN', session);
        return { data: { user, session }, error: null };
      } catch (error: any) {
        return { data: { user: null, session: null }, error: { message: error?.message || 'Login failed' } };
      }
    },
    async signUp({ email, password }: { email: string; password: string; }) {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          return { data: { user: null, session: null }, error: err };
        }
        // Do not auto sign-in on signup; require explicit login
        return { data: { user: null, session: null }, error: null };
      } catch (error: any) {
        return { data: { user: null, session: null }, error: { message: error?.message || 'Signup failed' } };
      }
    },
    async signOut() {
      localStorage.removeItem('auth_user');
      emitAuthChange('SIGNED_OUT', null);
      return { error: null };
    },
  },

  // Storage: no-op
  storage: {
    from(_bucket: string) {
      return {
        async upload(_path: string, _file: any) { return { data: null, error: null }; },
        getPublicUrl(_path: string) { return { data: { publicUrl: '' } }; },
      };
    },
  },

  // Realtime: no-op
  channel(_name: string) {
    const ch: any = { on: () => ch, subscribe: () => ({}) };
    return ch;
  },
  removeChannel(_channel: any) { /* noop */ },
};

export { supabase };
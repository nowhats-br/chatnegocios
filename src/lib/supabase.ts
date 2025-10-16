// Stub seguro para evitar erro "supabaseUrl is required".
// Este projeto migrou para backend Express + Postgre/APIs.
// Qualquer uso desta referência deve ser substituído por dbClient e endpoints REST.

function throwRemoved(feature: string) {
  throw new Error(`Supabase removido: substitua chamadas (${feature}) pelo backend/REST`);
}

export const supabase: any = {
  from: () => ({
    select: () => throwRemoved('from().select'),
    insert: () => throwRemoved('from().insert'),
    update: () => throwRemoved('from().update'),
    delete: () => throwRemoved('from().delete'),
    eq: () => throwRemoved('from().eq'),
    order: () => throwRemoved('from().order'),
    single: () => throwRemoved('from().single'),
  }),
  storage: {
    from: () => ({
      upload: () => throwRemoved('storage.from().upload'),
      getPublicUrl: () => throwRemoved('storage.from().getPublicUrl'),
    }),
  },
  channel: () => ({ subscribe: () => throwRemoved('realtime channel') }),
  removeChannel: () => {},
};
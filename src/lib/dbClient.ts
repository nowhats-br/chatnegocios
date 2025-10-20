const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string) || 'http://localhost:3001';

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof body === 'string' ? body : body?.error || 'Erro na requisição';
    throw new Error(message);
  }
  return body as T;
}

export const dbClient = {
  auth: {
    async login(email: string, password: string) {
      return await http<{ token: string; user: { id: string; email: string } }>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    async me() {
      return await http<{ user: { id: string; email: string } }>(`/auth/me`);
    },
    async logout() {
      return await http<{ ok: boolean }>(`/auth/logout`, { method: 'POST' });
    },
  },
  profiles: {
    async get(userId: string) {
      return await http<{ evolution_api_url: string | null; evolution_api_key: string | null }>(`/profiles/${userId}`);
    },
    async update(userId: string, evolution_api_url: string, evolution_api_key: string) {
      return await http<{ ok: boolean }>(`/profiles/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ evolution_api_url, evolution_api_key }),
      });
    },
  },
  connections: {
    async list() {
      return await http<any[]>(`/connections`);
    },
    async getById(id: number | string) {
      return await http<any>(`/connections/${id}`);
    },
    async create(payload: { user_id: string; instance_name: string; status?: string; instance_data?: any }) {
      return await http<any>(`/connections`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async update(id: number, patch: { status?: string; instance_data?: any }) {
      return await http<any>(`/connections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    async delete(id: number) {
      return await http<{ ok: boolean }>(`/connections/${id}`, { method: 'DELETE' });
    },
  },
  conversations: {
    async listWithContact() {
      return await http<any[]>(`/conversations`);
    },
    async update(id: string, patch: { status: string }) {
      return await http<any>(`/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
  },
  messages: {
    async listByConversation(conversationId: string) {
      const params = new URLSearchParams({ conversationId });
      return await http<any[]>(`/messages?${params.toString()}`);
    },
    async create(payload: { conversation_id: string; content: string | null; sender_is_user: boolean; message_type: string; user_id: string }) {
      return await http<any>(`/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },
  quickResponses: {
    async list() {
      return await http<any[]>(`/quick_responses`);
    },
    async create(payload: { user_id: string; shortcut: string; message: string }) {
      return await http<any>(`/quick_responses`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async update(id: string, payload: { shortcut?: string; message?: string }) {
      return await http<any>(`/quick_responses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    async delete(id: string) {
      return await http<{ ok: boolean }>(`/quick_responses/${id}`, { method: 'DELETE' });
    },
  },
  products: {
    async list() {
      return await http<any[]>(`/products`);
    },
    async create(payload: { user_id: string; name: string; description?: string | null; price: number; stock: number; image_url?: string | null; category?: string | null }) {
      return await http<any>(`/products`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async update(id: string, payload: { name?: string; description?: string | null; price?: number; stock?: number; image_url?: string | null; category?: string | null }) {
      return await http<any>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    async delete(id: string) {
      return await http<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' });
    },
  },
  tags: {
    async list() {
      return await http<any[]>(`/tags`);
    },
    async create(payload: { user_id: string; name: string; color?: string | null }) {
      return await http<any>(`/tags`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async update(id: string, payload: { name?: string; color?: string | null }) {
      return await http<any>(`/tags/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    async delete(id: string) {
      return await http<{ ok: boolean }>(`/tags/${id}`, { method: 'DELETE' });
    },
  },
  contacts: {
    async listWithTags() {
      return await http<any[]>(`/contacts`);
    },
    async delete(id: number) {
      return await http<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' });
    },
    async updateTags(id: number, tagIds: string[]) {
      return await http<any>(`/contacts/${id}/tags`, {
        method: 'PUT',
        body: JSON.stringify({ tag_ids: tagIds }),
      });
    },
  },
  system: {
    async updateCheck() {
      return await http<{ available: boolean; currentSha: string; latestSha: string; latestMessage: string; latestDate: string; branch: string }>(`/system/update/check`);
    },
    async updateApply() {
      return await http<{ ok: boolean; requiresRestart: boolean }>(`/system/update/apply`, { method: 'POST' });
    },
  },
};
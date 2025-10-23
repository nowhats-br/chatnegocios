import { supabase } from './supabase';
import { 
  Connection, 
  Product, 
  Tag, 
  QuickResponse, 
  Conversation, 
  Message,
  ConnectionStatus
} from '@/types/database';

// Helper para obter o ID do usuário logado
const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Usuário não autenticado.");
  return session.user.id;
};

export const dbClient = {
  auth: {
    async login(email: string, password: string) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { token: data.session.access_token, user: data.user };
    },
    async register(email: string, password: string) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
    },
    async me() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user };
    },
    async logout() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  },
  profiles: {
    async get(userId: string) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error && error.code !== 'PGRST116') throw error; // Ignora erro "not found"
      return data || { evolution_api_url: null, evolution_api_key: null };
    },
    async update(userId: string, evolution_api_url: string, evolution_api_key: string) {
      const { error } = await supabase.from('profiles').upsert({ id: userId, evolution_api_url, evolution_api_key });
      if (error) throw error;
    },
  },
  connections: {
    async list(): Promise<Connection[]> {
      const { data, error } = await supabase.from('connections').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Connection[];
    },
    async create(payload: { instance_name: string; status?: ConnectionStatus; instance_data?: any }): Promise<Connection> {
      const userId = await getUserId();
      const { data, error } = await supabase.from('connections').insert({ 
        user_id: userId,
        instance_name: payload.instance_name,
        status: payload.status || 'DISCONNECTED',
        instance_data: payload.instance_data
      }).select().single();
      if (error) throw error;
      return data as Connection;
    },
    async update(id: string, patch: { status?: ConnectionStatus; instance_data?: any }): Promise<Connection> {
      const { data, error } = await supabase.from('connections').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Connection;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('connections').delete().eq('id', id);
      if (error) throw error;
    },
  },
  conversations: {
    async listWithContact(): Promise<Conversation[]> {
      const { data, error } = await supabase.from('conversations').select('*, contacts(*)').order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    async update(id: string, patch: { status: string }): Promise<Conversation> {
      const { data, error } = await supabase.from('conversations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data as Conversation;
    },
  },
  messages: {
    async listByConversation(conversationId: string): Promise<Message[]> {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    async create(payload: { conversation_id: string; content: string | null; sender_is_user: boolean; message_type: string; }): Promise<Message> {
      const userId = await getUserId();
      const { data, error } = await supabase.from('messages').insert({ ...payload, user_id: userId, id: crypto.randomUUID() }).select().single();
      if (error) throw error;
      // Trigger update on conversation
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', payload.conversation_id);
      return data as Message;
    },
  },
  quickResponses: {
    async list(): Promise<QuickResponse[]> {
      const { data, error } = await supabase.from('quick_responses').select('*');
      if (error) throw error;
      return data;
    },
    async create(payload: { shortcut: string; message: string }): Promise<QuickResponse> {
      const userId = await getUserId();
      const { data, error } = await supabase.from('quick_responses').insert({ ...payload, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    async update(id: string, payload: { shortcut?: string; message?: string }): Promise<QuickResponse> {
      const { data, error } = await supabase.from('quick_responses').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('quick_responses').delete().eq('id', id);
      if (error) throw error;
    },
  },
  products: {
    async list(): Promise<Product[]> {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      return data as Product[];
    },
    async create(payload: { name: string; description?: string | null; price: number; stock: number | null; image_url?: string | null; category?: string | null }): Promise<Product> {
      const userId = await getUserId();
      const { data, error } = await supabase.from('products').insert({ ...payload, user_id: userId }).select().single();
      if (error) throw error;
      return data as Product;
    },
    async update(id: string, payload: Partial<Product>): Promise<Product> {
      const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data as Product;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
  },
  tags: {
    async list(): Promise<Tag[]> {
      const { data, error } = await supabase.from('tags').select('*');
      if (error) throw error;
      return data;
    },
    async create(payload: { name: string; color?: string | null }): Promise<Tag> {
      const userId = await getUserId();
      const { data, error } = await supabase.from('tags').insert({ ...payload, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    async update(id: string, payload: { name?: string; color?: string | null }): Promise<Tag> {
      const { data, error } = await supabase.from('tags').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id: string): Promise<void> {
      await supabase.from('contact_tags').delete().eq('tag_id', id);
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
  },
  contacts: {
    async updateTags(contactId: string, tagIds: string[]): Promise<void> {
      const userId = await getUserId();
      // Remove existing tags for the contact
      const { error: deleteError } = await supabase.from('contact_tags').delete().eq('contact_id', contactId);
      if (deleteError) throw deleteError;
      
      // Add new tags if any
      if (tagIds.length > 0) {
        const newContactTags = tagIds.map(tag_id => ({ contact_id: contactId, tag_id, user_id: userId }));
        const { error: insertError } = await supabase.from('contact_tags').insert(newContactTags);
        if (insertError) throw insertError;
      }
    },
  },
  evolution: {
    async syncChats(payload: { connection_id?: string; instance_name?: string; limit?: number }) {
        // This function now just calls the backend endpoint, which is refactored to use Supabase admin
        const BASE_URL = (import.meta.env.VITE_BACKEND_URL as string) || window.location.origin;
        const res = await fetch(`${BASE_URL}/api/evolution/syncChats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Falha ao sincronizar chats');
        return body;
    }
  },
  system: {
    async updateCheck() {
        // This function is removed as it depends on a complex backend logic not migrated to Supabase functions yet.
        return { available: false, currentSha: 'N/A', latestSha: 'N/A', latestMessage: 'Verificação de atualização desabilitada na migração para Supabase.', latestDate: '', branch: '' };
    },
    async updateApply(): Promise<never> {
        throw new Error("Funcionalidade de atualização desabilitada na migração para Supabase.");
    }
  }
};

export type ConnectionStatus =
  | 'CREATED'
  | 'INITIALIZING'
  | 'DISCONNECTED'
  | 'WAITING_QR_CODE'
  | 'CONNECTED'
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSE';

export interface Connection {
  id: number;
  instance_name: string;
  status: ConnectionStatus;
  user_id?: string;
  created_at?: string;
  instance_data?: unknown;
}

export type ConversationStatus = 'new' | 'active' | 'pending' | 'resolved';

export type MessageType = 'text' | 'image' | 'file';

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export interface ContactTagRelation {
  tags: Tag;
}

export interface Contact {
  id: number;
  name?: string;
  avatar_url?: string | null;
  phone_number?: string | null;
  contact_tags?: ContactTagRelation[];
}

export interface Conversation {
  id: number;
  status: ConversationStatus;
  updated_at?: string;
  connection_id?: number;
  contacts?: Contact;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  stock?: number;
}

export interface Queue {
  id: string;
  name: string;
  description?: string | null;
}

export interface QuickResponse {
  id: number;
  shortcut: string;
  message: string;
  user_id?: string;
  created_at?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  user_id: string;
}

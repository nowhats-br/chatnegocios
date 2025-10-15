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

export type ConversationStatus = 'active' | 'resolved';

export type MessageType = 'text' | 'image' | 'file';

export interface Contact {
  name?: string;
  avatar_url?: string;
  phone_number?: string;
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
}

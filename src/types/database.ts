export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'WAITING_QR_CODE' | 'INITIALIZING' | 'PAUSED';
export type ConversationStatus = 'new' | 'active' | 'pending' | 'resolved';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'product';

export interface Connection {
  id: string;
  user_id: string;
  instance_name: string;
  status: ConnectionStatus;
  created_at: string;
  instance_data: Json | null;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface ContactTag {
  contact_id: string;
  tag_id: string;
  tags: Tag;
}

export interface Contact {
  id: string;
  user_id: string;
  phone_number: string;
  name: string | null;
  avatar_url: string | null;
  purchase_history: Json | null;
  created_at: string;
  contact_tags: ContactTag[];
}


export interface QuickResponse {
  id: string;
  user_id: string;
  shortcut: string;
  message: string;
  created_at: string;
}

export interface Queue {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  user_id: string; // Owner
  name: string;
  description: string | null;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface Conversation {
    id: string;
    user_id: string;
    contact_id: string;
    connection_id: string | null;
    status: ConversationStatus;
    created_at: string;
    updated_at: string;
    contacts: {
      name: string | null;
      avatar_url: string | null;
      phone_number: string;
    } | null;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_is_user: boolean;
    content: string | null;
    message_type: MessageType;
    created_at: string;
    user_id: string;
}

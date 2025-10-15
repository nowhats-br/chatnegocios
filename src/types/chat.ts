export type MessageType = 'text' | 'image' | 'file';

export interface Message {
  id: string | number;
  conversation_id: number;
  sender_is_user: boolean;
  content: string | null;
  message_type: MessageType;
  created_at: string;
  user_id?: string | null;
}
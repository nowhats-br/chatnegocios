export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'support' | 'sales' | 'billing' | 'technical' | 'other';

// Sistema de Tickets Automático - Implementado

export interface Ticket {
  id: string;
  number: string; // Número sequencial do ticket (ex: #2024001)
  user_id: string;
  conversation_id: string;
  contact_id: string;

  // Informações do ticket
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;

  // Atribuição
  assigned_to?: string; // ID do agente responsável
  assigned_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  first_response_at?: string;
  resolved_at?: string;
  closed_at?: string;

  // SLA
  sla_due_at?: string;
  sla_breached?: boolean;

  // Métricas
  response_time?: number; // Em minutos
  resolution_time?: number; // Em minutos

  // Tags e metadados
  tags?: string[];
  metadata?: Record<string, any>;

  // Relacionamentos
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
    avatar_url: string | null;
  };

  conversation?: {
    id: string;
    status: string;
    updated_at: string;
  };

  assigned_agent?: {
    id: string;
    name: string | null;
    email: string;
  };

  // Estatísticas
  message_count?: number;
  unread_count?: number;
  last_message?: {
    id: string;
    content: string | null;
    created_at: string;
    sender_is_user: boolean;
  };
}

export interface TicketActivity {
  id: string;
  ticket_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'assigned' | 'status_changed' | 'priority_changed' | 'commented' | 'resolved' | 'closed';
  description: string;
  old_value?: string;
  new_value?: string;
  created_at: string;

  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_internal: boolean; // Se é visível apenas para agentes
  created_at: string;

  user?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface TicketStats {
  total: number;
  new: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;

  // Por prioridade
  low_priority: number;
  normal_priority: number;
  high_priority: number;
  urgent_priority: number;

  // Métricas de tempo
  avg_response_time: number; // Em minutos
  avg_resolution_time: number; // Em minutos
  sla_breached: number;

  // Por categoria
  support: number;
  sales: number;
  billing: number;
  technical: number;
  other: number;
}

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assigned_to?: string[];
  created_after?: string;
  created_before?: string;
  search?: string;
  tags?: string[];
}

export interface TicketSortOptions {
  field: 'created_at' | 'updated_at' | 'priority' | 'status' | 'number';
  direction: 'asc' | 'desc';
}
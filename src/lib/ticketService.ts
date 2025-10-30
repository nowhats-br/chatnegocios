import { supabase } from './supabase';
import { Ticket, TicketStatus, TicketPriority, TicketCategory, TicketActivity, TicketStats } from '@/types/ticket';
import { Conversation, Message } from '@/types/database';

class TicketService {
  private async getUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("Usuário não autenticado.");
    return session.user.id;
  }

  /**
   * Gera um número sequencial único para o ticket
   */
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .like('number', `${year}%`);
    
    const nextNumber = (count || 0) + 1;
    return `${year}${nextNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Determina a prioridade automática baseada em critérios
   */
  private determinePriority(conversation: Conversation, firstMessage?: Message): TicketPriority {
    // Lógica de prioridade automática
    const content = firstMessage?.content?.toLowerCase() || '';
    
    // Palavras-chave para prioridade urgente
    const urgentKeywords = ['urgente', 'emergência', 'problema grave', 'não funciona', 'erro crítico'];
    if (urgentKeywords.some(keyword => content.includes(keyword))) {
      return 'urgent';
    }
    
    // Palavras-chave para prioridade alta
    const highKeywords = ['importante', 'rápido', 'preciso', 'ajuda', 'problema'];
    if (highKeywords.some(keyword => content.includes(keyword))) {
      return 'high';
    }
    
    // Horário fora do expediente = prioridade baixa
    const now = new Date();
    const hour = now.getHours();
    if (hour < 8 || hour > 18) {
      return 'low';
    }
    
    return 'normal';
  }

  /**
   * Determina a categoria automática baseada no conteúdo
   */
  private determineCategory(firstMessage?: Message): TicketCategory {
    const content = firstMessage?.content?.toLowerCase() || '';
    
    // Palavras-chave para vendas
    const salesKeywords = ['comprar', 'preço', 'valor', 'produto', 'venda', 'orçamento'];
    if (salesKeywords.some(keyword => content.includes(keyword))) {
      return 'sales';
    }
    
    // Palavras-chave para cobrança
    const billingKeywords = ['pagamento', 'fatura', 'cobrança', 'boleto', 'pagar'];
    if (billingKeywords.some(keyword => content.includes(keyword))) {
      return 'billing';
    }
    
    // Palavras-chave para técnico
    const technicalKeywords = ['não funciona', 'erro', 'bug', 'problema técnico', 'falha'];
    if (technicalKeywords.some(keyword => content.includes(keyword))) {
      return 'technical';
    }
    
    return 'support';
  }

  /**
   * Gera um assunto automático baseado na primeira mensagem
   */
  private generateSubject(firstMessage?: Message, contactName?: string): string {
    if (!firstMessage?.content) {
      return `Novo contato de ${contactName || 'cliente'}`;
    }
    
    const content = firstMessage.content;
    
    // Se a mensagem é curta, usar ela como assunto
    if (content.length <= 50) {
      return content;
    }
    
    // Extrair as primeiras palavras significativas
    const words = content.split(' ').filter(word => word.length > 2);
    const subject = words.slice(0, 8).join(' ');
    
    return subject.length > 50 ? subject.substring(0, 47) + '...' : subject;
  }

  /**
   * Cria um ticket automaticamente quando uma nova conversa é iniciada
   */
  async createTicketFromConversation(
    conversation: Conversation, 
    firstMessage?: Message
  ): Promise<Ticket> {
    const userId = await this.getUserId();
    const ticketNumber = await this.generateTicketNumber();
    
    const priority = this.determinePriority(conversation, firstMessage);
    const category = this.determineCategory(firstMessage);
    const subject = this.generateSubject(firstMessage, conversation.contacts?.name || undefined);
    
    // Calcular SLA baseado na prioridade
    const slaHours = {
      urgent: 1,
      high: 4,
      normal: 24,
      low: 72
    };
    
    const slaDueAt = new Date();
    slaDueAt.setHours(slaDueAt.getHours() + slaHours[priority]);
    
    const ticketData = {
      number: ticketNumber,
      user_id: userId,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      subject,
      description: firstMessage?.content || null,
      status: 'new' as TicketStatus,
      priority,
      category,
      sla_due_at: slaDueAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select(`
        *,
        contact:contacts!tickets_contact_id_fkey (
          id,
          name,
          phone_number,
          avatar_url
        ),
        conversation:conversations!tickets_conversation_id_fkey (
          id,
          status,
          updated_at
        )
      `)
      .single();

    if (error) {
      console.error('Erro ao criar ticket:', error);
      throw new Error(`Erro ao criar ticket: ${error.message}`);
    }

    // Registrar atividade de criação
    await this.addActivity(ticket.id, userId, 'created', `Ticket criado automaticamente a partir da conversa`);

    console.log(`[TicketService] Ticket ${ticketNumber} criado automaticamente:`, {
      ticketId: ticket.id,
      conversationId: conversation.id,
      priority,
      category,
      subject
    });

    return ticket as Ticket;
  }

  /**
   * Atualiza o status de um ticket
   */
  async updateTicketStatus(ticketId: string, newStatus: TicketStatus, userId?: string): Promise<void> {
    if (!userId) {
      userId = await this.getUserId();
    }

    const now = new Date().toISOString();
    const updateData: any = {
      status: newStatus,
      updated_at: now
    };

    // Definir timestamps específicos baseado no status
    if (newStatus === 'resolved') {
      updateData.resolved_at = now;
    } else if (newStatus === 'closed') {
      updateData.closed_at = now;
    }

    const { error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId);

    if (error) {
      throw new Error(`Erro ao atualizar status do ticket: ${error.message}`);
    }

    // Registrar atividade
    await this.addActivity(ticketId, userId, 'status_changed', `Status alterado para ${newStatus}`);
  }

  /**
   * Atribui um ticket a um agente
   */
  async assignTicket(ticketId: string, agentId: string, assignedBy?: string): Promise<void> {
    if (!assignedBy) {
      assignedBy = await this.getUserId();
    }

    const { error } = await supabase
      .from('tickets')
      .update({
        assigned_to: agentId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (error) {
      throw new Error(`Erro ao atribuir ticket: ${error.message}`);
    }

    // Registrar atividade
    await this.addActivity(ticketId, assignedBy, 'assigned', `Ticket atribuído ao agente`);
  }

  /**
   * Adiciona uma atividade ao histórico do ticket
   */
  async addActivity(
    ticketId: string, 
    userId: string, 
    action: TicketActivity['action'], 
    description: string,
    oldValue?: string,
    newValue?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('ticket_activities')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        action,
        description,
        old_value: oldValue,
        new_value: newValue,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Erro ao registrar atividade do ticket:', error);
    }
  }

  /**
   * Busca tickets com filtros e paginação
   */
  async getTickets(
    filters?: {
      status?: TicketStatus[];
      priority?: TicketPriority[];
      assigned_to?: string;
      search?: string;
    },
    page = 1,
    limit = 50
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const userId = await this.getUserId();
    
    let query = supabase
      .from('tickets')
      .select(`
        *,
        contact:contacts!tickets_contact_id_fkey (
          id,
          name,
          phone_number,
          avatar_url
        ),
        conversation:conversations!tickets_conversation_id_fkey (
          id,
          status,
          updated_at
        ),
        assigned_agent:profiles!tickets_assigned_to_fkey (
          id,
          name,
          email
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority);
    }

    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters?.search) {
      query = query.or(`subject.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    // Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: tickets, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar tickets: ${error.message}`);
    }

    return {
      tickets: tickets as Ticket[],
      total: count || 0
    };
  }

  /**
   * Busca um ticket específico com todos os detalhes
   */
  async getTicketById(ticketId: string): Promise<Ticket | null> {
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        contact:contacts!tickets_contact_id_fkey (
          id,
          name,
          phone_number,
          avatar_url
        ),
        conversation:conversations!tickets_conversation_id_fkey (
          id,
          status,
          updated_at
        ),
        assigned_agent:profiles!tickets_assigned_to_fkey (
          id,
          name,
          email
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar ticket: ${error.message}`);
    }

    return ticket as Ticket;
  }

  /**
   * Obtém estatísticas dos tickets
   */
  async getTicketStats(): Promise<TicketStats> {
    const userId = await this.getUserId();

    const { data: stats, error } = await supabase
      .from('tickets')
      .select('status, priority, category, response_time, resolution_time, sla_breached')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    const result: TicketStats = {
      total: stats.length,
      new: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
      low_priority: 0,
      normal_priority: 0,
      high_priority: 0,
      urgent_priority: 0,
      avg_response_time: 0,
      avg_resolution_time: 0,
      sla_breached: 0,
      support: 0,
      sales: 0,
      billing: 0,
      technical: 0,
      other: 0
    };

    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseTimeCount = 0;
    let resolutionTimeCount = 0;

    stats.forEach(ticket => {
      // Contar por status
      result[ticket.status as keyof Pick<TicketStats, 'new' | 'open' | 'pending' | 'resolved' | 'closed'>]++;
      
      // Contar por prioridade
      result[`${ticket.priority}_priority` as keyof TicketStats]++;
      
      // Contar por categoria
      result[ticket.category as keyof Pick<TicketStats, 'support' | 'sales' | 'billing' | 'technical' | 'other'>]++;
      
      // SLA
      if (ticket.sla_breached) {
        result.sla_breached++;
      }
      
      // Tempos médios
      if (ticket.response_time) {
        totalResponseTime += ticket.response_time;
        responseTimeCount++;
      }
      
      if (ticket.resolution_time) {
        totalResolutionTime += ticket.resolution_time;
        resolutionTimeCount++;
      }
    });

    result.avg_response_time = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    result.avg_resolution_time = resolutionTimeCount > 0 ? totalResolutionTime / resolutionTimeCount : 0;

    return result;
  }

  /**
   * Atualiza métricas de tempo do ticket quando há primeira resposta
   */
  async updateFirstResponseTime(ticketId: string): Promise<void> {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('created_at, first_response_at')
      .eq('id', ticketId)
      .single();

    if (!ticket || ticket.first_response_at) return;

    const createdAt = new Date(ticket.created_at);
    const now = new Date();
    const responseTime = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60)); // em minutos

    await supabase
      .from('tickets')
      .update({
        first_response_at: now.toISOString(),
        response_time: responseTime,
        updated_at: now.toISOString()
      })
      .eq('id', ticketId);
  }

  /**
   * Atualiza métricas de tempo de resolução
   */
  async updateResolutionTime(ticketId: string): Promise<void> {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('created_at, resolved_at')
      .eq('id', ticketId)
      .single();

    if (!ticket || !ticket.resolved_at) return;

    const createdAt = new Date(ticket.created_at);
    const resolvedAt = new Date(ticket.resolved_at);
    const resolutionTime = Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60)); // em minutos

    await supabase
      .from('tickets')
      .update({
        resolution_time: resolutionTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);
  }
}

export const ticketService = new TicketService();
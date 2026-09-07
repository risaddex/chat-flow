export interface AiConfig {
  enabled: boolean;
  persona_name: string;
  system_prompt: string;
  fallback_message: string;
  handoff_keywords: string[];
  context_window?: number;
}

export interface Business {
  id: string;
  name: string;
  whatsapp_phone_number_id: string | null;
  ai_config: AiConfig | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  business_id: string;
  wa_id: string;
  customer_name: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  ai_active: boolean;
  human_active: boolean;
  unread_count: number;
  last_message_at: string;
  last_message_text: string | null;
  last_message_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReactionEvent {
  id: string;
  message_id: string;
  reaction_emoji: string;
  occurred_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direction: 'inbound' | 'outbound';
  type: string;
  content: string;
  media_path: string | null;
  media_mime_type: string | null;
  status: 'processing' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_by: 'ai' | 'human' | null;
  agent_id: string | null;
  agent_name: string | null;
  is_note: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  reactions?: ReactionEvent[];
}

export interface Agent {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  is_online: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  business_id: string;
  wa_id: string;
  name: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  notes: string | null;
  tags: string[];
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  conversation_id: string;
  business_id: string;
  subject: string;
  description: string | null;
  source: 'ai' | 'manual';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_agent_id: string | null;
  ai_suggestion_1: string | null;
  ai_suggestion_2: string | null;
  ai_suggestion_3: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  conversations?: Pick<Conversation, 'customer_name' | 'wa_id'> | null;
  agents?: Pick<Agent, 'name' | 'email'> | null;
}

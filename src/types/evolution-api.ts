export interface EvolutionWebhookConfig {
  url?: string;
  enabled?: boolean;
  events?: string[];
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
}

export interface EvolutionInstanceCreateRequest {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  integration?: string;
  webhook?: EvolutionWebhookConfig;
  number?: string;
}

export interface EvolutionInstanceCreateResponse {
  instance?: unknown;
  message?: string;
  status?: string;
}

export const STATUS_MAPPING = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  WAITING_QR_CODE: 'connecting',
  INITIALIZING: 'initializing',
  PAUSED: 'paused',
} as const;

export const STATUS_CONFIG = {
  connected: {
    text: 'Conectado',
    bgColor: 'bg-green-100',
    color: 'text-green-700',
    action: null as string | null,
  },
  disconnected: {
    text: 'Desconectado',
    bgColor: 'bg-red-100',
    color: 'text-red-700',
    action: 'Conectar',
  },
  connecting: {
    text: 'Conectando',
    bgColor: 'bg-yellow-100',
    color: 'text-yellow-700',
    action: 'Aguardar QR',
  },
  initializing: {
    text: 'Inicializando',
    bgColor: 'bg-blue-100',
    color: 'text-blue-700',
    action: 'Aguardando',
  },
  paused: {
    text: 'Pausado',
    bgColor: 'bg-gray-200',
    color: 'text-gray-800',
    action: 'Retomar',
  },
} as const;
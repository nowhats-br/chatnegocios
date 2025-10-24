import { LucideIcon, CheckCircle, PowerOff, Loader2, PauseCircle } from 'lucide-react';

export interface EvolutionWebhookConfig {
  url?: string;
  // Compatibilidade com diferentes variantes de payload
  byEvents?: boolean;
  base64?: boolean;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[];
  headers?: Record<string, string>;
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

type UiStatus = 'connected' | 'disconnected' | 'connecting' | 'initializing' | 'paused';

export const STATUS_CONFIG: Record<UiStatus, {
  text: string;
  bgColor: string;
  color: string;
  icon: LucideIcon;
}> = {
  connected: {
    text: 'Conectado',
    bgColor: 'bg-green-100 dark:bg-green-500/10',
    color: 'text-green-700 dark:text-green-400',
    icon: CheckCircle,
  },
  disconnected: {
    text: 'Desconectado',
    bgColor: 'bg-red-100 dark:bg-red-500/10',
    color: 'text-red-700 dark:text-red-400',
    icon: PowerOff,
  },
  connecting: {
    text: 'Conectando',
    bgColor: 'bg-yellow-100 dark:bg-yellow-500/10',
    color: 'text-yellow-700 dark:text-yellow-400',
    icon: Loader2,
  },
  initializing: {
    text: 'Inicializando',
    bgColor: 'bg-blue-100 dark:bg-blue-500/10',
    color: 'text-blue-700 dark:text-blue-400',
    icon: Loader2,
  },
  paused: {
    text: 'Pausado',
    bgColor: 'bg-gray-200 dark:bg-gray-500/10',
    color: 'text-gray-800 dark:text-gray-400',
    icon: PauseCircle,
  },
};

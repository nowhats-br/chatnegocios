/**
 * Types for Evolution API responses and requests
 */

export interface EvolutionInstanceCreateRequest {
  instanceName: string;
  qrcode?: boolean;
  integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS';
  token?: string;
  number?: string;
  businessId?: string;
  webhook?: {
    url: string;
    enabled: boolean;
    events: string[];
  };
}

export interface EvolutionInstanceCreateResponse {
  instance: {
    instanceName: string;
    status: EvolutionInstanceStatus;
  };
  hash: {
    apikey: string;
  };
  webhook?: {
    url: string;
    enabled: boolean;
  };
}

export interface EvolutionInstanceConnectResponse {
  pairingCode?: string;
  code?: string; // QR Code base64
  count?: number;
  base64?: string; // Alternative QR Code field
}

export interface EvolutionInstanceStatusResponse {
  instance: {
    instanceName: string;
    status: EvolutionInstanceStatus;
  };
  connectionStatus?: {
    state: 'open' | 'close' | 'connecting';
    statusReason?: number;
  };
}

export type EvolutionInstanceStatus = 
  | 'CREATED'
  | 'INITIALIZING' 
  | 'DISCONNECTED'
  | 'WAITING_QR_CODE'
  | 'CONNECTED'
  | 'CONNECTING'
  | 'OPEN'
  | 'CLOSE';

export interface EvolutionApiError {
  message: string;
  error?: string;
  statusCode?: number;
}

export interface EvolutionDeleteInstanceResponse {
  status: 'SUCCESS' | 'ERROR';
  message: string;
}

// Mapping between Evolution API status and our internal status
export const STATUS_MAPPING: Record<EvolutionInstanceStatus, string> = {
  'CREATED': 'disconnected',
  'INITIALIZING': 'connecting',
  'DISCONNECTED': 'disconnected',
  'WAITING_QR_CODE': 'connecting',
  'CONNECTED': 'connected',
  'CONNECTING': 'connecting',
  'OPEN': 'connected',
  'CLOSE': 'disconnected',
};

// Status configuration for UI display
export const STATUS_CONFIG = {
  disconnected: { 
    text: 'Desconectado', 
    action: 'Conectar',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  connecting: { 
    text: 'Conectando...', 
    action: null,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  connected: { 
    text: 'Conectado', 
    action: 'Desconectar',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
};
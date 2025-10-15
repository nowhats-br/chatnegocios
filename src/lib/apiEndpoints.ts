/**
 * Centralized API endpoints for the Evolution API.
 */
const createWithEnv = (envKey: string, defaultPath: string) => {
  const custom = (import.meta as any).env?.[envKey];
  return String(custom || defaultPath);
};

const withInstance = (envKey: string, defaultTemplate: string, instanceName: string) => {
  const custom = (import.meta as any).env?.[envKey];
  const template = String(custom || defaultTemplate);
  return template.replace('{instanceName}', instanceName);
};

export const API_ENDPOINTS = {
  // Endpoint to create a new instance (allow override via env)
  INSTANCE_CREATE: createWithEnv('VITE_EVOLUTION_INSTANCE_CREATE_ENDPOINT', '/instance/create'),

  // Endpoint to connect an instance
  INSTANCE_CONNECT: (instanceName: string) => withInstance('VITE_EVOLUTION_INSTANCE_CONNECT_ENDPOINT', '/instance/connect/{instanceName}', instanceName),
  
  // Endpoint to fetch QR code
  INSTANCE_QR_CODE: (instanceName: string) => withInstance('VITE_EVOLUTION_INSTANCE_QR_ENDPOINT', '/instance/qrCode/{instanceName}', instanceName),

  // Endpoint to get status
  INSTANCE_STATUS: (instanceName: string) => withInstance('VITE_EVOLUTION_INSTANCE_STATUS_ENDPOINT', '/instance/fetchInstances/{instanceName}', instanceName),

  // Endpoint to delete instance
  INSTANCE_DELETE: (instanceName: string) => withInstance('VITE_EVOLUTION_INSTANCE_DELETE_ENDPOINT', '/instance/delete/{instanceName}', instanceName),

  // Send text
  SEND_TEXT: (instanceName: string) => withInstance('VITE_EVOLUTION_SEND_TEXT_ENDPOINT', '/message/sendText/{instanceName}', instanceName),
  
  // Send media
  SEND_MEDIA: (instanceName: string) => withInstance('VITE_EVOLUTION_SEND_MEDIA_ENDPOINT', '/message/sendMedia/{instanceName}', instanceName),
};

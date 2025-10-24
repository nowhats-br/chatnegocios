/**
 * Centralized API endpoints for the Evolution API.
 */
export const API_ENDPOINTS = {
  /**
   * Endpoint to create a new instance.
   */
  INSTANCE_CREATE: '/instance/create',

  /**
   * Endpoint to get the connection status for a specific instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_CONNECT: (instanceName: string) => `/instance/connect/${instanceName}`,
  
  /**
   * Endpoint to get the QR code for a specific instance (fallback reuses connect).
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_QR_CODE: (instanceName: string) => `/instance/connect/${instanceName}`,

  /**
   * Endpoint to get instance status and information.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_STATUS: (instanceName: string) => `/instance/connectionState/${instanceName}`,

  /**
   * Endpoint to delete a specific instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_DELETE: (instanceName: string) => `/instance/delete/${instanceName}`,

  /**
   * Endpoint to logout (disconnect) an instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_LOGOUT: (instanceName: string) => `/instance/logout/${instanceName}`,

  /**
   * Endpoint to pause an instance's connection.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_PAUSE: (instanceName: string) => `/instance/pause/${instanceName}`,

  /**
   * Endpoint to set webhook configuration for an instance.
   */
  WEBHOOK_SET: (instanceName: string) => `/webhook/set/${instanceName}`,

  /**
   * Endpoint to get current webhook configuration.
   */
  WEBHOOK_FIND: (instanceName: string) => `/webhook/find/${instanceName}`,

  /**
   * Endpoint to set instance settings (v1 Settings Set).
   */
  SETTINGS_SET: (instanceName: string) => `/settings/set/${instanceName}`,
};

/**
 * Endpoint for sending a text message.
 * @param instanceName The name of the WhatsApp instance.
 */
export const SEND_TEXT = (instanceName: string) => `/message/sendText/${instanceName}`;

/**
 * Endpoint for sending a media file.
 * @param instanceName The name of the WhatsApp instance.
 */
export const SEND_MEDIA = (instanceName: string) => `/message/sendMedia/${instanceName}`;

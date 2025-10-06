/**
 * Centralized API endpoints for the Evolution API.
 */
export const API_ENDPOINTS = {
  /**
   * Endpoint to create a new instance.
   */
  INSTANCE_CREATE: '/instance/create',

  /**
   * Endpoint to connect and get QR code for a specific instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_CONNECT: (instanceName: string) => `/instance/connect/${instanceName}`,
  
  /**
   * Endpoint to get the QR code for a specific instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_QR_CODE: (instanceName: string) => `/instance/qrCode/${instanceName}`,

  /**
   * Endpoint to get instance status and information.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_STATUS: (instanceName: string) => `/instance/fetchInstances/${instanceName}`,

  /**
   * Endpoint to delete a specific instance.
   * @param instanceName The name of the WhatsApp instance.
   */
  INSTANCE_DELETE: (instanceName: string) => `/instance/delete/${instanceName}`,

  /**
   * Endpoint for sending a text message.
   * @param instanceName The name of the WhatsApp instance.
   */
  SEND_TEXT: (instanceName: string) => `/message/sendText/${instanceName}`,
  
  /**
   * Endpoint for sending a media file.
   * @param instanceName The name of the WhatsApp instance.
   */
  SEND_MEDIA: (instanceName: string) => `/message/sendMedia/${instanceName}`,
};

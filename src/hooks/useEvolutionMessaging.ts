import { useEvolutionApi } from '@/hooks/useEvolutionApi';

export type SendTextResult = { ok: boolean; endpoint?: string; payloadVariant?: string; error?: string };
export type SendMediaResult = { ok: boolean; endpoint?: string; payloadVariant?: string; error?: string };

interface MediaOptions {
  mediatype: 'image' | 'document' | 'audio' | 'video';
  caption?: string;
  fileName?: string;
}

/**
 * Hook que centraliza envio de mensagens via Evolution API com fallbacks
 * - Aplica headers adicionais (X-API-Key, Authorization)
 * - Tenta múltiplos endpoints e variações de payload, suprimindo toasts nativos
 */
export function useEvolutionMessaging() {
  const { request } = useEvolutionApi();

  const sendText = async (
    instanceName: string,
    to: string,
    content: string
  ): Promise<SendTextResult> => {
    const endpoints = [
      `/message/sendText/${instanceName}`,
      `/message/text/${instanceName}`,
      `/messages/sendText/${instanceName}`,
      `/message/send-message/${instanceName}`,
    ];

    const payloads: Array<{ variant: string; body: any }> = [
      { variant: 'textMessage', body: { number: to, textMessage: { text: content } } },
      { variant: 'flat-to-text', body: { to, text: content } },
      { variant: 'flat-number-text', body: { number: to, text: content } },
    ];

    for (const ep of endpoints) {
      for (const p of payloads) {
        try {
          const res = await request<any>(ep, {
            method: 'POST',
            body: JSON.stringify(p.body),
            suppressToast: true,
            suppressInfoToast: true,
          });
          if (res) {
            return { ok: true, endpoint: ep, payloadVariant: p.variant };
          }
        } catch (err: any) {
          // segue para próximo payload/endpoint
        }
      }
    }
    return { ok: false, error: 'Falha em todos os endpoints/payloads para envio de texto.' };
  };

  const sendMedia = async (
    instanceName: string,
    to: string,
    mediaDataUrlOrBase64: string,
    options: MediaOptions
  ): Promise<SendMediaResult> => {
    const endpoints = [
      `/message/sendMedia/${instanceName}`,
      `/message/media/${instanceName}`,
      `/message/sendFile/${instanceName}`,
    ];

    const fileName = options.fileName || 'arquivo';
    const caption = options.caption || '';

    const payloads: Array<{ variant: string; body: any }> = [
      { variant: 'mediaMessage', body: { number: to, mediaMessage: { mediatype: options.mediatype, media: mediaDataUrlOrBase64, caption, fileName } } },
      { variant: 'flat-media', body: { to, mediatype: options.mediatype, media: mediaDataUrlOrBase64, caption, fileName } },
      { variant: 'file-field', body: { to, file: mediaDataUrlOrBase64, filename: fileName, caption } },
    ];

    for (const ep of endpoints) {
      for (const p of payloads) {
        try {
          const res = await request<any>(ep, {
            method: 'POST',
            body: JSON.stringify(p.body),
            suppressToast: true,
            suppressInfoToast: true,
          });
          if (res) {
            return { ok: true, endpoint: ep, payloadVariant: p.variant };
          }
        } catch (err: any) {
          // segue para próximo payload/endpoint
        }
      }
    }
    return { ok: false, error: 'Falha em todos os endpoints/payloads para envio de mídia.' };
  };

  return { sendText, sendMedia };
}
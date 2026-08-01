import { CommunicationEvent, CommunicationLog } from '../types';

export interface PublishEventPayload {
  church_id?: string;
  contributor_id?: string;
  contributor_name?: string;
  contributor_phone?: string;
  reference_id?: string;
  amount?: number;
  description?: string;
  payment_method?: string;
  contribution_type?: string;
  payload?: Record<string, any>;
  user_id?: string;
}

export const CommunicationEventService = {
  /**
   * Publica um evento oficial na Central de Comunicação (desacoplado do fluxo financeiro).
   * Nunca lança exceção para não interromper a operação chamadora.
   */
  async publish(
    eventType: 'ContributionConfirmed' | string,
    data: PublishEventPayload
  ): Promise<CommunicationEvent | null> {
    try {
      const churchId = data.church_id || '00000000-0000-0000-0000-000000000001';
      const hasChurch = !!data.church_id;
      const hasContributor = !!data.contributor_id;
      const hasPhone = !!data.contributor_phone;

      const payload = {
        amount: data.amount || 0,
        description: data.description || 'Contribuição Confirmada',
        contributor_id: data.contributor_id || null,
        contributor_name: data.contributor_name || 'Contribuinte Não Identificado',
        contributor_phone: data.contributor_phone || null,
        payment_method: data.payment_method || 'Pix',
        contribution_type: data.contribution_type || 'Dízimo/Oferta',
        has_church: hasChurch,
        has_contributor: hasContributor,
        has_phone: hasPhone,
        timestamp: new Date().toISOString(),
        ...(data.payload || {})
      };

      const res = await fetch('/api/v1/communication_events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          church_id: churchId,
          contributor_id: data.contributor_id || null,
          reference_id: data.reference_id || null,
          payload,
          status: 'PENDING',
          user_id: data.user_id || null
        })
      });

      if (!res.ok) {
        console.warn('[CommunicationEventService] Resposta não-OK ao publicar evento:', res.statusText);
        return null;
      }

      const event: CommunicationEvent = await res.json();
      console.log(`[CommunicationEventService] Evento ${eventType} publicado com sucesso ID:`, event.id);
      return event;
    } catch (err) {
      console.error('[CommunicationEventService] Exceção ao publicar evento (efeito colateral mantido limpo):', err);
      return null;
    }
  },

  /**
   * Busca lista de eventos registrados.
   */
  async getEvents(params?: { church_id?: string; status?: string; event_type?: string }): Promise<CommunicationEvent[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.church_id) queryParams.append('church_id', params.church_id);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.event_type) queryParams.append('event_type', params.event_type);

      const url = `/api/v1/communication_events?${queryParams.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error('[CommunicationEventService] Erro ao buscar eventos:', err);
      return [];
    }
  },

  /**
   * Busca logs de comunicação da central.
   */
  async getLogs(params?: { church_id?: string; status?: string; event_type?: string }): Promise<CommunicationLog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.church_id) queryParams.append('church_id', params.church_id);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.event_type) queryParams.append('event_type', params.event_type);

      const url = `/api/v1/communication_logs?${queryParams.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error('[CommunicationEventService] Erro ao buscar logs:', err);
      return [];
    }
  }
};

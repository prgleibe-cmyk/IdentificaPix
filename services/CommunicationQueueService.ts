import { CommunicationQueueItem } from '../types';

export const CommunicationQueueService = {
  /**
   * Busca os itens da fila de comunicação.
   */
  async getQueue(params?: { church_id?: string; status?: string }): Promise<CommunicationQueueItem[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.church_id) queryParams.append('church_id', params.church_id);
      if (params?.status) queryParams.append('status', params.status);

      const url = `/api/v1/communication_queue?${queryParams.toString()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      console.error('[CommunicationQueueService] Erro ao buscar fila:', err);
      return [];
    }
  },

  /**
   * Força o processamento imediato dos eventos pendentes e da fila.
   */
  async triggerProcessing(churchId?: string): Promise<{ processed_events: number; queued_items: number } | null> {
    try {
      const res = await fetch('/api/v1/communication_queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ church_id: churchId })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[CommunicationQueueService] Erro ao disparar processador:', err);
      return null;
    }
  },

  /**
   * Solicita o reprocessamento de um item da fila.
   */
  async retryItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/communication_queue/${id}/retry`, {
        method: 'POST'
      });
      return res.ok;
    } catch (err) {
      console.error('[CommunicationQueueService] Erro ao tentar reprocessar item da fila:', err);
      return false;
    }
  }
};

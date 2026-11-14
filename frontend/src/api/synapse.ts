import { axiosClient } from './client';
import type { SynapseEvent, SynapseFilters, SynapseMix, SynapseStatus } from '@/types/synapse';

export const synapseApi = {
  async getMix(filters: SynapseFilters, limit = 20, excludeIds: string[] = []) {
    const { data } = excludeIds.length
      ? await axiosClient.post<SynapseMix>('/synapse/mix', {
        familiarity: filters.familiarity, mood: filters.mood, limit, exclude_track_ids: excludeIds
      })
      : await axiosClient.get<SynapseMix>('/synapse/mix', {
        params: { familiarity: filters.familiarity.join(','), mood: filters.mood || undefined, limit }
      });
    return data;
  },
  async refill(sessionId: string, limit: number, excludeIds: string[]) {
    const { data } = await axiosClient.post<SynapseMix>(`/synapse/sessions/${sessionId}/refill`, {
      limit, exclude_track_ids: excludeIds
    });
    return data;
  },
  async status() {
    return (await axiosClient.get<SynapseStatus>('/synapse/status')).data;
  },
  async reset() {
    await axiosClient.delete('/synapse/profile');
  },
  async events(events: SynapseEvent[]) {
    await axiosClient.post('/synapse/events', { events });
  }
};

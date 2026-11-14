import { useQuery } from '@tanstack/react-query';
import { synapseApi } from '@/api/synapse';
import { useSynapseStore } from '@/store/synapseStore';
import { useSessionStore } from '@/store/sessionStore';

export function useSynapseMix() {
  const filters = useSynapseStore(state => state.filters);
  const profileVersion = useSynapseStore(state => state.profileVersion);
  const resetting = useSynapseStore(state => state.profileResetting);
  const userId = useSessionStore(state => state.user?.id);
  return useQuery({
    queryKey: ['synapse', userId, 'mix', filters, profileVersion],
    queryFn: () => synapseApi.getMix(filters),
    enabled: !!userId && !resetting && filters.familiarity.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.status === 'syncing' ? 10_000 : false
  });
}

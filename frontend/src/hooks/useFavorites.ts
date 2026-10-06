import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';

export function useFavoriteIds() {
  return useQuery({
    queryKey: ['favorites', 'ids'],
    queryFn: () => api.library.getFavoriteIds(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useFavoriteTracks() {
  return useQuery({
    queryKey: ['favorites', 'tracks'],
    queryFn: () => api.library.getFavoriteTracks(),
  });
}

export function useFavoriteAlbums() {
  return useQuery({
    queryKey: ['favorites', 'albums'],
    queryFn: () => api.library.getFavoriteAlbums(),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'track' | 'album' }) =>
      api.library.toggleFavorite(id, type),
    onMutate: async ({ id, type }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', 'ids'] });
      const prevIds = queryClient.getQueryData<{ tracks: string[]; albums: string[] }>(['favorites', 'ids']);

      if (prevIds) {
        const key = type === 'track' ? 'tracks' : 'albums';
        const exists = prevIds[key].includes(id);
        const updated = exists
          ? prevIds[key].filter((itemId) => itemId !== id)
          : [...prevIds[key], id];

        queryClient.setQueryData(['favorites', 'ids'], {
          ...prevIds,
          [key]: updated,
        });
      }

      return { prevIds };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevIds) {
        queryClient.setQueryData(['favorites', 'ids'], context.prevIds);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

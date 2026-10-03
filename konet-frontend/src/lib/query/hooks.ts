"use client";
import { authenticationCommands } from "@/lib/auth/commands";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { command, query } from "@/data/access/client";
import type {
  CommandInput,
  CommandName,
  QueryInput,
  QueryName,
  QueryResult,
} from "@/data/access/contracts";
export const dataKey = <K extends QueryName>(name: K, input: QueryInput<K>) =>
  ["konet", name, input] as const;
export function useDataQuery<K extends QueryName>(
  name: K,
  input: QueryInput<K>,
  initialData?: QueryResult<K>,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: dataKey(name, input),
    queryFn: ({ signal }) => query(name, input, signal),
    initialData,
    ...options,
  });
}
export function useDataCommand<K extends CommandName>(name: K) {
  const cache = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: CommandInput<K>) => command(name, input),
    onSuccess: async () => {
      if (authenticationCommands.includes(name)) {
        cache.clear();
        router.refresh();
        return;
      }
      await cache.invalidateQueries({ queryKey: ["konet"] });
      router.refresh();
    },
  });
}

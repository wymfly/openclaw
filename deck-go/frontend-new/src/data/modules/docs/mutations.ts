import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDoc, extractDocs } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { docsKeys } from "./keys";

export function useExtractDocsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (sessionKey: string) => extractDocs(sessionKey),
    onSuccess: async () => {
      await invalidateModule(queryClient, docsKeys.all());
    },
  });
}

export function useDeleteDocMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (docId: string) => deleteDoc(docId),
    onSuccess: async (_response, docId) => {
      queryClient.removeQueries({ queryKey: docsKeys.detail(docId) });
      await invalidateModule(queryClient, docsKeys.all());
    },
  });
}

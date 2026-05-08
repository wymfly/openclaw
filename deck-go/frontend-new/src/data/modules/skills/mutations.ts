import { useMutation, useQueryClient } from "@tanstack/react-query";
import { installSkill, installSkillHub, updateSkill, updateSkillHub } from "@/api";
import { invalidateModule, mutationDefaults } from "../shared";
import { skillsKeys } from "./keys";

export function useUpdateSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      patch,
      skillKey,
    }: {
      patch: { apiKey?: string; enabled?: boolean; env?: Record<string, string> };
      skillKey: string;
    }) => updateSkill(skillKey, patch),
    onSuccess: async () => {
      await invalidateModule(queryClient, skillsKeys.all());
    },
  });
}

export function useInstallSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ installId, name }: { installId: string; name: string }) =>
      installSkill(name, installId),
    onSuccess: async () => {
      await invalidateModule(queryClient, skillsKeys.all());
    },
  });
}

export function useInstallSkillHubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ slug, version }: { slug: string; version?: string }) =>
      version ? installSkillHub(slug, version) : installSkillHub(slug),
    onSuccess: async () => {
      await invalidateModule(queryClient, skillsKeys.all());
    },
  });
}

export function useUpdateSkillHubMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (slug?: string) => (slug ? updateSkillHub(slug) : updateSkillHub()),
    onSuccess: async () => {
      await invalidateModule(queryClient, skillsKeys.all());
    },
  });
}

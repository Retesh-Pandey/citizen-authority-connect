import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getPhotoUrls } from "./issues.functions";

export type IssueRow = Database["public"]["Tables"]["issues"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not signed in");
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const role = roles?.some((r) => r.role === "authority") ? "authority" : "citizen";
    return { id: u.user.id, email: u.user.email, profile: profile as Profile, role } as const;
  },
});

export const issuesQuery = queryOptions({
  queryKey: ["issues"],
  queryFn: async () => {
    const { data, error } = await supabase.from("issues").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    return data as IssueRow[];
  },
});

export const leaderboardQuery = (role: "citizen" | "authority") =>
  queryOptions({
    queryKey: ["leaderboard", role],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_leaderboard", { _role: role });
      return (data ?? []) as Profile[];
    },
  });

/** Keeps issues, points and leaderboards live. */
export function useLiveIssues() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("issues-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "issues" }, () => {
        qc.invalidateQueries({ queryKey: ["issues"] });
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter(Boolean) as string[])).sort();
  return useQuery({
    queryKey: ["photos", clean],
    queryFn: () => getPhotoUrls({ data: { paths: clean } }),
    staleTime: 30 * 60 * 1000,
    enabled: clean.length > 0,
  }).data ?? {};
}

export async function uploadPhoto(userId: string, blob: Blob) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("issue-photos").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Photo upload failed");
  return path;
}

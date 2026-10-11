import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { distanceKm, SPOT_RADIUS_KM } from "./locations";

const BUCKET = "issue-photos";

async function requireRole(supabase: any, userId: string, role: "citizen" | "authority") {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", role).maybeSingle();
  if (!data) throw new Error(`Only ${role} accounts can do this`);
}

async function addPoints(admin: any, userId: string, pts: number) {
  const { data } = await admin.from("profiles").select("points").eq("id", userId).single();
  await admin.from("profiles").update({ points: (data?.points ?? 0) + pts }).eq("id", userId);
}

async function signed(admin: any, path: string) {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) throw new Error("Could not read the photo");
  return data.signedUrl as string;
}

const reportInput = z.object({
  photoPath: z.string().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(500).optional(),
  country: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
});

export const reportIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRole(supabase, userId, "citizen");
    if (!data.photoPath.startsWith(`${userId}/`)) throw new Error("Invalid photo");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const ai = await import("./ai.server").then((m) =>
      m.askVisionJson<{ is_civic_issue: boolean; title: string; category: string; department: string; severity: number }>(
        `You are a municipal triage assistant. Look at this citizen photo${data.description ? ` (note: "${data.description}")` : ""}.
Return json: {"is_civic_issue": boolean, "title": short title (max 6 words), "category": one of ["Pothole","Garbage","Waterlogging","Streetlight","Broken Footpath","Sewage","Other"], "department": one of ["Roads","Sanitation","Water","Electrical"], "severity": integer 1-5 (5 = dangerous / very large)}.`,
        [await signed(admin, data.photoPath)],
      ),
    );
    if (!ai.is_civic_issue) throw new Error("AI couldn't find a civic issue in this photo. Please retake it.");
    const severity = Math.min(5, Math.max(1, Math.round(ai.severity || 2)));

    // Merge into an existing open issue of the same category within ~150m
    const { data: open } = await admin.from("issues").select("id,lat,lng,merged_count").eq("category", ai.category).neq("status", "Resolved");
    const dup = (open ?? []).find((i: any) => distanceKm(i, data) < 0.15);
    if (dup) {
      await admin.from("issues").update({ merged_count: dup.merged_count + 1 }).eq("id", dup.id);
      await addPoints(admin, userId, 5);
      return { merged: true, id: dup.id, title: ai.title, department: ai.department, severity, points: 5 };
    }
    const { data: row, error } = await admin
      .from("issues")
      .insert({
        reporter_id: userId, title: ai.title, description: data.description, category: ai.category,
        department: ai.department, severity, lat: data.lat, lng: data.lng, photo_url: data.photoPath,
        country: data.country, state: data.state, district: data.district,
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not save the report");
    const points = 10 + severity * 5;
    await addPoints(admin, userId, points);
    return { merged: false, id: row.id, title: ai.title, department: ai.department, severity, points };
  });

const resolveInput = z.object({
  issueId: z.string().uuid(),
  photoPath: z.string().min(3).max(300),
  lat: z.number(),
  lng: z.number(),
});

export const resolveIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => resolveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRole(supabase, userId, "authority");
    if (!data.photoPath.startsWith(`${userId}/`)) throw new Error("Invalid photo");
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: issue } = await admin.from("issues").select("*").eq("id", data.issueId).single();
    if (!issue) throw new Error("Issue not found");
    if (issue.status === "Resolved") throw new Error("Already resolved");
    const dist = distanceKm(issue, data);
    if (dist > SPOT_RADIUS_KM) throw new Error(`You must be at the spot to verify (you are ${dist.toFixed(1)} km away)`);

    const { askVisionJson } = await import("./ai.server");
    const ai = await askVisionJson<{ same_location: boolean; resolved: boolean; reason: string }>(
      `Image 1 is a citizen's report of a "${issue.category}" issue ("${issue.title}"). Image 2 was taken later by a municipal worker at the same GPS spot.
Decide: is image 2 plausibly the same place, and has the reported problem been fixed?
Return json: {"same_location": boolean, "resolved": boolean, "reason": one short sentence}.`,
      [await signed(admin, issue.photo_url), await signed(admin, data.photoPath)],
    );
    const ok = ai.same_location && ai.resolved;
    if (!ok) {
      await admin.from("issues").update({ ai_verdict: ai.reason, resolution_photo_url: data.photoPath, status: "In Progress" }).eq("id", issue.id);
      return { resolved: false, reason: ai.reason, points: 0 };
    }
    const hours = (Date.now() - new Date(issue.created_at).getTime()) / 36e5;
    const speed = hours < 24 ? 2 : hours < 72 ? 1.5 : 1;
    const points = Math.round(issue.severity * 20 * speed + (issue.merged_count - 1) * 5);
    await admin.from("issues").update({
      status: "Resolved", resolved_at: new Date().toISOString(), resolver_id: userId,
      resolution_photo_url: data.photoPath, ai_verdict: ai.reason,
    }).eq("id", issue.id);
    await addPoints(admin, userId, points);
    return { resolved: true, reason: ai.reason, points };
  });

export const getPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paths: z.array(z.string().max(300)).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.paths.length) return {} as Record<string, string>;
    const { data: urls } = await context.supabase.storage.from(BUCKET).createSignedUrls(data.paths, 3600);
    const out: Record<string, string> = {};
    (urls ?? []).forEach((u: any) => { if (u.path && u.signedUrl) out[u.path] = u.signedUrl; });
    return out;
  });

export const getMapsKey = createServerFn({ method: "GET" }).handler(async () => ({ ok: true }));

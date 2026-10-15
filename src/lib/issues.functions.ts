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

/** Downloads the photo bytes so the AI always receives the actual image. */
async function photoBytes(admin: any, path: string) {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("Could not read the photo");
  return new Uint8Array(await (data as Blob).arrayBuffer());
}

const reportInput = z.object({
  photoPath: z.string().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(500).optional(),
  department: z.enum(["Roads", "Sanitation", "Water", "Electrical"]).optional(),
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

    const photo = await photoBytes(admin, data.photoPath);
    const { askVisionJson } = await import("./ai.server");
    const ai = await askVisionJson<{ is_civic_issue: boolean; title: string; category: string; department: string; severity: number; matches_note?: boolean; seen?: string }>(
        `You are a strict municipal triage assistant. Judge ONLY what is actually visible in the attached photo.${data.description ? ` The citizen wrote: "${data.description}" — treat this as an unverified claim; never describe things that are not visible in the photo.` : ""}
If the photo does not clearly show a public civic problem (e.g. it shows a person, a room, a screen, a blank/blurry image), set is_civic_issue to false. Also set "matches_note" to false if the citizen's note describes something not visible in the photo.

GUIDE — category/department/severity from what is visible:
- Hole or crack in tarmac, road cave-in, missing speed breaker -> Pothole, Roads. 1 = small crack, 3 = hole covering a lane part, 5 = deep/wide hole or cave-in on a busy road.
- Broken tiles, uneven or collapsed pavement/footpath -> Broken Footpath, Roads. 2 usual, 4-5 if people could fall into a gap.
- Piles of rubbish, overflowing bins, dumped waste, burnt garbage -> Garbage, Sanitation. 1 = a few bags, 3 = large pile on the street, 5 = huge heap blocking road or with animals/health hazard.
- Standing water on road, flooded street or underpass -> Waterlogging, Water. 3 = knee-deep puddle, 5 = flooded road unsafe to cross.
- Leaking/burst pipe, water gushing from the ground -> Waterlogging, Water.
- Open manhole, overflowing drain, sewage on road -> Sewage, Sanitation. Open manhole = severity 5.
- Dark/broken/fallen streetlight, leaning or fallen electric pole, hanging or exposed wires, damaged transformer -> Streetlight, Electrical. Exposed wires or fallen pole = 5; one unlit lamp = 2.
- Not civic (set is_civic_issue false): selfies, people, indoor rooms, pets, screens, food, documents, blurry/dark/blank images, a clean intact road/pole/bin.
EXAMPLES:
Photo: large water-filled crater on a road -> {"is_civic_issue":true,"title":"Deep pothole on road","category":"Pothole","department":"Roads","severity":4,"matches_note":true,"seen":"A deep water-filled hole in the tarmac."}
Photo: bent electric pole with wires hanging -> {"is_civic_issue":true,"title":"Damaged electric pole","category":"Streetlight","department":"Electrical","severity":5,"matches_note":true,"seen":"A leaning pole with loose wires."}
Photo: a person's face indoors -> {"is_civic_issue":false,"title":"","category":"Other","department":"Roads","severity":1,"matches_note":false,"seen":"A person indoors, no public problem."}
Photo: intact smooth road, note says "pothole" -> {"is_civic_issue":false,"title":"","category":"Other","department":"Roads","severity":1,"matches_note":false,"seen":"A clean road with no damage."}
Return json: {"is_civic_issue": boolean, "title": short title (max 6 words), "category": one of ["Pothole","Garbage","Waterlogging","Streetlight","Broken Footpath","Sewage","Other"], "department": one of ["Roads","Sanitation","Water","Electrical"], "severity": integer 1-5 (5 = dangerous / very large), "matches_note": boolean, "seen": one short sentence describing what is actually in the photo}.`,
        [photo],
      );
    if (!ai.is_civic_issue) throw new Error(`AI couldn't find a civic issue in this photo${ai.seen ? ` (it sees: ${ai.seen})` : ""}. Please retake it at the spot.`);
    if (data.department) ai.department = data.department;
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
        reporter_id: userId, title: ai.title, description: data.description ?? null, category: ai.category,
        department: ai.department, severity, lat: data.lat, lng: data.lng, photo_url: data.photoPath,
        country: data.country ?? null, state: data.state ?? null, district: data.district ?? null,
        reporter_points: 10 + severity * 5,
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
Be strict but fair. Rules:
- same_location is true only if landmarks match (buildings, wall, road shape, poles, trees, skyline); different street/scene -> false. Lighting, angle and time of day may differ.
- resolved is true only if the specific problem is clearly gone: pothole filled/patched, garbage removed, water drained, pole/lamp repaired or replaced, manhole covered, drain cleaned.
- resolved is false if the problem is still visible, only partly fixed, or image 2 is blurry, indoors, a person, or unrelated.
EXAMPLES:
Image1 pothole, Image2 same road smooth patch -> {"same_location":true,"resolved":true,"reason":"The pothole is filled and the road is level."}
Image1 garbage pile, Image2 same corner with garbage still there -> {"same_location":true,"resolved":false,"reason":"The garbage pile is still present."}
Image1 broken pole, Image2 a different street -> {"same_location":false,"resolved":false,"reason":"The scene does not match the reported spot."}
Image1 open drain, Image2 a selfie -> {"same_location":false,"resolved":false,"reason":"Image 2 is not a photo of the spot."}
Return json: {"same_location": boolean, "resolved": boolean, "reason": one short sentence}.`,
      [await photoBytes(admin, issue.photo_url), await photoBytes(admin, data.photoPath)],
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


/** Reporter deletes their own open, unmerged report; the points it earned are taken back. */
export const deleteMyIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: issue } = await admin.from("issues").select("*").eq("id", data.id).maybeSingle();
    if (!issue || issue.reporter_id !== userId) throw new Error("You can only delete your own report");
    if (issue.status === "Resolved" || issue.merged_count > 1) throw new Error("This report can't be deleted");
    const { error } = await admin.from("issues").delete().eq("id", data.id).eq("reporter_id", userId);
    if (error) throw new Error("Could not delete the report");
    await admin.from("notifications").delete().eq("issue_id", data.id);
    await admin.storage.from(BUCKET).remove([issue.photo_url]);
    const { data: p } = await admin.from("profiles").select("points").eq("id", userId).single();
    await admin.from("profiles").update({ points: Math.max(0, (p?.points ?? 0) - (issue.reporter_points ?? 0)) }).eq("id", userId);
    return { removedPoints: issue.reporter_points ?? 0 };
  });

/** Permanently deletes the caller's own account and their open reports. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: open } = await admin.from("issues").select("id, photo_url").eq("reporter_id", userId).neq("status", "Resolved").lte("merged_count", 1);
    if (open?.length) {
      await admin.from("issues").delete().in("id", open.map((o) => o.id));
      await admin.storage.from(BUCKET).remove(open.map((o) => o.photo_url));
    }
    await admin.from("notifications").delete().eq("user_id", userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Could not delete the account");
    return { ok: true };
  });

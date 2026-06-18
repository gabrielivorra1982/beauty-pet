/**
 * Capa de acceso a datos tipada para Kiwoko.
 * La UI NUNCA debe llamar a `supabase.from(...)` directamente — siempre
 * pasa por estas funciones para mantener tipos y desacoplar la fuente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Owner = Database["public"]["Tables"]["owners"]["Row"];
export type OwnerInsert = Database["public"]["Tables"]["owners"]["Insert"];
export type OwnerUpdate = Database["public"]["Tables"]["owners"]["Update"];

export type Pet = Database["public"]["Tables"]["pets"]["Row"];
export type PetInsert = Database["public"]["Tables"]["pets"]["Insert"];
export type PetUpdate = Database["public"]["Tables"]["pets"]["Update"];
export type PetWithOwner = Pet & { owner: Pick<Owner, "id" | "full_name"> | null };

export type Visit = Database["public"]["Tables"]["visits"]["Row"];

export type CoatType = "con_pelo" | "sin_pelo" | "desconocido";

// ---------- OWNERS ----------

export async function listOwners(search?: string): Promise<Owner[]> {
  let q = supabase.from("owners").select("*").order("full_name", { ascending: true });
  if (search && search.trim()) {
    q = q.ilike("full_name", `%${search.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getOwner(id: string): Promise<Owner | null> {
  const { data, error } = await supabase.from("owners").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOwnerWithPets(id: string): Promise<(Owner & { pets: Pet[] }) | null> {
  const { data, error } = await supabase
    .from("owners")
    .select("*, pets(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as (Owner & { pets: Pet[] }) | null) ?? null;
}

export async function createOwner(input: OwnerInsert): Promise<Owner> {
  const { data, error } = await supabase.from("owners").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateOwner(id: string, input: OwnerUpdate): Promise<Owner> {
  const { data, error } = await supabase
    .from("owners")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOwner(id: string): Promise<void> {
  const { error } = await supabase.from("owners").delete().eq("id", id);
  if (error) throw error;
}

export async function countOwners(): Promise<number> {
  const { count, error } = await supabase
    .from("owners")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// ---------- PETS ----------

export async function listPetsWithOwner(search?: string): Promise<PetWithOwner[]> {
  const term = search?.trim() ?? "";
  const { data, error } = await supabase
    .from("pets")
    .select("*, owner:owners!inner(id, full_name)")
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as PetWithOwner[];
  if (!term) return rows;
  const t = term.toLowerCase();
  return rows.filter(
    (p) => p.name.toLowerCase().includes(t) || (p.owner?.full_name ?? "").toLowerCase().includes(t),
  );
}

export async function getPetWithOwner(id: string): Promise<PetWithOwner | null> {
  const { data, error } = await supabase
    .from("pets")
    .select("*, owner:owners(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PetWithOwner | null) ?? null;
}

export async function createPet(input: PetInsert): Promise<Pet> {
  const { data, error } = await supabase.from("pets").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePet(id: string, input: PetUpdate): Promise<Pet> {
  const { data, error } = await supabase.from("pets").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

export async function countPets(): Promise<number> {
  const { count, error } = await supabase.from("pets").select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// ---------- VISITS ----------

export type CutSuggestion = Database["public"]["Tables"]["cut_suggestions"]["Row"];
export type CutSuggestionInsert = Database["public"]["Tables"]["cut_suggestions"]["Insert"];
export type VisitInsert = Database["public"]["Tables"]["visits"]["Insert"];

export type VisitWithChosen = Visit & {
  chosen_cut: Pick<CutSuggestion, "id" | "title" | "image_url"> | null;
};

export type RecentVisit = Visit & {
  pet: Pick<Pet, "id" | "name"> | null;
  chosen_cut: Pick<CutSuggestion, "id" | "title" | "image_url"> | null;
};

export async function listVisitsByPet(petId: string): Promise<VisitWithChosen[]> {
  const { data, error } = await supabase
    .from("visits")
    .select("*, chosen_cut:cut_suggestions!visits_chosen_cut_id_fkey(id, title, image_url)")
    .eq("pet_id", petId)
    .order("visited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VisitWithChosen[];
}

export async function listRecentVisits(limit = 5): Promise<RecentVisit[]> {
  const { data, error } = await supabase
    .from("visits")
    .select(
      "*, pet:pets(id, name), chosen_cut:cut_suggestions!visits_chosen_cut_id_fkey(id, title, image_url)",
    )
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentVisit[];
}

/**
 * Crea una visita completa con sus 4 sugerencias y marca la elegida.
 * No toca puntos ni recompensas (Fase 5).
 */
export async function createVisitWithSuggestions(input: {
  pet_id: string;
  staff_id: string | null;
  photo_url: string | null;
  recognized_breed: string | null;
  recognized_coat: string | null;
  suggestions: Array<{
    position: number;
    title: string;
    description: string | null;
    image_url: string | null;
    is_chosen: boolean;
  }>;
}): Promise<Visit> {
  const { data: visit, error: visitErr } = await supabase
    .from("visits")
    .insert({
      pet_id: input.pet_id,
      staff_id: input.staff_id,
      photo_url: input.photo_url,
      recognized_breed: input.recognized_breed,
      recognized_coat: input.recognized_coat,
      points_awarded: 0,
    } satisfies VisitInsert)
    .select()
    .single();
  if (visitErr || !visit) throw visitErr ?? new Error("No se pudo crear la visita.");

  const rows: CutSuggestionInsert[] = input.suggestions.map((s) => ({
    visit_id: visit.id,
    position: s.position,
    title: s.title,
    description: s.description,
    image_url: s.image_url,
    is_chosen: s.is_chosen,
  }));
  const { data: inserted, error: sugErr } = await supabase
    .from("cut_suggestions")
    .insert(rows)
    .select();
  if (sugErr) throw sugErr;

  const chosen = (inserted ?? []).find((r) => r.is_chosen);
  if (chosen) {
    const { error: updErr } = await supabase
      .from("visits")
      .update({ chosen_cut_id: chosen.id })
      .eq("id", visit.id);
    if (updErr) throw updErr;
  }
  return visit;
}

// ---------- STORAGE ----------

const PET_PHOTOS_BUCKET = "pet-photos";

/** Sube una foto de mascota al bucket privado y devuelve { path, signedUrl }. */
export async function uploadPetPhoto(
  petId: string,
  file: Blob,
): Promise<{ path: string; signedUrl: string }> {
  const ext = inferExt(file.type);
  const path = `originals/${petId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from(PET_PHOTOS_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo firmar la foto.");
  return { path, signedUrl: data.signedUrl };
}

function inferExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  return "jpg";
}

// ---------- REWARDS ----------

export type RewardRule = Database["public"]["Tables"]["reward_rules"]["Row"];
export type RewardRuleInsert = Database["public"]["Tables"]["reward_rules"]["Insert"];
export type RewardRuleUpdate = Database["public"]["Tables"]["reward_rules"]["Update"];

export type PetReward = Database["public"]["Tables"]["pet_rewards"]["Row"];
export type PetRewardWithRule = PetReward & { reward_rule: RewardRule | null };

export async function listRewardRules(): Promise<RewardRule[]> {
  const { data, error } = await supabase
    .from("reward_rules")
    .select("*")
    .order("threshold_visits", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createRewardRule(input: RewardRuleInsert): Promise<RewardRule> {
  const { data, error } = await supabase.from("reward_rules").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateRewardRule(
  id: string,
  input: RewardRuleUpdate,
): Promise<RewardRule> {
  const { data, error } = await supabase
    .from("reward_rules")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setRewardRuleActive(id: string, active: boolean): Promise<RewardRule> {
  return updateRewardRule(id, { active });
}

export async function deleteRewardRule(id: string): Promise<void> {
  const { error } = await supabase.from("reward_rules").delete().eq("id", id);
  if (error) throw error;
}

/** Lista las recompensas desbloqueadas para una mascota, con su regla, más recientes primero. */
export async function listPetRewards(petId: string): Promise<PetRewardWithRule[]> {
  const { data, error } = await supabase
    .from("pet_rewards")
    .select("*, reward_rule:reward_rules(*)")
    .eq("pet_id", petId)
    .order("unlocked_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PetRewardWithRule[];
}

/** IDs de reward_rule ya desbloqueadas para una mascota (útil para diff antes/después). */
export async function listPetRewardRuleIds(petId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("pet_rewards")
    .select("reward_rule_id")
    .eq("pet_id", petId);
  if (error) throw error;
  return (data ?? []).map((r) => r.reward_rule_id);
}

/**
 * Devuelve la siguiente recompensa pendiente para una mascota: la reward_rule
 * activa con menor threshold_visits estrictamente mayor que los puntos actuales.
 * Devuelve null si no quedan recompensas por delante.
 */
export async function getNextPendingReward(
  petId: string,
  currentPoints: number,
): Promise<RewardRule | null> {
  // Excluir reglas ya desbloqueadas por esta mascota.
  const unlockedIds = await listPetRewardRuleIds(petId);
  let q = supabase
    .from("reward_rules")
    .select("*")
    .eq("active", true)
    .gt("threshold_visits", currentPoints)
    .order("threshold_visits", { ascending: true })
    .limit(1);
  if (unlockedIds.length > 0) {
    q = q.not("id", "in", `(${unlockedIds.join(",")})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Regla activa + progreso del perro (sellos / threshold y si ya está conseguida). */
export type RewardProgress = {
  rule: RewardRule;
  current: number;
  unlocked: boolean;
};

export async function listActiveRewardRulesWithProgress(
  petId: string,
  currentPoints: number,
): Promise<RewardProgress[]> {
  const [rules, unlockedIds] = await Promise.all([
    listRewardRules(),
    listPetRewardRuleIds(petId),
  ]);
  const set = new Set(unlockedIds);
  return rules
    .filter((r) => r.active)
    .map((r) => ({ rule: r, current: currentPoints, unlocked: set.has(r.id) }));
}

/**
 * Registra una visita completa con sus 4 sugerencias y devuelve el estado
 * de fidelización tras el trigger: el total de sellos del perro y las
 * recompensas recién desbloqueadas (diff antes/después).
 */
export async function registerVisitWithRewards(input: {
  pet_id: string;
  staff_id: string | null;
  photo_url: string | null;
  recognized_breed: string | null;
  recognized_coat: string | null;
  suggestions: Array<{
    position: number;
    title: string;
    description: string | null;
    image_url: string | null;
    is_chosen: boolean;
  }>;
}): Promise<{ sellos: number; newlyUnlocked: RewardRule[] }> {
  const beforeIds = new Set(await listPetRewardRuleIds(input.pet_id));

  await createVisitWithSuggestions(input);

  const [{ data: petRow, error: petErr }, after] = await Promise.all([
    supabase.from("pets").select("points").eq("id", input.pet_id).single(),
    listPetRewards(input.pet_id),
  ]);
  if (petErr) throw petErr;

  const newlyUnlocked = after
    .filter((r) => !beforeIds.has(r.reward_rule_id) && r.reward_rule)
    .map((r) => r.reward_rule!) as RewardRule[];

  return { sellos: petRow?.points ?? 0, newlyUnlocked };
}



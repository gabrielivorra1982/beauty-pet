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

export async function getOwnerWithPets(
  id: string,
): Promise<(Owner & { pets: Pet[] }) | null> {
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
    (p) =>
      p.name.toLowerCase().includes(t) ||
      (p.owner?.full_name ?? "").toLowerCase().includes(t),
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
  const { data, error } = await supabase
    .from("pets")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

export async function countPets(): Promise<number> {
  const { count, error } = await supabase
    .from("pets")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

// ---------- VISITS ----------

export async function listVisitsByPet(petId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("pet_id", petId)
    .order("visited_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

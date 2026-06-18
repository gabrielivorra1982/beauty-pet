/**
 * Capa de acceso a datos tipada para Kiwoko (Fase 1).
 * La UI NUNCA debe llamar a `supabase.from(...)` directamente — siempre
 * pasa por estas funciones para mantener tipos y desacoplar la fuente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Owner = Database["public"]["Tables"]["owners"]["Row"];
export type Pet = Database["public"]["Tables"]["pets"]["Row"];
export type PetInsert = Database["public"]["Tables"]["pets"]["Insert"];
export type PetWithOwner = Pet & { owner: Pick<Owner, "id" | "full_name"> | null };

export async function listPetsWithOwner(): Promise<PetWithOwner[]> {
  const { data, error } = await supabase
    .from("pets")
    .select("*, owner:owners(id, full_name)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PetWithOwner[];
}

export async function listOwners(): Promise<Owner[]> {
  const { data, error } = await supabase
    .from("owners")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPet(input: PetInsert): Promise<Pet> {
  const { data, error } = await supabase
    .from("pets")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

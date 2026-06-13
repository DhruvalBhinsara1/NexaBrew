import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Floor, FloorWithTables, Table } from "@/types/domain.types";
import type {
  CreateFloorInput,
  UpdateFloorInput,
  CreateTableInput,
  UpdateTableInput,
} from "@/schemas/floor.schema";
import { AppError } from "@/lib/utils/app-error";

type Supa = SupabaseClient<Database>;

export const FloorService = {
  async listWithTables(supabase: Supa): Promise<FloorWithTables[]> {
    const { data, error } = await supabase
      .from("floors")
      .select("*, tables(*)")
      .order("created_at", { ascending: true })
      .order("table_number", { referencedTable: "tables", ascending: true });
    if (error) throw new AppError(error.message, "FLOORS_LIST_FAILED", 500);
    return (data ?? []) as FloorWithTables[];
  },

  async createFloor(supabase: Supa, input: CreateFloorInput): Promise<Floor> {
    const { data, error } = await supabase
      .from("floors")
      .insert({ name: input.name })
      .select("*")
      .single();
    if (error) throw new AppError(error.message, "FLOOR_CREATE_FAILED", 400);
    return data;
  },

  async updateFloor(supabase: Supa, id: string, input: UpdateFloorInput): Promise<Floor> {
    const { data, error } = await supabase
      .from("floors")
      .update({ name: input.name })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError(error.message, "FLOOR_UPDATE_FAILED", 400);
    if (!data) throw new AppError("Floor not found", "FLOOR_NOT_FOUND", 404);
    return data;
  },

  async deleteFloor(supabase: Supa, id: string): Promise<void> {
    // Tables cascade-delete via FK.
    const { error } = await supabase.from("floors").delete().eq("id", id);
    if (error) throw new AppError(error.message, "FLOOR_DELETE_FAILED", 400);
  },

  async addTable(supabase: Supa, floorId: string, input: CreateTableInput): Promise<Table> {
    const { data, error } = await supabase
      .from("tables")
      .insert({
        floor_id: floorId,
        table_number: input.table_number,
        seats: input.seats,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AppError(
          "A table with that number already exists on this floor",
          "TABLE_DUPLICATE",
          409
        );
      }
      if (error.code === "23503") {
        throw new AppError("Floor not found", "FLOOR_NOT_FOUND", 404);
      }
      throw new AppError(error.message, "TABLE_CREATE_FAILED", 400);
    }
    return data;
  },

  async updateTable(supabase: Supa, tableId: string, input: UpdateTableInput): Promise<Table> {
    const { data, error } = await supabase
      .from("tables")
      .update(input)
      .eq("id", tableId)
      .select("*")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new AppError(
          "A table with that number already exists on this floor",
          "TABLE_DUPLICATE",
          409
        );
      }
      throw new AppError(error.message, "TABLE_UPDATE_FAILED", 400);
    }
    if (!data) throw new AppError("Table not found", "TABLE_NOT_FOUND", 404);
    return data;
  },
};

import type { Food } from "../types";

// Actions dispatched while loading the catalog.
export type CatalogAction =
    | { type: "catalog/loadStarted" }
    | { type: "catalog/chunkLoaded"; payload: { foods: Food[]; rejected: number } }
    | { type: "catalog/loaded"; payload: { total: number; rejected: number } }
    | { type: "catalog/loadFailed"; payload: { message: string } };
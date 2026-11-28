/*
Retrieves all the data in data.csv and store each food it contains in the app.
*/

import Papa from "papaparse";
import type { CatalogAction } from "../stores/actions";
import type { Food } from "../types";

const NUTRISCORES = ["a", "b", "c", "d", "e"] as const;
const LIQUID_GROUPS = ["Beverages", "Alcoholic beverages"];

type Row = Record<string, string>;


// Main function

export async function loadCatalog(url: string, dispatch: (action: CatalogAction) => void): Promise<void> {
    dispatch({ type: "catalog/loadStarted" });

    let total = 0;
    let rejected = 0;

    try {
        await parseCsv(url, (rows) => {
            const foods = rows.map(rowToFood).filter((f): f is Food => f !== null);
            const rejectedInChunk = rows.length - foods.length;

            total += foods.length;
            rejected += rejectedInChunk;

            dispatch({
                type: "catalog/chunkLoaded",
                payload: { foods, rejected: rejectedInChunk },
            });
        });

        dispatch({ type: "catalog/loaded", payload: { total, rejected } });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: "catalog/loadFailed", payload: { message } });
    }
}


function rowToFood(row: Row): Food | null {
    if (isBlank(row["id"]) || isBlank(row["name"])) {
        return null;
    }

    // Nutriments
    const kcal = toNumber(row["kcal_100g"]);
    const protein = toNumber(row["protein_100g"]);
    const fat = toNumber(row["fat_100g"]);
    const carbs = toNumber(row["carbs_100g"]);
    const sugars = toNumber(row["sugars_100g"]);
    const sodium = toNumber(row["sodium_100g"]);
    const fiber = toNumber(row["fiber_100g"]);
    const saturatedFat = toNumber(row["saturatedFat_100g"]);

    if (
        kcal === null || protein === null || fat === null || carbs === null ||
        sugars === null || sodium === null || fiber === null || saturatedFat === null
    ) {
        return null;
    }

    // Nutri-Score : only a-e, otherwise null
    const ns = row["nutriscore"]?.trim().toLowerCase();
    const nutriscore = NUTRISCORES.find((g) => g === ns) ?? null;

    const group = isBlank(row["group"]) ? null : row["group"].trim();

    return {
        id: row["id"].trim(),
        name: row["name"].trim(),
        image: row["image"]?.trim() ?? "",
        brand: isBlank(row["brand"]) ? null : row["brand"].trim(),
        group,
        subgroup: isBlank(row["subgroup"]) ? null : row["subgroup"].trim(),
        nutriscore,
        unit: group !== null && LIQUID_GROUPS.includes(group) ? "mL" : "g",
        kcal_100: kcal,
        protein_100: protein,
        fat_100: fat,
        carbs_100: carbs,
        sugars_100: sugars,
        sodium_100: sodium,
        fiber_100: fiber,
        saturatedFat_100: saturatedFat,
    };
}


// CSV parsing (in a worker, chunk by chunk)

function parseCsv(url: string, onChunk: (rows: Row[]) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        Papa.parse<Row>(url, {
            download: true,
            worker: true,
            header: true,
            skipEmptyLines: true,
            chunkSize: 1000 * 1000, // 1 Mo
            chunk: (results) => onChunk(results.data),
            complete: () => resolve(),
            error: (err: Error) => reject(err),
        });
    });
}


// Utils

function isBlank(value: string | undefined): boolean {
    return value === undefined || value.trim() === "";
}

function toNumber(value: string | undefined): number | null {
    if (isBlank(value)) return null;
    const n = parseFloat(value!);
    return Number.isFinite(n) ? n : null;
}
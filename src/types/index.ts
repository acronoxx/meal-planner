// Main types

export type Food = {
    id: string;
    name: string;
    image: string;
    brand: string | null;
    group: string | null;
    subgroup: string | null;
    nutriscore: Nutriscore;
    unit: Unit;
    kcal_100: number;
    protein_100: number;
    fat_100: number;
    carbs_100: number;
    sugars_100: number;
    sodium_100: number;
    fiber_100: number;
    saturatedFat_100: number;
}

export type Meal = {
    id: string;
    name: string;
    image: string;
    color: string;
    items: MealItem[];
}

export type Entry = {
    id: string;
    date: DateString;
    mealId: string | null;
    items: MealItem[];
}

export type Goals = {
    kcal: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    sugars: number | null;
    sodium: number | null;
    fiber: number | null;
    saturatedFat:number | null;
}

export type Note = {
    id: string;
    date: DateString;
    content: string;
}


// Secondary types

export type Nutriscore = 'a' | 'b' | 'c' | 'd' | 'e' | null;

export type DateString = string; // "YYYY-MM-DDTHH:MM:SS"

export type Unit = 'g' | 'mL';

export type MealItem = {id: string; foodId: string; qty: number };
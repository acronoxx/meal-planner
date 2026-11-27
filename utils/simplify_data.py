#!/usr/bin/env python3
"""
Extrait un snapshot propre de l'export CSV Open Food Facts vers data.csv (ou data.json).

Source  : https://world.openfoodfacts.org/data  (en.openfoodfacts.org.products.csv.gz)
Licence : Open Database License (ODbL) — attribution + partage à l'identique.

Arborescence attendue (chemins résolus depuis l'emplacement du script) :
    <projet>/scripts/extract_off.py
    <projet>/data/en.openfoodfacts.org.products.csv.gz   <- entrée
    <projet>/data/data.csv + data.meta.json               <- sortie

Usage :
    python3 extract_off.py                       # entrée et sortie par défaut dans ../data
    python3 extract_off.py -o ../data/data.json  # sortie JSON (meta incluse)
    python3 extract_off.py autre_export.csv.gz   # autre fichier d'entrée
    python3 extract_off.py --limit 3000          # échantillon de 3000 produits (défaut : pas de limite)
    python3 extract_off.py export.csv.gz --limit 3000 --country en:france --exclude "Baby foods"

Principe :
  1. Lecture en flux du .csv.gz (jamais tout en mémoire).
  2. Filtre : pays, nom présent, nutriments obligatoires présents et cohérents,
     catégorie PNNS connue, groupes exclus.
  3. Dédoublonnage par code-barres et par (nom, marque).
  4. Sans --limit : tous les produits valides sont gardés.
     Avec --limit N : échantillonnage équilibré, même quota par groupe PNNS de niveau 1,
     en gardant dans chaque groupe les produits les plus scannés (unique_scans_n).
"""

import argparse
import csv
import gzip
import heapq
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Champs du CSV utilisés --------------------------------------------------

# Nutriments obligatoires : clé dans data.json -> colonne du CSV (valeurs pour 100 g)
REQUIRED_NUTRIENTS = {
    "kcal": "energy-kcal_100g",
    "protein": "proteins_100g",
    "fat": "fat_100g",
    "carbs": "carbohydrates_100g",
    "sugars": "sugars_100g",
    "sodium": "sodium_100g",  # en g pour 100 g dans l'export OFF
}
# Nutriments facultatifs : gardés s'ils existent, sinon null
OPTIONAL_NUTRIENTS = {
    "fiber": "fiber_100g",
    "saturatedFat": "saturated-fat_100g",
}

COL_CODE = "code"
COL_NAME = "product_name"
COL_BRANDS = "brands"
COL_COUNTRIES = "countries_tags"
COL_PNNS1 = "pnns_groups_1"
COL_PNNS2 = "pnns_groups_2"
COL_NUTRISCORE = "nutriscore_grade"
COL_SCANS = "unique_scans_n"

UNKNOWN_GROUPS = {"", "unknown"}
# Coquilles connues dans les sous-groupes PNNS
PNNS2_FIXES = {"Pizza pies and quiche": "Pizza pies and quiches"}
VALID_NUTRISCORES = {"a", "b", "c", "d", "e"}


# Dossier data/ voisin du dossier du script (résolu depuis le script, pas depuis le cwd)
PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = PROJECT_DIR / "data" / "en.openfoodfacts.org.products.csv.gz"
DEFAULT_OUTPUT = PROJECT_DIR / "public" / "data" / "data.csv"


def parse_args():
    p = argparse.ArgumentParser(description="Snapshot propre d'Open Food Facts -> ../data/data.csv")
    p.add_argument("source", nargs="?", default=str(DEFAULT_SOURCE),
                    help=f"Export OFF .csv.gz ou .csv (défaut : {DEFAULT_SOURCE})")
    p.add_argument("-o", "--output", default=str(DEFAULT_OUTPUT),
                    help=f"Sortie .csv (+ .meta.json à côté) ou .json (défaut : {DEFAULT_OUTPUT})")
    p.add_argument("--country", default="en:france", help="Tag pays à garder (défaut : en:france, vide = tous)")
    p.add_argument("--limit", type=int, default=0,
                    help="Nombre total de produits (défaut : 0 = pas de limite)")
    p.add_argument("--exclude", action="append", default=["Baby foods"],
                    help="Groupe PNNS 1 à exclure (répétable, défaut : 'Baby foods')")
    p.add_argument("--require-fiber", action="store_true", help="Exiger aussi les fibres")
    return p.parse_args()


def to_float(value):
    """Convertit une cellule en float, ou None si vide / invalide."""
    value = value.strip()
    if not value:
        return None
    try:
        f = float(value)
    except ValueError:
        return None
    if f != f or f in (float("inf"), float("-inf")):  # NaN / infini
        return None
    return f


def is_consistent(n):
    """Rejette les valeurs physiquement impossibles (pour 100 g)."""
    if any(v < 0 for v in n.values() if v is not None):
        return False
    if n["kcal"] > 900:  # même l'huile pure fait ~900 kcal / 100 g
        return False
    if n["protein"] + n["fat"] + n["carbs"] > 105:  # tolérance d'arrondi
        return False
    if n["sugars"] > n["carbs"] + 0.5:
        return False
    if n["sodium"] > 40:  # 40 g de sodium / 100 g ~ sel pur
        return False
    if n.get("fiber") is not None and n["fiber"] > 100:
        return False
    if n.get("saturatedFat") is not None and n["saturatedFat"] > n["fat"] + 0.5:
        return False
    return True


def open_source(path):
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace", newline="")
    return open(path, "rt", encoding="utf-8", errors="replace", newline="")


def main():
    args = parse_args()
    excluded = set(args.exclude)
    if not Path(args.source).is_file():
        sys.exit(f"Fichier d'entrée introuvable : {args.source}")
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    # Un tas min par groupe PNNS 1 : on garde les produits les plus scannés.
    # On en garde plus que le quota final pour pouvoir dédoublonner ensuite.
    unlimited = args.limit <= 0
    per_group_keep = None if unlimited else args.limit
    heaps = {}
    counter = 0  # départage les égalités dans le tas (évite de comparer des dict)
    stats = {"lines": 0, "country": 0, "valid": 0, "rejected_incoherent": 0}

    with open_source(args.source) as f:
        header = f.readline().rstrip("\r\n").split("\t")
        idx = {name: i for i, name in enumerate(header)}
        needed = [COL_CODE, COL_NAME, COL_BRANDS, COL_COUNTRIES, COL_PNNS1, COL_PNNS2,
                  COL_NUTRISCORE, COL_SCANS, *REQUIRED_NUTRIENTS.values(), *OPTIONAL_NUTRIENTS.values()]
        if missing:= [c for c in needed if c not in idx]:
            sys.exit(f"Colonnes absentes de l'export : {missing}")

        for line in f:
            stats["lines"] += 1
            if stats["lines"] % 500_000 == 0:
                print(f"  {stats['lines']:,} lignes lues, {stats['valid']:,} valides", file=sys.stderr)

            # Pré-filtre rapide avant de découper la ligne
            if args.country and args.country not in line:
                continue
            cols = line.rstrip("\r\n").replace("\x00", "").split("\t")
            if len(cols) != len(header):
                continue  # ligne cassée
            get = lambda c: cols[idx[c]]

            if args.country and args.country not in get(COL_COUNTRIES).split(","):
                continue
            stats["country"] += 1

            name = get(COL_NAME).strip()
            pnns1 = get(COL_PNNS1).strip()
            pnns2 = PNNS2_FIXES.get(get(COL_PNNS2).strip(), get(COL_PNNS2).strip())
            if not name or pnns1 in UNKNOWN_GROUPS or pnns2 in UNKNOWN_GROUPS or pnns1 in excluded:
                continue

            nutrients = {k: to_float(get(c)) for k, c in REQUIRED_NUTRIENTS.items()}
            if any(v is None for v in nutrients.values()):
                continue
            for k, c in OPTIONAL_NUTRIENTS.items():
                nutrients[k] = to_float(get(c))
            if args.require_fiber and nutrients["fiber"] is None:
                continue
            if not is_consistent(nutrients):
                stats["rejected_incoherent"] += 1
                continue

            stats["valid"] += 1
            nutriscore = get(COL_NUTRISCORE).strip().lower()
            food = {
                "id": get(COL_CODE).strip(),
                "name": name,
                "brand": get(COL_BRANDS).split(",")[0].strip() or None,
                "group": pnns1,
                "subgroup": pnns2,
                "nutriscore": nutriscore if nutriscore in VALID_NUTRISCORES else None,
                "per100g": {k: (round(v, 3) if v is not None else None) for k, v in nutrients.items()},
            }
            scans = to_float(get(COL_SCANS)) or 0.0

            heap = heaps.setdefault(pnns1, [])
            counter += 1
            item = (scans, counter, food)
            if per_group_keep is None or len(heap) < per_group_keep:
                heapq.heappush(heap, item)
            elif scans > heap[0][0]:
                heapq.heapreplace(heap, item)

    # Dédoublonnage + quota équilibré par groupe
    groups = sorted(heaps)
    quota = float("inf") if unlimited else args.limit // max(len(groups), 1)
    seen_ids, seen_names = set(), set()
    foods, leftovers = [], []
    for g in groups:
        ranked = sorted(heaps[g], key=lambda t: (-t[0], t[1]))
        taken = 0
        for scans, _, food in ranked:
            key = (food["name"].casefold(), (food["brand"] or "").casefold())
            if food["id"] in seen_ids or key in seen_names:
                continue
            seen_ids.add(food["id"]); seen_names.add(key)
            if taken < quota:
                foods.append(food); taken += 1
            else:
                leftovers.append((scans, food))
    # Les places restantes (groupes trop petits, reste de la division) vont aux plus scannés
    if not unlimited:
        leftovers.sort(key=lambda t: -t[0])
        foods += [f for _, f in leftovers[: max(args.limit - len(foods), 0)]]
    foods.sort(key=lambda f: (f["group"], f["subgroup"], f["name"].casefold()))

    out = {
        "meta": {
            "source": "Open Food Facts — https://world.openfoodfacts.org/data",
            "license": "ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)",
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "units": {"kcal": "kcal/100g", "default": "g/100g"},
            "filters": {
                "country": args.country or None,
                "requiredNutrients": list(REQUIRED_NUTRIENTS),
                "requireFiber": args.require_fiber,
                "excludedGroups": sorted(excluded),
                "limit": None if unlimited else args.limit,
                "sampling": "aucun (tous les produits valides)" if unlimited
                            else "quota égal par group, produits les plus scannés (unique_scans_n)",
            },
            "stats": {**stats, "kept": len(foods)},
        },
        "foods": foods,
    }
    if args.output.lower().endswith(".json"):
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
    else:
        # CSV : une ligne par produit, nutriments aplatis en colonnes (valeurs pour 100 g).
        nutrient_keys = [*REQUIRED_NUTRIENTS, *OPTIONAL_NUTRIENTS]
        fields = ["id", "name", "brand", "group", "subgroup", "nutriscore",
                  *[f"{k}_100g" for k in nutrient_keys]]
        with open(args.output, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)  # virgule + guillemets si besoin (noms avec virgules)
            w.writerow(fields)
            for food in foods:
                w.writerow([food["id"], food["name"], food["brand"] or "", food["group"],
                            food["subgroup"], food["nutriscore"] or "",
                            *["" if food["per100g"][k] is None else food["per100g"][k]
                            for k in nutrient_keys]])
        # Le CSV ne peut pas porter les métadonnées : on les écrit à côté.
        meta_path = Path(args.output).with_suffix(".meta.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(out["meta"], f, ensure_ascii=False, indent=1)

    print(json.dumps(out["meta"]["stats"], indent=1), file=sys.stderr)
    by_group = {}
    for food in foods:
        by_group[food["group"]] = by_group.get(food["group"], 0) + 1
    print("Par groupe :", json.dumps(by_group, ensure_ascii=False, indents=1), file=sys.stderr)


if __name__ == "__main__":
    main()
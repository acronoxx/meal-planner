import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { emojiForFood } from '@/lib/food-emojis'

import type { PlannerFood } from '../app/(frontend)/meal-planner'

const CSV_PATH = path.join(process.cwd(), 'data', 'simplifiedData.csv')

type Category = PlannerFood['category']

const HTML_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  apos: "'",
  deg: '°',
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
}

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

// Analyseur CSV minimal : champs entre guillemets, "" échappé, fins de ligne \r\n ou \n.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += char
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function categoryFor(group: string, subgroup: string): Category {
  switch (group) {
    case 'Alcoholic beverages':
    case 'Beverages':
      return 'drink'
    case 'Cereals and potatoes':
      return subgroup === 'Legumes' ? 'vegetable' : 'grain'
    case 'Composite foods':
      return 'meal'
    case 'Fat and sauces':
      return 'sauce'
    case 'Fish Meat Eggs':
      return 'protein'
    case 'Fruits and vegetables':
      if (subgroup === 'Soups') return 'meal'
      return subgroup === 'Vegetables' ? 'vegetable' : 'fruit'
    case 'Milk and dairy products':
      return 'dairy'
    default:
      return 'snack' // Salty snacks, Sugary snacks
  }
}

let cache: Promise<PlannerFood[]> | undefined

async function readFoods(): Promise<PlannerFood[]> {
  const rows = parseCsv((await readFile(CSV_PATH, 'utf-8')).replace(/^\uFEFF/, ''))
  const header = rows[0]
  const col = (name: string) => header.indexOf(name)
  const index = {
    id: col('id'),
    name: col('name'),
    brand: col('brand'),
    group: col('group'),
    subgroup: col('subgroup'),
    kcal: col('kcal_100g'),
    protein: col('protein_100g'),
    fat: col('fat_100g'),
    carbs: col('carbs_100g'),
    sugars: col('sugars_100g'),
    sodium: col('sodium_100g'),
    fiber: col('fiber_100g'),
  }
  const num = (row: string[], i: number) => {
    const value = Number(row[i])
    return row[i] !== '' && Number.isFinite(value) ? value : 0
  }

  return rows.slice(1).flatMap((row): PlannerFood[] => {
    const id = row[index.id]?.trim()
    const name = decodeEntities(row[index.name] ?? '').replace(/^"+|"+$/g, '').trim()
    if (!id || !name) return []
    const category = categoryFor(row[index.group], row[index.subgroup])
    const brand = decodeEntities(row[index.brand] ?? '').trim()
    return [
      {
        id,
        name,
        brand: brand || undefined,
        emoji: emojiForFood(id),
        fdcId: id,
        source: 'open-food-facts',
        category,
        servingSize: 100,
        servingUnit: category === 'drink' ? 'ml' : 'g',
        calories: num(row, index.kcal),
        protein: num(row, index.protein),
        carbs: num(row, index.carbs),
        fat: num(row, index.fat),
        fiber: num(row, index.fiber),
        sugar: num(row, index.sugars),
        sodium: num(row, index.sodium) * 1000, // g/100 g dans le CSV -> mg/100 g dans l'application
      },
    ]
  })
}

/** Aliments lus dans data/simplifiedData.csv (liste vide si le fichier est absent ou illisible). */
export function loadCsvFoods(): Promise<PlannerFood[]> {
  cache ??= readFoods().catch((error) => {
    console.error('Lecture de data/simplifiedData.csv impossible :', error)
    cache = undefined
    return []
  })
  return cache
}

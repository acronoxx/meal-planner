import { loadCsvFoods } from '@/lib/food-data'
import { emojiForFood } from '@/lib/food-emojis'

import MealPlanner, { type PlannerFood } from './meal-planner'

const NUTRIENT_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const

async function getPayloadFoods(): Promise<PlannerFood[]> {
  try {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'foods',
      depth: 0,
      pagination: false,
      sort: 'name',
      overrideAccess: false,
    })

    return result.docs
      .filter(
        (food) =>
          food.servingSize > 0 &&
          NUTRIENT_FIELDS.every(
            (field) => typeof food[field] === 'number' && Number.isFinite(food[field]),
          ),
      )
      .map((food) => ({
        id: String(food.id),
        name: food.name,
        brand: food.brand ?? undefined,
        emoji: food.emoji || emojiForFood(food.fdcId),
        fdcId: food.fdcId,
        source: food.datasetSource,
        category: food.category,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sugar: food.sugar,
        sodium: food.sodium,
      }))
  } catch {
    return []
  }
}

// Source principale : data/simplifiedData.csv. Repli sur la collection Payload « foods » si le CSV est absent.
async function getFoods(): Promise<PlannerFood[]> {
  const csvFoods = await loadCsvFoods()
  return csvFoods.length ? csvFoods : getPayloadFoods()
}

export default async function HomePage() {
  const foods = await getFoods()
  const today = new Date()
  const monday = new Date(today)
  const day = today.getDay() || 7
  monday.setDate(today.getDate() - day + 1)
  monday.setHours(12, 0, 0, 0)

  return <MealPlanner foods={foods} weekStart={monday.toISOString()} />
}

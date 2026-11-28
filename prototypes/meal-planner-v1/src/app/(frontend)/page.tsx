import config from '@payload-config'
import { getPayload } from 'payload'

import MealPlanner, { type PlannerFood } from './meal-planner'

async function getFoods(): Promise<PlannerFood[]> {
  try {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'foods',
      depth: 0,
      limit: 100,
      sort: 'name',
      overrideAccess: false,
    })

    return result.docs.map((food) => ({
      id: String(food.id),
      name: food.name,
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

export default async function HomePage() {
  const foods = await getFoods()
  const today = new Date()
  const monday = new Date(today)
  const day = today.getDay() || 7
  monday.setDate(today.getDate() - day + 1)
  monday.setHours(12, 0, 0, 0)

  return <MealPlanner foods={foods} weekStart={monday.toISOString()} />
}

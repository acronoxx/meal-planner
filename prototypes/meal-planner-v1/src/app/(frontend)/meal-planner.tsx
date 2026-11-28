'use client'

import {
  Apple,
  Beef,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Coffee,
  Droplets,
  Egg,
  Fish,
  Goal,
  Leaf,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Utensils,
  Wheat,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'

export type PlannerFood = {
  id: string
  name: string
  fdcId: string
  source: 'foundation' | 'sr-legacy' | 'fndds'
  category: 'fruit' | 'vegetable' | 'protein' | 'grain' | 'dairy' | 'drink' | 'snack'
  servingSize: number
  servingUnit: 'g' | 'ml'
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
}

type MealEntry = {
  id: string
  foodId: string
  day: number
  minutes: number
  amount: number
  quantity: number
}

type Goals = {
  calories: number
  protein: number
  carbs: number
  fat: number
  weight: number
  height: number
}

type Nutrients = Pick<
  PlannerFood,
  'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'
>

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const FULL_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const START_HOUR = 6
const HOUR_HEIGHT = 66
const EMPTY_NUTRIENTS: Nutrients = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
}
const DEFAULT_GOALS: Goals = {
  calories: 2200,
  protein: 120,
  carbs: 250,
  fat: 70,
  weight: 74,
  height: 178,
}

const categoryMeta: Record<
  PlannerFood['category'],
  { color: string; pale: string; icon: typeof Apple }
> = {
  fruit: { color: '#f06b55', pale: '#fff0ec', icon: Apple },
  vegetable: { color: '#65a972', pale: '#edf8ee', icon: Leaf },
  protein: { color: '#8f6d5b', pale: '#f7efeb', icon: Beef },
  grain: { color: '#d49b3f', pale: '#fff6df', icon: Wheat },
  dairy: { color: '#7d8fca', pale: '#eef1ff', icon: Droplets },
  drink: { color: '#5593ae', pale: '#e9f6fb', icon: Coffee },
  snack: { color: '#c47b9c', pale: '#faedf4', icon: Sparkles },
}

const sourceNames: Record<PlannerFood['source'], string> = {
  foundation: 'Foundation Foods',
  'sr-legacy': 'SR Legacy',
  fndds: 'FNDDS',
}

function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  }
}

function scaleFood(food: PlannerFood, amount: number, quantity: number): Nutrients {
  const factor = (amount * quantity) / 100
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber * factor,
    sugar: food.sugar * factor,
    sodium: food.sodium * factor,
  }
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString('fr-FR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

function FoodMark({ food, size = 'md' }: { food: PlannerFood; size?: 'sm' | 'md' | 'lg' }) {
  const meta = categoryMeta[food.category]
  const Icon =
    food.name.toLowerCase().includes('œuf') || food.name.toLowerCase().includes('egg')
      ? Egg
      : food.name.toLowerCase().includes('saumon') || food.name.toLowerCase().includes('fish')
        ? Fish
        : meta.icon
  const dimensions = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  const iconSize = size === 'lg' ? 29 : size === 'sm' ? 15 : 20

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${dimensions}`}
      style={{ backgroundColor: meta.pale, color: meta.color }}
    >
      <Icon size={iconSize} strokeWidth={1.8} />
    </span>
  )
}

function Modal({
  children,
  onClose,
  width = 'max-w-lg',
}: {
  children: ReactNode
  onClose: () => void
  width?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1f2a24]/25 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`max-h-[90vh] w-full ${width} overflow-auto rounded-[26px] bg-white shadow-2xl`}>
        {children}
      </div>
    </div>
  )
}

function NutrientRows({ nutrients }: { nutrients: Nutrients }) {
  const rows = [
    ['Protéines', nutrients.protein, 'g', '#4f8a63'],
    ['Glucides', nutrients.carbs, 'g', '#d4983f'],
    ['Lipides', nutrients.fat, 'g', '#b66d7b'],
    ['Fibres', nutrients.fiber, 'g', '#6a8d77'],
    ['Sucres', nutrients.sugar, 'g', '#a88055'],
    ['Sodium', nutrients.sodium, 'mg', '#78909c'],
  ] as const
  const max = Math.max(...rows.slice(0, 5).map((row) => row[1]), 1)

  return (
    <div className="space-y-3">
      {rows.map(([label, value, unit, color]) => (
        <div key={label} className="grid grid-cols-[78px_1fr_64px] items-center gap-3 text-sm">
          <span className="text-[#778078]">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-[#edf0ec]">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
            />
          </span>
          <span className="text-right font-semibold text-[#28332c]">
            {fmt(value, value < 10 ? 1 : 0)} {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function MealPlanner({
  foods,
  weekStart,
}: {
  foods: PlannerFood[]
  weekStart: string
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | PlannerFood['category']>('all')
  const [entries, setEntries] = useState<MealEntry[]>([])
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [hydrated, setHydrated] = useState(false)
  const [detailFood, setDetailFood] = useState<PlannerFood | null>(null)
  const [summary, setSummary] = useState<{ type: 'day' | 'week'; day?: number } | null>(null)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [portion, setPortion] = useState<{
    food: PlannerFood
    day: number
    minutes: number
    amount: number
    quantity: number
    entryId?: string
  } | null>(null)
  const calendarScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedEntries = window.localStorage.getItem('alexis-meal-entries')
    const storedGoals = window.localStorage.getItem('alexis-meal-goals')
    if (storedEntries) {
      try {
        setEntries(JSON.parse(storedEntries) as MealEntry[])
      } catch {
        window.localStorage.removeItem('alexis-meal-entries')
      }
    }
    if (storedGoals) {
      try {
        setGoals(JSON.parse(storedGoals) as Goals)
      } catch {
        window.localStorage.removeItem('alexis-meal-goals')
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (calendarScrollRef.current) {
      calendarScrollRef.current.scrollTop = START_HOUR * HOUR_HEIGHT
    }
  }, [])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem('alexis-meal-entries', JSON.stringify(entries))
  }, [entries, hydrated])

  useEffect(() => {
    if (hydrated) window.localStorage.setItem('alexis-meal-goals', JSON.stringify(goals))
  }, [goals, hydrated])

  const weekDates = useMemo(() => {
    const monday = new Date(weekStart)
    return DAYS.map((_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return date
    })
  }, [weekStart])

  const foodById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])
  const filteredFoods = useMemo(
    () =>
      foods.filter(
        (food) =>
          (category === 'all' || food.category === category) &&
          food.name.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')),
      ),
    [category, foods, query],
  )

  const dailyTotals = useMemo(
    () =>
      DAYS.map((_, day) =>
        entries
          .filter((entry) => entry.day === day)
          .reduce((total, entry) => {
            const food = foodById.get(entry.foodId)
            return food
              ? addNutrients(total, scaleFood(food, entry.amount, entry.quantity))
              : total
          }, EMPTY_NUTRIENTS),
      ),
    [entries, foodById],
  )
  const weekTotal = useMemo(
    () => dailyTotals.reduce((total, day) => addNutrients(total, day), EMPTY_NUTRIENTS),
    [dailyTotals],
  )

  function startFoodDrag(event: DragEvent, food: PlannerFood, entryId?: string) {
    event.dataTransfer.effectAllowed = entryId ? 'move' : 'copy'
    event.dataTransfer.setData('application/x-food-id', food.id)
    if (entryId) event.dataTransfer.setData('application/x-entry-id', entryId)
  }

  function dropFood(event: DragEvent<HTMLDivElement>, day: number) {
    event.preventDefault()
    const food = foodById.get(event.dataTransfer.getData('application/x-food-id'))
    if (!food) return
    const rect = event.currentTarget.getBoundingClientRect()
    const rawMinutes = ((event.clientY - rect.top) / HOUR_HEIGHT) * 60
    const minutes = Math.max(0, Math.min(1430, Math.round(rawMinutes / 15) * 15))
    const entryId = event.dataTransfer.getData('application/x-entry-id') || undefined
    const existing = entryId ? entries.find((entry) => entry.id === entryId) : undefined
    setPortion({
      food,
      day,
      minutes,
      amount: existing?.amount ?? food.servingSize,
      quantity: existing?.quantity ?? 1,
      entryId,
    })
  }

  function savePortion() {
    if (!portion) return
    if (portion.entryId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === portion.entryId
            ? {
                ...entry,
                day: portion.day,
                minutes: portion.minutes,
                amount: portion.amount,
                quantity: portion.quantity,
              }
            : entry,
        ),
      )
    } else {
      setEntries((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          foodId: portion.food.id,
          day: portion.day,
          minutes: portion.minutes,
          amount: portion.amount,
          quantity: portion.quantity,
        },
      ])
    }
    setPortion(null)
  }

  const formatTime = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  return (
    <main className="min-h-dvh bg-[#f5f6f1] text-[#263129]">
      <header className="flex h-[74px] items-center justify-between border-b border-[#dfe3dc] bg-[#fbfcf8] px-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#315c46] text-white shadow-sm">
            <Utensils size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[19px] font-semibold tracking-[-0.03em]">Table d’Alexis</h1>
              <span className="rounded-full bg-[#e7f2e9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4e7b5e]">
                beta
              </span>
            </div>
            <p className="text-xs text-[#899189]">Mieux manger, un repas à la fois</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-xl border border-[#dfe3dc] bg-white px-3 py-2 text-sm font-medium text-[#59645c] md:flex">
          <CalendarDays size={16} />
          <span>
            {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} —{' '}
            {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
          <ChevronDown size={14} />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGoalsOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#315c46] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#274c39]"
          >
            <Goal size={17} />
            <span className="hidden sm:inline">Objectifs</span>
          </button>
          <button
            aria-label="Aide"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#dfe3dc] bg-white text-[#687269]"
          >
            <CircleHelp size={18} />
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#e4b687] text-sm font-bold text-[#69472f]">
            A
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-74px)] min-h-[690px] grid-cols-1 lg:grid-cols-[292px_minmax(900px,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-[#dfe3dc] bg-[#fbfcf8] lg:flex">
          <div className="border-b border-[#e5e8e1] p-5 pb-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold tracking-[-0.02em]">Aliments</h2>
                <p className="mt-0.5 text-xs text-[#8a928b]">{foods.length} références USDA</p>
              </div>
              <button className="grid h-8 w-8 place-items-center rounded-lg border border-[#dfe3dc] bg-white text-[#69736b]">
                <Settings2 size={15} />
              </button>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-[#d9ded7] bg-white px-3 py-2.5 focus-within:border-[#6d9279] focus-within:ring-2 focus-within:ring-[#dce9df]">
              <Search size={16} className="text-[#8b948d]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un aliment"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a2a8a2]"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Effacer">
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {[
                ['all', 'Tous'],
                ['fruit', 'Fruits'],
                ['vegetable', 'Légumes'],
                ['protein', 'Protéines'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setCategory(value as typeof category)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    category === value
                      ? 'bg-[#315c46] text-white'
                      : 'border border-[#dfe3dc] bg-white text-[#6e786f]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#9aa19b]">
              Glisser vers le calendrier
            </p>
            <div className="space-y-1.5">
              {filteredFoods.map((food) => (
                <button
                  key={food.id}
                  draggable
                  onDragStart={(event) => startFoodDrag(event, food)}
                  onClick={() => setDetailFood(food)}
                  className="group flex w-full cursor-grab items-center gap-3 rounded-2xl border border-transparent p-2.5 text-left transition hover:border-[#e2e6df] hover:bg-white hover:shadow-sm active:cursor-grabbing"
                >
                  <FoodMark food={food} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{food.name}</span>
                    <span className="mt-0.5 block text-[11px] text-[#8b948c]">
                      {fmt(food.calories)} kcal · 100 {food.servingUnit}
                    </span>
                  </span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg text-[#a1a8a1] opacity-0 transition group-hover:opacity-100">
                    <Plus size={16} />
                  </span>
                </button>
              ))}
              {!filteredFoods.length && (
                <div className="m-2 rounded-2xl border border-dashed border-[#d7ddd5] p-6 text-center">
                  <Leaf className="mx-auto mb-3 text-[#8daa96]" size={24} />
                  <p className="text-sm font-semibold">Aucun aliment trouvé</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#8a938b]">
                    Le catalogue USDA peut être complété depuis l’administration.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-[#e5e8e1] p-4 text-[10px] leading-relaxed text-[#969d97]">
            Valeurs issues des jeux Foundation Foods, SR Legacy et FNDDS.
          </div>
        </aside>

        <section className="min-w-0 overflow-x-auto bg-[#f5f6f1]">
          <div className="grid h-full min-w-[900px] grid-rows-[74px_minmax(0,1fr)_84px]">
            <div className="grid grid-cols-[62px_repeat(7,minmax(110px,1fr))] border-b border-[#dfe3dc] bg-[#fbfcf8] pr-2">
              <div className="grid place-items-center border-r border-[#e5e8e1] text-[#a0a7a0]">
                <MoreHorizontal size={18} />
              </div>
              {DAYS.map((name, day) => {
                const isToday = new Date().toDateString() === weekDates[day].toDateString()
                return (
                  <div
                    key={name}
                    className={`flex items-center justify-center gap-2 border-r border-[#e5e8e1] last:border-r-0 ${
                      isToday ? 'bg-[#f1f7f2]' : ''
                    }`}
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-[0.12em] ${
                        isToday ? 'text-[#315c46]' : 'text-[#7d867f]'
                      }`}
                    >
                      {name}
                    </span>
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${
                        isToday ? 'bg-[#315c46] text-white' : 'text-[#3f4942]'
                      }`}
                    >
                      {weekDates[day].getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            <div ref={calendarScrollRef} className="calendar-scroll min-h-0 overflow-y-auto">
              <div
                className="grid grid-cols-[62px_repeat(7,minmax(110px,1fr))]"
                style={{ height: HOURS.length * HOUR_HEIGHT }}
              >
                <div className="relative border-r border-[#dfe3dc] bg-[#f7f8f4]">
                  {HOURS.map((hour) => (
                    <span
                      key={hour}
                      className="absolute right-3 -translate-y-1/2 text-[10px] font-medium text-[#929a93]"
                      style={{ top: hour * HOUR_HEIGHT }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {DAYS.map((_, day) => (
                  <div
                    key={day}
                    className="calendar-day relative border-r border-[#e1e5df] bg-white/60 last:border-r-0"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropFood(event, day)}
                  >
                    {HOURS.map((hour) => (
                      <span
                        key={hour}
                        className="pointer-events-none absolute inset-x-0 border-t border-[#e9ece7]"
                        style={{ top: hour * HOUR_HEIGHT }}
                      />
                    ))}
                    {entries
                      .filter((entry) => entry.day === day)
                      .map((entry) => {
                        const food = foodById.get(entry.foodId)
                        if (!food) return null
                        const meta = categoryMeta[food.category]
                        return (
                          <button
                            key={entry.id}
                            draggable
                            onDragStart={(event) => startFoodDrag(event, food, entry.id)}
                            onClick={() => setDetailFood(food)}
                            title={`${food.name} — ${entry.amount * entry.quantity} ${food.servingUnit}`}
                            className="group absolute left-1.5 right-1.5 z-10 flex h-[54px] cursor-grab items-center gap-2 overflow-hidden rounded-xl border p-1.5 text-left shadow-sm transition hover:z-20 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                            style={{
                              top: (entry.minutes / 60) * HOUR_HEIGHT + 5,
                              borderColor: `${meta.color}42`,
                              backgroundColor: meta.pale,
                            }}
                          >
                            <FoodMark food={food} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-bold text-[#334038]">
                                {food.name}
                              </span>
                              <span className="block text-[9px] font-medium text-[#788279]">
                                {formatTime(entry.minutes)} · {fmt(entry.amount * entry.quantity)}{' '}
                                {food.servingUnit}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[62px_repeat(7,minmax(110px,1fr))] border-t border-[#dce1da] bg-[#fbfcf8] pr-2">
              <button
                onClick={() => setSummary({ type: 'week' })}
                className="flex flex-col items-center justify-center border-r border-[#e5e8e1] text-[#315c46] transition hover:bg-[#f0f6f1]"
                title="Résumé de la semaine"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider">Semaine</span>
                <span className="mt-1 text-xs font-bold">{fmt(weekTotal.calories / 1000, 1)}k</span>
              </button>
              {dailyTotals.map((total, day) => (
                <button
                  key={day}
                  onClick={() => setSummary({ type: 'day', day })}
                  className="group flex items-center justify-center border-r border-[#e5e8e1] px-2 last:border-r-0 hover:bg-[#f2f6f1]"
                >
                  <div className="w-full text-left">
                    <div className="mb-1.5 flex items-end justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8d958e]">
                        Total
                      </span>
                      <span className="text-xs font-bold text-[#354139]">
                        {fmt(total.calories)} <span className="font-normal text-[#939a94]">kcal</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#e6eae4]">
                      <div
                        className="h-full rounded-full bg-[#6d9a78] transition-all"
                        style={{ width: `${Math.min(100, (total.calories / goals.calories) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[9px] text-[#8d958e]">
                      <span>P {fmt(total.protein)}g</span>
                      <span>G {fmt(total.carbs)}g</span>
                      <span>L {fmt(total.fat)}g</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {detailFood && (
        <Modal onClose={() => setDetailFood(null)}>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <FoodMark food={detailFood} size="lg" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7e987f]">
                    {sourceNames[detailFood.source]} · FDC {detailFood.fdcId}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{detailFood.name}</h2>
                  <p className="mt-1 text-sm text-[#879087]">
                    Valeurs pour 100 {detailFood.servingUnit}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailFood(null)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f4f0] text-[#727b73]"
              >
                <X size={17} />
              </button>
            </div>
            <div className="my-6 rounded-2xl bg-[#315c46] p-5 text-white">
              <p className="text-xs text-white/65">Énergie</p>
              <p className="mt-1 text-4xl font-semibold tracking-[-0.05em]">
                {fmt(detailFood.calories)}
                <span className="ml-2 text-base font-normal text-white/65">kcal</span>
              </p>
            </div>
            <NutrientRows nutrients={detailFood} />
          </div>
        </Modal>
      )}

      {portion && (
        <Modal onClose={() => setPortion(null)} width="max-w-md">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <FoodMark food={portion.food} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{portion.food.name}</p>
                <p className="text-xs text-[#8a938b]">
                  {FULL_DAYS[portion.day]} à {formatTime(portion.minutes)}
                </p>
              </div>
              <button onClick={() => setPortion(null)} className="rounded-full bg-[#f2f4f0] p-2">
                <X size={16} />
              </button>
            </div>
            <div className="my-6 grid grid-cols-2 gap-3">
              <label className="rounded-2xl border border-[#dfe3dc] p-3">
                <span className="text-xs font-medium text-[#7e877f]">Quantité</span>
                <span className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPortion((current) =>
                        current ? { ...current, quantity: Math.max(1, current.quantity - 1) } : current,
                      )
                    }
                    className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0f3ee]"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={portion.quantity}
                    onChange={(event) =>
                      setPortion({ ...portion, quantity: Math.max(1, Number(event.target.value)) })
                    }
                    className="w-full min-w-0 bg-transparent text-center text-lg font-semibold outline-none"
                  />
                  <button
                    onClick={() => setPortion({ ...portion, quantity: portion.quantity + 1 })}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0f3ee]"
                  >
                    <Plus size={13} />
                  </button>
                </span>
              </label>
              <label className="rounded-2xl border border-[#dfe3dc] p-3">
                <span className="text-xs font-medium text-[#7e877f]">
                  {portion.food.servingUnit === 'ml' ? 'Volume' : 'Poids'}
                </span>
                <span className="mt-2 flex items-baseline">
                  <input
                    type="number"
                    min={1}
                    value={portion.amount}
                    onChange={(event) =>
                      setPortion({ ...portion, amount: Math.max(1, Number(event.target.value)) })
                    }
                    className="w-full min-w-0 bg-transparent text-lg font-semibold outline-none"
                  />
                  <span className="text-sm text-[#8b948c]">{portion.food.servingUnit}</span>
                </span>
              </label>
            </div>
            <div className="mb-5 flex items-center justify-between rounded-2xl bg-[#f3f6f1] px-4 py-3">
              <span className="text-sm text-[#727c74]">Apport estimé</span>
              <span className="font-semibold">
                {fmt(scaleFood(portion.food, portion.amount, portion.quantity).calories)} kcal
              </span>
            </div>
            <div className="flex gap-2">
              {portion.entryId && (
                <button
                  onClick={() => {
                    setEntries((current) =>
                      current.filter((entry) => entry.id !== portion.entryId),
                    )
                    setPortion(null)
                  }}
                  className="rounded-xl border border-[#e0b8b2] px-4 py-3 text-sm font-semibold text-[#a6554a] hover:bg-[#fff4f2]"
                >
                  Retirer
                </button>
              )}
              <button
                onClick={savePortion}
                className="flex-1 rounded-xl bg-[#315c46] py-3 text-sm font-semibold text-white hover:bg-[#294e3b]"
              >
                {portion.entryId ? 'Mettre à jour le repas' : 'Ajouter au planning'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {goalsOpen && (
        <Modal onClose={() => setGoalsOpen(false)} width="max-w-xl">
          <div className="p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#719078]">
                  Profil nutritionnel
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Objectifs d’Alexis</h2>
                <p className="mt-1 text-sm text-[#858e86]">
                  Ajuste les repères selon ton rythme et tes besoins.
                </p>
              </div>
              <button onClick={() => setGoalsOpen(false)} className="rounded-full bg-[#f1f3ef] p-2">
                <X size={17} />
              </button>
            </div>
            <div className="my-6 grid grid-cols-2 gap-3">
              {[
                ['Poids', 'weight', 'kg'],
                ['Taille', 'height', 'cm'],
              ].map(([label, key, unit]) => (
                <label key={key} className="rounded-2xl border border-[#dfe3dc] p-4">
                  <span className="text-xs text-[#7d867e]">{label}</span>
                  <span className="mt-1 flex items-baseline gap-1">
                    <input
                      type="number"
                      value={goals[key as keyof Goals]}
                      onChange={(event) =>
                        setGoals({ ...goals, [key]: Math.max(1, Number(event.target.value)) })
                      }
                      className="w-full min-w-0 bg-transparent text-xl font-semibold outline-none"
                    />
                    <span className="text-xs text-[#8d958e]">{unit}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mb-6 rounded-2xl bg-[#edf5ee] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#315c46]">
                <Sparkles size={16} />
                IMC estimé : {fmt(goals.weight / (goals.height / 100) ** 2, 1)}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#6c7d6f]">
                Ce repère est indicatif. Pour un objectif médical ou une perte de poids importante,
                demande conseil à un professionnel de santé.
              </p>
            </div>
            <h3 className="mb-3 text-sm font-semibold">Repères quotidiens</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Calories', 'calories', 'kcal'],
                ['Protéines', 'protein', 'g'],
                ['Glucides', 'carbs', 'g'],
                ['Lipides', 'fat', 'g'],
              ].map(([label, key, unit]) => (
                <label key={key} className="rounded-xl border border-[#dfe3dc] p-3">
                  <span className="block text-[10px] text-[#7d867e]">{label}</span>
                  <span className="mt-1 flex items-baseline gap-1">
                    <input
                      type="number"
                      value={goals[key as keyof Goals]}
                      onChange={(event) =>
                        setGoals({ ...goals, [key]: Math.max(1, Number(event.target.value)) })
                      }
                      className="w-full min-w-0 bg-transparent font-semibold outline-none"
                    />
                    <span className="text-[9px] text-[#9aa19b]">{unit}</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setGoalsOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#315c46] py-3 text-sm font-semibold text-white"
            >
              Enregistrer mes objectifs
            </button>
          </div>
        </Modal>
      )}

      {summary && (
        <SummaryModal
          summary={summary}
          dailyTotals={dailyTotals}
          weekTotal={weekTotal}
          goals={goals}
          entries={entries}
          foods={foods}
          onClose={() => setSummary(null)}
        />
      )}
    </main>
  )
}

function SummaryModal({
  summary,
  dailyTotals,
  weekTotal,
  goals,
  entries,
  foods,
  onClose,
}: {
  summary: { type: 'day' | 'week'; day?: number }
  dailyTotals: Nutrients[]
  weekTotal: Nutrients
  goals: Goals
  entries: MealEntry[]
  foods: PlannerFood[]
  onClose: () => void
}) {
  const isWeek = summary.type === 'week'
  const total = isWeek ? weekTotal : dailyTotals[summary.day ?? 0]
  const multiplier = isWeek ? 7 : 1
  const target = {
    calories: goals.calories * multiplier,
    protein: goals.protein * multiplier,
    carbs: goals.carbs * multiplier,
    fat: goals.fat * multiplier,
  }
  const percent = Math.round((total.calories / Math.max(1, target.calories)) * 100)
  const proteinGap = target.protein - total.protein
  const sugarHeavy = [...foods]
    .filter((food) => entries.some((entry) => entry.foodId === food.id))
    .sort((a, b) => b.sugar - a.sugar)[0]

  return (
    <Modal onClose={onClose} width="max-w-2xl">
      <div className="p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#73917a]">
              {isWeek ? 'Bilan sur 7 jours' : 'Bilan quotidien'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
              {isWeek ? 'Vue d’ensemble' : FULL_DAYS[summary.day ?? 0]}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#f1f3ef] p-2">
            <X size={17} />
          </button>
        </div>

        <div className="my-6 grid grid-cols-[1fr_auto] items-center gap-6 rounded-[22px] bg-[#315c46] p-5 text-white">
          <div>
            <p className="text-xs text-white/65">Énergie consommée</p>
            <p className="mt-1 text-4xl font-semibold tracking-[-0.05em]">
              {fmt(total.calories)}
              <span className="ml-2 text-sm font-normal text-white/60">/ {fmt(target.calories)} kcal</span>
            </p>
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-full border-[7px] border-white/20 text-lg font-bold">
            {percent}%
          </div>
        </div>

        {isWeek && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Objectif vs réalité</h3>
              <span className="flex items-center gap-1 text-[10px] text-[#8b948c]">
                <span className="h-2 w-2 rounded-full bg-[#315c46]" /> Consommé
              </span>
            </div>
            <div className="flex h-36 items-end gap-3 rounded-2xl border border-[#e1e5df] bg-[#fafbf8] px-4 pb-4 pt-6">
              {dailyTotals.map((day, index) => (
                <div key={DAYS[index]} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="flex flex-1 items-end justify-center">
                    <span
                      className="w-full max-w-8 rounded-t-md bg-[#6f9b7a]"
                      style={{ height: `${Math.min(100, (day.calories / goals.calories) * 100)}%` }}
                    />
                  </div>
                  <span className="text-center text-[9px] font-semibold text-[#858e86]">{DAYS[index]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <NutrientRows nutrients={total} />

        <div className="mt-6 rounded-2xl border border-[#dfe5dc] bg-[#f6f9f5] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#315c46]">
            <Sparkles size={16} />
            Suggestion personnalisée
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#657068]">
            {proteinGap > 8
              ? `Il manque environ ${fmt(proteinGap)} g de protéines pour atteindre l’objectif. Ajoute du saumon, des œufs ou du yaourt nature.`
              : percent > 110
                ? `L’apport énergétique dépasse l’objectif. Réduis légèrement les portions${sugarHeavy ? `, notamment ${sugarHeavy.name.toLocaleLowerCase('fr')}` : ''}, et ajoute des légumes.`
                : 'Le rythme est proche de l’objectif. Continue avec des portions régulières et une bonne variété de légumes.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

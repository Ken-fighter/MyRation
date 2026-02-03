import { Ingredient, MealRecord } from './types';

const STORAGE_KEYS = {
  INGREDIENTS: 'myration_ingredients',
  MEALS: 'myration_meals',
  GLOBAL_CREDITS: 'myration_global_credits',
  PENDING_MEAL: 'myration_pending_meal'
};

// 获取所有食材
export function getIngredients(): Ingredient[] {
  const data = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
  return data ? JSON.parse(data) : [];
}

// 保存所有食材
export function saveIngredients(ingredients: Ingredient[]): void {
  localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(ingredients));
}

// 添加食材
export function addIngredient(ingredient: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Ingredient {
  const ingredients = getIngredients();
  const newIngredient: Ingredient = {
    ...ingredient,
    id: `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  ingredients.push(newIngredient);
  saveIngredients(ingredients);
  return newIngredient;
}

// 批量添加食材
export function addIngredientsBatch(items: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>[]): Ingredient[] {
  const ingredients = getIngredients();
  const newIngredients: Ingredient[] = items.map((item, index) => ({
    ...item,
    id: `ing_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  ingredients.push(...newIngredients);
  saveIngredients(ingredients);
  return newIngredients;
}

// 更新食材
export function updateIngredient(id: string, updates: Partial<Ingredient>): Ingredient | null {
  const ingredients = getIngredients();
  const index = ingredients.findIndex(i => i.id === id);
  if (index === -1) return null;
  
  ingredients[index] = {
    ...ingredients[index],
    ...updates,
    updatedAt: Date.now()
  };
  saveIngredients(ingredients);
  return ingredients[index];
}

// 删除食材
export function deleteIngredient(id: string): boolean {
  const ingredients = getIngredients();
  const filtered = ingredients.filter(i => i.id !== id);
  if (filtered.length === ingredients.length) return false;
  saveIngredients(filtered);
  return true;
}

// 清空所有库存
export function clearAllIngredients(): void {
  saveIngredients([]);
}

// 获取用餐记录
export function getMealRecords(): MealRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.MEALS);
  return data ? JSON.parse(data) : [];
}

// 保存用餐记录
export function saveMealRecord(record: Omit<MealRecord, 'id'>): MealRecord {
  const records = getMealRecords();
  const newRecord: MealRecord = {
    ...record,
    id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  records.push(newRecord);
  localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(records));
  return newRecord;
}

// 获取全局顿数
export function getGlobalCredits(): number {
  const data = localStorage.getItem(STORAGE_KEYS.GLOBAL_CREDITS);
  return data ? parseInt(data, 10) : 6;
}

// 设置全局顿数
export function setGlobalCredits(credits: number): void {
  localStorage.setItem(STORAGE_KEYS.GLOBAL_CREDITS, credits.toString());
}

// 扣减库存和顿数
export function consumeIngredients(consumptions: { id: string; amount: number }[]): void {
  const ingredients = getIngredients();
  
  consumptions.forEach(({ id, amount }) => {
    const ingredient = ingredients.find(i => i.id === id);
    if (ingredient) {
      ingredient.quantity = Math.max(0, ingredient.quantity - amount);
      ingredient.remainingCredits = Math.max(0, ingredient.remainingCredits - 1);
      ingredient.updatedAt = Date.now();
      
      // 如果库存为0，移除该食材
      if (ingredient.quantity <= 0) {
        const index = ingredients.indexOf(ingredient);
        ingredients.splice(index, 1);
      }
    }
  });
  
  saveIngredients(ingredients);
}

// 获取待确认的上一餐
export function getPendingMeal(): RationResultForStorage[] | null {
  const data = localStorage.getItem(STORAGE_KEYS.PENDING_MEAL);
  return data ? JSON.parse(data) : null;
}

interface RationResultForStorage {
  ingredientId: string;
  ingredientName: string;
  suggestedAmount: number;
}

// 设置待确认的餐食
export function setPendingMeal(items: RationResultForStorage[] | null): void {
  if (items) {
    localStorage.setItem(STORAGE_KEYS.PENDING_MEAL, JSON.stringify(items));
  } else {
    localStorage.removeItem(STORAGE_KEYS.PENDING_MEAL);
  }
}

// 清除待确认餐食
export function clearPendingMeal(): void {
  localStorage.removeItem(STORAGE_KEYS.PENDING_MEAL);
}

import { Ingredient, MealPlan } from './types';

const STORAGE_KEYS = {
  INGREDIENTS: 'myration_ingredients',
  MEAL_PLANS: 'myration_meal_plans',
  LAST_MEAL_CONFIRMED: 'myration_last_meal_confirmed',
};

export const storage = {
  // 获取食材列表
  getIngredients(): Ingredient[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存食材列表
  saveIngredients(ingredients: Ingredient[]): void {
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(ingredients));
  },

  // 获取用餐计划
  getMealPlans(): MealPlan[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEAL_PLANS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // 保存用餐计划
  saveMealPlans(plans: MealPlan[]): void {
    localStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(plans));
  },

  // 获取上一餐确认状态
  getLastMealConfirmed(): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LAST_MEAL_CONFIRMED);
      return data ? JSON.parse(data) : true;
    } catch {
      return true;
    }
  },

  // 保存上一餐确认状态
  saveLastMealConfirmed(confirmed: boolean): void {
    localStorage.setItem(STORAGE_KEYS.LAST_MEAL_CONFIRMED, JSON.stringify(confirmed));
  },

  // 清空所有数据
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
    localStorage.removeItem(STORAGE_KEYS.MEAL_PLANS);
    localStorage.removeItem(STORAGE_KEYS.LAST_MEAL_CONFIRMED);
  },
};

import {
  Ingredient,
  MealIngredient,
  ShoppingItem,
  IngredientCategory,
  defaultIngredientParams,
  ingredientPairings,
  durableIngredients,
  ingredientAliases,
} from './types';

// ============ 别名识别函数 ============
// 用户输入"番茄"，自动识别为"西红柿"
export function normalizeIngredientName(input: string): string {
  const trimmed = input.trim();
  // 先查别名库
  if (ingredientAliases[trimmed]) {
    return ingredientAliases[trimmed];
  }
  // 没找到就返回原名
  return trimmed;
}

// ============ 获取食材入库天数 ============
export function getDaysSinceCreated(ingredient: Ingredient): number {
  const now = Date.now();
  const diffMs = now - ingredient.createdAt;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ============ 库存盘点警告 ============
export interface StockWarning {
  ingredient: Ingredient;
  type: 'expiring' | 'old' | 'opened';
  message: string;
  daysOld?: number;
}

export function getStockWarnings(ingredients: Ingredient[]): StockWarning[] {
  const warnings: StockWarning[] = [];
  
  for (const ing of ingredients) {
    const daysOld = getDaysSinceCreated(ing);
    const params = defaultIngredientParams[ing.name];
    const shelfLife = params?.shelfLife || 7;
    
    // 已切开的食材
    if (ing.status === 'opened') {
      warnings.push({
        ingredient: ing,
        type: 'opened',
        message: `${ing.name} 已切开，请尽快食用！`,
      });
    }
    // 剩余顿数<=1
    else if (ing.remainingCredits <= 1) {
      warnings.push({
        ingredient: ing,
        type: 'expiring',
        message: `${ing.name} 只剩 ${ing.remainingCredits} 顿的量，即将吃完！`,
      });
    }
    // 存放时间超过保质期的70%
    else if (daysOld >= shelfLife * 0.7) {
      warnings.push({
        ingredient: ing,
        type: 'old',
        daysOld,
        message: `${ing.name} 已存放 ${daysOld} 天，请优先食用！`,
      });
    }
  }
  
  // 按紧急程度排序：opened > expiring > old
  const priority = { opened: 0, expiring: 1, old: 2 };
  warnings.sort((a, b) => priority[a.type] - priority[b.type]);
  
  return warnings;
}

// ============ 智能补货计算 ============
export interface RestockResult {
  item: ShoppingItem;
  existingStock: number;
  existingUnit: string;
  needToBuy: number;
  totalNeeded: number;
}

export function calculateRestockList(
  wantedItems: string[], // 用户想买的食材
  existingIngredients: Ingredient[], // 现有库存
  existingCredits: number, // 现有剩余顿数
  additionalCredits: number, // 追加顿数
  perMealConfig: Record<string, number> = {} // 每顿消耗量配置
): RestockResult[] {
  const totalCredits = existingCredits + additionalCredits;
  const results: RestockResult[] = [];
  
  // 默认每顿消耗量
  const defaultPerMeal: Record<IngredientCategory, number> = {
    meat: 130,
    leafy: 150,
    mushroom: 80,
    root: 120,
    staple: 80,
    other: 100,
  };
  
  for (const itemName of wantedItems) {
    const normalizedName = normalizeIngredientName(itemName);
    const params = defaultIngredientParams[normalizedName];
    const category = params?.category || 'other';
    const unit = params?.unit || 'g';
    const unitWeight = params?.unitWeight || 100;
    
    // 计算每顿需要量
    const perMeal = perMealConfig[normalizedName] || defaultPerMeal[category];
    
    // 计算总需求
    let totalNeeded: number;
    if (unit === 'count') {
      // 按个数：总顿数 / 2（假设每顿用0.5个）或者更精细的计算
      totalNeeded = Math.ceil(totalCredits / 2);
    } else {
      // 按克数
      totalNeeded = perMeal * totalCredits;
    }
    
    // 查找现有库存
    const existing = existingIngredients.find(ing => ing.name === normalizedName);
    const existingQty = existing?.quantity || 0;
    
    // 计算需要购买的量
    let needToBuy = Math.max(0, totalNeeded - existingQty);
    
    // 如果是按个数，向上取整
    if (unit === 'count') {
      needToBuy = Math.ceil(needToBuy);
    } else {
      // 按克数，取整到50g
      needToBuy = Math.ceil(needToBuy / 50) * 50;
    }
    
    results.push({
      item: {
        name: normalizedName,
        category,
        suggestedAmount: needToBuy,
        unit,
        plannedCredits: additionalCredits,
        existingStock: existingQty,
      },
      existingStock: existingQty,
      existingUnit: unit === 'count' ? '个' : 'g',
      needToBuy,
      totalNeeded,
    });
  }
  
  return results;
}

// ============ 获取不建议购买的食材（库存里有的老食材）============
export function getDoNotBuyList(ingredients: Ingredient[]): Array<{name: string, reason: string}> {
  const doNotBuy: Array<{name: string, reason: string}> = [];
  
  for (const ing of ingredients) {
    const daysOld = getDaysSinceCreated(ing);
    const params = defaultIngredientParams[ing.name];
    const shelfLife = params?.shelfLife || 7;
    
    if (daysOld >= 3 || ing.status === 'opened' || ing.remainingCredits <= 2) {
      let reason = '';
      if (ing.status === 'opened') {
        reason = `已切开，请先吃完`;
      } else if (daysOld >= shelfLife * 0.5) {
        reason = `已存放${daysOld}天，请先吃掉`;
      } else if (ing.remainingCredits <= 2) {
        reason = `还剩${ing.quantity}${ing.unit === 'count' ? '个' : 'g'}，先吃完再买`;
      } else {
        reason = `冰箱里还有${ing.quantity}${ing.unit === 'count' ? '个' : 'g'}`;
      }
      
      doNotBuy.push({ name: ing.name, reason });
    }
  }
  
  return doNotBuy;
}

// ============ 解析用户输入 ============
export function parseIngredientInput(input: string): Array<{
  name: string;
  quantity: number;
  unit: 'g' | 'count';
}> {
  const results: Array<{ name: string; quantity: number; unit: 'g' | 'count' }> = [];
  
  // 支持多种分隔符
  const items = input.split(/[，,、\n]+/).filter(Boolean);
  
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    
    // 匹配模式：食材名 + 数量 + 单位
    // 例如：鸡胸肉800g, 西红柿3个, 鸡蛋10个
    const match = trimmed.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(g|克|个|根|包|把|颗)?$/);
    
    if (match) {
      const rawName = match[1].trim();
      const name = normalizeIngredientName(rawName); // 使用别名识别
      const quantity = parseFloat(match[2]);
      let unit: 'g' | 'count' = 'g';
      
      const unitStr = match[3];
      if (unitStr === '个' || unitStr === '根' || unitStr === '包' || unitStr === '把' || unitStr === '颗') {
        unit = 'count';
      } else {
        // 检查默认参数
        const params = defaultIngredientParams[name];
        if (params?.unit === 'count') {
          unit = 'count';
        }
      }
      
      results.push({ name, quantity, unit });
    } else {
      // 只有食材名，没有数量
      const name = normalizeIngredientName(trimmed);
      results.push({ name, quantity: 0, unit: 'g' });
    }
  }
  
  return results;
}

// ============ 弹性乱炖算法 ============
export function generateMealPlan(
  ingredients: Ingredient[],
  targetItemCount: 4 | 5
): MealIngredient[] {
  const selected: MealIngredient[] = [];
  const used = new Set<string>();
  
  // 按优先级排序的食材
  const sortedIngredients = [...ingredients].sort((a, b) => {
    // 1. 已切开的优先
    if (a.status === 'opened' && b.status !== 'opened') return -1;
    if (b.status === 'opened' && a.status !== 'opened') return 1;
    
    // 2. 剩余顿数少的优先
    if (a.remainingCredits !== b.remainingCredits) {
      return a.remainingCredits - b.remainingCredits;
    }
    
    // 3. 入库时间早的优先（越早入库越优先）
    return a.createdAt - b.createdAt;
  });
  
  // 辅助函数：计算建议用量
  const calculateAmount = (ing: Ingredient): number => {
    const effectiveStock = ing.quantity * (1 - ing.lossRate);
    let amount = effectiveStock / ing.remainingCredits;
    
    // 肉类限额：超过200g强制截断为150g
    if (ing.category === 'meat' && amount > 200) {
      amount = 150;
    }
    
    // 按个数的食材，取整
    if (ing.unit === 'count') {
      amount = Math.max(1, Math.round(amount));
    } else {
      amount = Math.round(amount / 10) * 10; // 四舍五入到10g
    }
    
    return amount;
  };
  
  // 辅助函数：添加食材到选品
  const addIngredient = (ing: Ingredient, reason: string) => {
    if (used.has(ing.id)) return false;
    used.add(ing.id);
    selected.push({
      ingredientId: ing.id,
      name: ing.name,
      suggestedAmount: calculateAmount(ing),
      unit: ing.unit,
      reason,
    });
    return true;
  };
  
  // Step 1: 强制位 - 已切开或即将过期的
  for (const ing of sortedIngredients) {
    if (selected.length >= targetItemCount) break;
    if (ing.status === 'opened') {
      addIngredient(ing, '已切开，必须用完');
    } else if (ing.remainingCredits <= 1) {
      addIngredient(ing, '即将吃完，优先使用');
    }
  }
  
  // Step 2: 核心位 - 确保有肉和叶菜
  const meats = sortedIngredients.filter(i => i.category === 'meat' && !used.has(i.id));
  const leafy = sortedIngredients.filter(i => i.category === 'leafy' && !used.has(i.id));
  
  if (meats.length > 0 && selected.length < targetItemCount) {
    const meat = meats[0];
    addIngredient(meat, '今日蛋白质来源');
  }
  
  if (leafy.length > 0 && selected.length < targetItemCount) {
    const leaf = leafy[0];
    addIngredient(leaf, '补充膳食纤维');
  }
  
  // Step 3: 填充位 - 根据CP搭配
  const selectedMeat = selected.find(s => {
    const ing = ingredients.find(i => i.id === s.ingredientId);
    return ing?.category === 'meat';
  });
  
  if (selectedMeat && selected.length < targetItemCount) {
    const pairings = ingredientPairings[selectedMeat.name] || [];
    for (const pairName of pairings) {
      if (selected.length >= targetItemCount) break;
      const pairIng = sortedIngredients.find(i => i.name === pairName && !used.has(i.id));
      if (pairIng) {
        addIngredient(pairIng, `与${selectedMeat.name}是绝配`);
      }
    }
  }
  
  // Step 4: 继续填充 - 菌菇类
  if (selected.length < targetItemCount) {
    const mushrooms = sortedIngredients.filter(i => i.category === 'mushroom' && !used.has(i.id));
    for (const m of mushrooms) {
      if (selected.length >= targetItemCount) break;
      addIngredient(m, '增鲜提味');
    }
  }
  
  // Step 5: 5品类时，从耐放食材中增补
  if (targetItemCount === 5 && selected.length < 5) {
    const durable = sortedIngredients.filter(
      i => durableIngredients.includes(i.name) && !used.has(i.id)
    );
    for (const d of durable) {
      if (selected.length >= 5) break;
      addIngredient(d, '耐放食材，均衡搭配');
    }
  }
  
  // Step 6: 还不够就随便选
  for (const ing of sortedIngredients) {
    if (selected.length >= targetItemCount) break;
    if (!used.has(ing.id)) {
      addIngredient(ing, '补充品类');
    }
  }
  
  return selected;
}

// ============ 生成购物建议 ============
export function generateShoppingList(
  wantedItems: string[],
  plannedCredits: number,
  existingIngredients: Ingredient[] = []
): ShoppingItem[] {
  const shoppingList: ShoppingItem[] = [];
  
  // 每顿平均消耗量（克）
  const perMealAmount: Record<IngredientCategory, number> = {
    meat: 130,
    leafy: 150,
    mushroom: 80,
    root: 120,
    staple: 80,
    other: 100,
  };
  
  for (const itemName of wantedItems) {
    const normalizedName = normalizeIngredientName(itemName);
    const params = defaultIngredientParams[normalizedName];
    const category = params?.category || 'other';
    const unit = params?.unit || 'g';
    const unitWeight = params?.unitWeight;
    const shelfLife = params?.shelfLife || 7;
    
    // 计算建议购买量
    let amount: number;
    const itemCredits = Math.min(plannedCredits, shelfLife); // 不要买超过保质期的量
    
    if (unit === 'count' && unitWeight) {
      // 按个数计算
      const totalGrams = perMealAmount[category] * itemCredits;
      amount = Math.ceil(totalGrams / unitWeight);
    } else {
      // 按克计算
      amount = perMealAmount[category] * itemCredits;
      // 向上取整到50g
      amount = Math.ceil(amount / 50) * 50;
    }
    
    // 检查现有库存
    const existing = existingIngredients.find(i => i.name === normalizedName);
    let warning: string | undefined;
    let existingStock: number | undefined;
    
    if (existing) {
      existingStock = existing.quantity;
      const daysOld = getDaysSinceCreated(existing);
      
      if (existing.status === 'opened') {
        warning = `⚠️ 已切开，请先吃完！`;
      } else if (daysOld >= 3) {
        warning = `⚠️ 已存放${daysOld}天，先吃掉再买！`;
      } else {
        warning = `冰箱里还有 ${existing.quantity}${unit === 'count' ? '个' : 'g'}`;
        // 减去已有库存
        if (unit === 'count') {
          amount = Math.max(0, amount - existing.quantity);
        } else {
          amount = Math.max(0, amount - existing.quantity);
          amount = Math.ceil(amount / 50) * 50;
        }
      }
    }
    
    shoppingList.push({
      name: normalizedName,
      category,
      suggestedAmount: amount,
      unit,
      plannedCredits: itemCredits,
      existingStock,
      warning,
    });
  }
  
  return shoppingList;
}

// ============ 计算最大剩余顿数 ============
export function getMaxRemainingCredits(ingredients: Ingredient[]): number {
  if (ingredients.length === 0) return 0;
  return Math.max(...ingredients.map(i => i.remainingCredits));
}

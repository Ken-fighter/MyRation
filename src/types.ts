// 食材类型
export interface Ingredient {
  id: string;
  name: string;
  category: 'meat' | 'leafy' | 'mushroom' | 'root' | 'staple' | 'other';
  quantity: number; // 克或个
  unit: 'g' | 'count';
  remainingCredits: number; // 剩余顿数
  isOpened: boolean; // 是否已切开
  lossRate: number; // 损耗系数 (0-1)
  createdAt: number;
  updatedAt: number;
}

// 品类中文映射
export const categoryLabels: Record<Ingredient['category'], string> = {
  meat: '🥩 肉类',
  leafy: '🥬 叶菜',
  mushroom: '🍄 菌菇',
  root: '🥕 根茎',
  staple: '🍜 主食',
  other: '🥗 其他'
};

// 品类颜色
export const categoryColors: Record<Ingredient['category'], string> = {
  meat: 'bg-red-100 text-red-700 border-red-200',
  leafy: 'bg-green-100 text-green-700 border-green-200',
  mushroom: 'bg-amber-100 text-amber-700 border-amber-200',
  root: 'bg-orange-100 text-orange-700 border-orange-200',
  staple: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  other: 'bg-purple-100 text-purple-700 border-purple-200'
};

// 配给结果
export interface RationResult {
  ingredient: Ingredient;
  suggestedAmount: number;
  reason: string;
  priority: 'critical' | 'base' | 'filler' | 'bonus';
}

// 用餐记录
export interface MealRecord {
  id: string;
  timestamp: number;
  items: {
    ingredientId: string;
    ingredientName: string;
    plannedAmount: number;
    actualAmount: number;
  }[];
  status: 'completed' | 'skipped' | 'modified';
}

// 常见食材默认参数 (包含推荐单位)
export const defaultIngredientParams: Record<string, { 
  category: Ingredient['category']; 
  lossRate: number;
  unit: 'g' | 'count';
  countWeight?: number; // 每个的参考重量(克)，用于按个数计算时估算
}> = {
  // 肉类 - 通常按克
  '鸡胸肉': { category: 'meat', lossRate: 0.05, unit: 'g' },
  '猪肉': { category: 'meat', lossRate: 0.1, unit: 'g' },
  '牛肉': { category: 'meat', lossRate: 0.08, unit: 'g' },
  '鸡腿': { category: 'meat', lossRate: 0.15, unit: 'count', countWeight: 150 },
  '五花肉': { category: 'meat', lossRate: 0.1, unit: 'g' },
  
  // 叶菜 - 通常按克
  '菠菜': { category: 'leafy', lossRate: 0.15, unit: 'g' },
  '娃娃菜': { category: 'leafy', lossRate: 0.1, unit: 'count', countWeight: 300 },
  '生菜': { category: 'leafy', lossRate: 0.15, unit: 'g' },
  '白菜': { category: 'leafy', lossRate: 0.1, unit: 'g' },
  '青菜': { category: 'leafy', lossRate: 0.12, unit: 'g' },
  '油麦菜': { category: 'leafy', lossRate: 0.12, unit: 'g' },
  '小白菜': { category: 'leafy', lossRate: 0.12, unit: 'g' },
  
  // 菌菇 - 通常按包/克
  '金针菇': { category: 'mushroom', lossRate: 0.05, unit: 'g' },
  '香菇': { category: 'mushroom', lossRate: 0.05, unit: 'g' },
  '平菇': { category: 'mushroom', lossRate: 0.08, unit: 'g' },
  '杏鲍菇': { category: 'mushroom', lossRate: 0.05, unit: 'count', countWeight: 100 },
  
  // 根茎类 - 很多按个数更方便
  '西红柿': { category: 'root', lossRate: 0.05, unit: 'count', countWeight: 150 },
  '番茄': { category: 'root', lossRate: 0.05, unit: 'count', countWeight: 150 },
  '胡萝卜': { category: 'root', lossRate: 0.08, unit: 'count', countWeight: 150 },
  '土豆': { category: 'root', lossRate: 0.1, unit: 'count', countWeight: 200 },
  '南瓜': { category: 'root', lossRate: 0.15, unit: 'g' }, // 南瓜太大，按克
  '西葫芦': { category: 'root', lossRate: 0.1, unit: 'count', countWeight: 300 },
  '萝卜': { category: 'root', lossRate: 0.08, unit: 'count', countWeight: 400 },
  '红薯': { category: 'root', lossRate: 0.08, unit: 'count', countWeight: 250 },
  '山药': { category: 'root', lossRate: 0.1, unit: 'g' },
  '洋葱': { category: 'root', lossRate: 0.05, unit: 'count', countWeight: 200 },
  '黄瓜': { category: 'root', lossRate: 0.05, unit: 'count', countWeight: 200 },
  '茄子': { category: 'root', lossRate: 0.08, unit: 'count', countWeight: 250 },
  '青椒': { category: 'root', lossRate: 0.05, unit: 'count', countWeight: 100 },
  '玉米': { category: 'root', lossRate: 0.3, unit: 'count', countWeight: 200 },
  
  // 主食 - 按克
  '荞麦面': { category: 'staple', lossRate: 0, unit: 'g' },
  '米饭': { category: 'staple', lossRate: 0, unit: 'g' },
  '面条': { category: 'staple', lossRate: 0, unit: 'g' },
  '挂面': { category: 'staple', lossRate: 0, unit: 'g' },
  
  // 其他 - 蛋类按个数
  '豆腐': { category: 'other', lossRate: 0.05, unit: 'count', countWeight: 400 },
  '鸡蛋': { category: 'other', lossRate: 0, unit: 'count', countWeight: 50 },
  '鹌鹑蛋': { category: 'other', lossRate: 0, unit: 'count', countWeight: 11 },
};

// CP搭配库 (黄金搭配)
export const flavorPairings: Record<string, string[]> = {
  '鸡胸肉': ['金针菇', '香菇', '西葫芦', '娃娃菜', '西红柿'],
  '猪肉': ['白菜', '土豆', '香菇', '胡萝卜', '西红柿'],
  '牛肉': ['土豆', '胡萝卜', '西红柿', '洋葱'],
  '鸡腿': ['香菇', '土豆', '胡萝卜', '西红柿'],
  '五花肉': ['土豆', '豆腐', '白菜', '香菇'],
};

// 耐放食材列表 (可以放久一点的)
export const durableIngredients = ['胡萝卜', '土豆', '南瓜', '红薯', '山药', '洋葱', '西红柿', '茄子', '玉米'];

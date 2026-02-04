// 食材分类
export type IngredientCategory = 'meat' | 'leafy' | 'mushroom' | 'root' | 'staple' | 'other';

// 食材单位
export type IngredientUnit = 'g' | 'count';

// 食材状态
export type IngredientStatus = 'fresh' | 'opened' | 'expiring';

// 食材
export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: IngredientUnit;
  remainingCredits: number; // 剩余顿数
  status: IngredientStatus;
  lossRate: number; // 损耗系数 (0-1)
  createdAt: number; // 入库时间戳
  updatedAt: number;
}

// 一顿饭的配给
export interface MealPlan {
  id: string;
  ingredients: MealIngredient[];
  targetItemCount: 4 | 5;
  createdAt: number;
  completedAt?: number;
  status: 'planned' | 'completed' | 'skipped' | 'modified';
}

// 配给中的食材
export interface MealIngredient {
  ingredientId: string;
  name: string;
  suggestedAmount: number;
  actualAmount?: number;
  unit: IngredientUnit;
  reason: string;
}

// 购物清单项
export interface ShoppingItem {
  name: string;
  category: IngredientCategory;
  suggestedAmount: number;
  unit: IngredientUnit;
  plannedCredits: number;
  existingStock?: number; // 现有库存
  warning?: string; // 警告信息
}

// 食材默认参数
export interface IngredientParams {
  category: IngredientCategory;
  lossRate: number;
  unit: IngredientUnit;
  unitWeight?: number; // 每个的克数（用于按个数计算的食材）
  shelfLife?: number; // 保质期（顿数）
}

// ============ 食材别名库 ============
// 用户可能输入不同的名字，我们统一识别
export const ingredientAliases: Record<string, string> = {
  // 肉类别名
  '鸡肉': '鸡胸肉',
  '鸡脯肉': '鸡胸肉',
  '鸡胸': '鸡胸肉',
  '猪里脊': '猪肉',
  '瘦肉': '猪肉',
  '肉丝': '猪肉',
  '肉片': '猪肉',
  '牛腩': '牛肉',
  '肥牛': '牛肉',
  '牛肉片': '牛肉',
  
  // 蔬菜别名
  '番茄': '西红柿',
  '圣女果': '西红柿',
  '小番茄': '西红柿',
  '大白菜': '白菜',
  '卷心菜': '包菜',
  '圆白菜': '包菜',
  '甘蓝': '包菜',
  '青瓜': '黄瓜',
  '胡瓜': '黄瓜',
  '西葫': '西葫芦',
  '角瓜': '西葫芦',
  '红萝卜': '胡萝卜',
  '甘荀': '胡萝卜',
  '洋芋': '土豆',
  '马铃薯': '土豆',
  '地瓜': '红薯',
  '番薯': '红薯',
  '上海青': '青菜',
  '小青菜': '青菜',
  '鸡毛菜': '青菜',
  '菜心': '青菜',
  '奶白菜': '小白菜',
  
  // 菌菇别名
  '蘑菇': '平菇',
  '鲜菇': '香菇',
  '花菇': '香菇',
  '金针菜': '金针菇',
  '木耳': '黑木耳',
  
  // 主食别名
  '面': '面条',
  '挂面': '面条',
  '荞麦': '荞麦面',
  '米': '米饭',
  '大米': '米饭',
  
  // 其他
  '蛋': '鸡蛋',
  '鸡子': '鸡蛋',
};

// ============ 食材默认参数库（扩展版）============
export const defaultIngredientParams: Record<string, IngredientParams> = {
  // ===== 肉类 =====
  '鸡胸肉': { category: 'meat', lossRate: 0.05, unit: 'g', shelfLife: 8 },
  '鸡腿': { category: 'meat', lossRate: 0.08, unit: 'g', shelfLife: 8 },
  '鸡翅': { category: 'meat', lossRate: 0.05, unit: 'count', unitWeight: 50, shelfLife: 8 },
  '猪肉': { category: 'meat', lossRate: 0.05, unit: 'g', shelfLife: 8 },
  '五花肉': { category: 'meat', lossRate: 0.08, unit: 'g', shelfLife: 8 },
  '排骨': { category: 'meat', lossRate: 0.1, unit: 'g', shelfLife: 8 },
  '牛肉': { category: 'meat', lossRate: 0.05, unit: 'g', shelfLife: 6 },
  '羊肉': { category: 'meat', lossRate: 0.05, unit: 'g', shelfLife: 6 },
  '虾': { category: 'meat', lossRate: 0.2, unit: 'g', shelfLife: 4 },
  '虾仁': { category: 'meat', lossRate: 0.05, unit: 'g', shelfLife: 4 },
  '鱼': { category: 'meat', lossRate: 0.15, unit: 'g', shelfLife: 4 },
  
  // ===== 叶菜类（不耐放）=====
  '菠菜': { category: 'leafy', lossRate: 0.15, unit: 'g', shelfLife: 3 },
  '生菜': { category: 'leafy', lossRate: 0.15, unit: 'g', shelfLife: 3 },
  '油麦菜': { category: 'leafy', lossRate: 0.15, unit: 'g', shelfLife: 3 },
  '娃娃菜': { category: 'leafy', lossRate: 0.1, unit: 'g', shelfLife: 5 },
  '白菜': { category: 'leafy', lossRate: 0.1, unit: 'g', shelfLife: 7 },
  '小白菜': { category: 'leafy', lossRate: 0.12, unit: 'g', shelfLife: 4 },
  '青菜': { category: 'leafy', lossRate: 0.12, unit: 'g', shelfLife: 4 },
  '包菜': { category: 'leafy', lossRate: 0.08, unit: 'g', shelfLife: 7 },
  '空心菜': { category: 'leafy', lossRate: 0.15, unit: 'g', shelfLife: 3 },
  '芹菜': { category: 'leafy', lossRate: 0.12, unit: 'g', shelfLife: 5 },
  '韭菜': { category: 'leafy', lossRate: 0.12, unit: 'g', shelfLife: 4 },
  '茼蒿': { category: 'leafy', lossRate: 0.15, unit: 'g', shelfLife: 3 },
  
  // ===== 菌菇类 =====
  '金针菇': { category: 'mushroom', lossRate: 0.05, unit: 'g', shelfLife: 5 },
  '香菇': { category: 'mushroom', lossRate: 0.08, unit: 'g', shelfLife: 6 },
  '平菇': { category: 'mushroom', lossRate: 0.08, unit: 'g', shelfLife: 5 },
  '杏鲍菇': { category: 'mushroom', lossRate: 0.05, unit: 'g', shelfLife: 7 },
  '海鲜菇': { category: 'mushroom', lossRate: 0.05, unit: 'g', shelfLife: 5 },
  '茶树菇': { category: 'mushroom', lossRate: 0.05, unit: 'g', shelfLife: 7 },
  '黑木耳': { category: 'mushroom', lossRate: 0.05, unit: 'g', shelfLife: 10 },
  
  // ===== 根茎瓜果类（耐放）=====
  '西红柿': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 150, shelfLife: 6 },
  '黄瓜': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 200, shelfLife: 5 },
  '西葫芦': { category: 'root', lossRate: 0.1, unit: 'g', shelfLife: 7 },
  '茄子': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 200, shelfLife: 6 },
  '胡萝卜': { category: 'root', lossRate: 0.1, unit: 'count', unitWeight: 150, shelfLife: 14 },
  '土豆': { category: 'root', lossRate: 0.12, unit: 'g', shelfLife: 14 },
  '红薯': { category: 'root', lossRate: 0.1, unit: 'g', shelfLife: 14 },
  '南瓜': { category: 'root', lossRate: 0.15, unit: 'g', shelfLife: 14 },
  '冬瓜': { category: 'root', lossRate: 0.15, unit: 'g', shelfLife: 10 },
  '洋葱': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 200, shelfLife: 21 },
  '青椒': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 80, shelfLife: 7 },
  '彩椒': { category: 'root', lossRate: 0.08, unit: 'count', unitWeight: 150, shelfLife: 7 },
  '莲藕': { category: 'root', lossRate: 0.12, unit: 'g', shelfLife: 7 },
  '山药': { category: 'root', lossRate: 0.1, unit: 'g', shelfLife: 10 },
  '萝卜': { category: 'root', lossRate: 0.1, unit: 'g', shelfLife: 10 },
  '玉米': { category: 'root', lossRate: 0.2, unit: 'count', unitWeight: 250, shelfLife: 5 },
  '豆角': { category: 'root', lossRate: 0.08, unit: 'g', shelfLife: 5 },
  '四季豆': { category: 'root', lossRate: 0.08, unit: 'g', shelfLife: 5 },
  '花菜': { category: 'root', lossRate: 0.15, unit: 'g', shelfLife: 6 },
  '西兰花': { category: 'root', lossRate: 0.15, unit: 'g', shelfLife: 5 },
  
  // ===== 主食类 =====
  '荞麦面': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 30 },
  '面条': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 30 },
  '米饭': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 30 },
  '意面': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 30 },
  '年糕': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 14 },
  '粉丝': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 30 },
  '河粉': { category: 'staple', lossRate: 0.02, unit: 'g', shelfLife: 5 },
  '馒头': { category: 'staple', lossRate: 0.02, unit: 'count', unitWeight: 80, shelfLife: 5 },
  
  // ===== 其他 =====
  '豆腐': { category: 'other', lossRate: 0.05, unit: 'g', shelfLife: 4 },
  '豆腐皮': { category: 'other', lossRate: 0.03, unit: 'g', shelfLife: 5 },
  '腐竹': { category: 'other', lossRate: 0.02, unit: 'g', shelfLife: 14 },
  '鸡蛋': { category: 'other', lossRate: 0.02, unit: 'count', unitWeight: 50, shelfLife: 21 },
  '鹌鹑蛋': { category: 'other', lossRate: 0.02, unit: 'count', unitWeight: 11, shelfLife: 21 },
};

// ============ CP搭配库（什么食材搭配什么好吃）============
export const ingredientPairings: Record<string, string[]> = {
  '鸡胸肉': ['金针菇', '香菇', '西兰花', '青椒'],
  '猪肉': ['青椒', '土豆', '豆角', '白菜'],
  '牛肉': ['土豆', '胡萝卜', '西红柿', '洋葱'],
  '虾': ['西兰花', '豆腐', '黄瓜'],
  '鸡蛋': ['西红柿', '韭菜', '青椒', '黄瓜'],
  '豆腐': ['香菇', '白菜', '菠菜'],
};

// ============ 耐放食材列表（5品类时优先从这里选）============
export const durableIngredients = [
  '胡萝卜', '土豆', '南瓜', '洋葱', '红薯', '山药', '萝卜',
  '包菜', '白菜', '冬瓜'
];

// ============ 分类显示名称 ============
export const categoryNames: Record<IngredientCategory, string> = {
  meat: '🥩 肉类',
  leafy: '🥬 叶菜',
  mushroom: '🍄 菌菇',
  root: '🥕 根茎瓜果',
  staple: '🍜 主食',
  other: '🥗 其他',
};

// ============ 分类颜色 ============
export const categoryColors: Record<IngredientCategory, string> = {
  meat: 'bg-red-100 text-red-800',
  leafy: 'bg-green-100 text-green-800',
  mushroom: 'bg-amber-100 text-amber-800',
  root: 'bg-orange-100 text-orange-800',
  staple: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
};

import { Ingredient, RationResult, flavorPairings, durableIngredients, defaultIngredientParams } from './types';

/**
 * 弹性乱炖配给算法 (Flexible Stew Algorithm)
 * 
 * 选品优先级逻辑：
 * 1. 强制位 (Critical): Status = Opened 或 Credits <= 1 的食材必须入选
 * 2. 核心位 (Base): 必须包含 1 种肉类 + 1 种叶菜
 * 3. 填充位 (Filler): 根据 CP 库补足剩余名额
 * 4. 弹性控制: 如果用户选 5 品类，从耐放食材中增补 1 样
 * 
 * 克数计算公式：
 * 单品建议量 = 该品类当前库存 * (1 - 损耗系数) / 该品类剩余顿数
 * 注：若计算出的肉类 > 200g，强制截断为 150g
 */
export function calculateRation(
  ingredients: Ingredient[],
  targetItemCount: 4 | 5
): RationResult[] {
  const results: RationResult[] = [];
  const selectedIds = new Set<string>();

  // 过滤有库存的食材
  const availableIngredients = ingredients.filter(i => i.quantity > 0 && i.remainingCredits > 0);

  if (availableIngredients.length === 0) {
    return [];
  }

  // 1. 强制位 (Critical) - 已切开或即将过期的食材
  const criticalItems = availableIngredients.filter(
    i => i.isOpened || i.remainingCredits <= 1
  );

  criticalItems.forEach(item => {
    if (results.length < targetItemCount && !selectedIds.has(item.id)) {
      const amount = calculateAmount(item);
      results.push({
        ingredient: item,
        suggestedAmount: amount,
        reason: item.isOpened ? '已切开，需优先使用' : '剩余顿数不足，需尽快消耗',
        priority: 'critical'
      });
      selectedIds.add(item.id);
    }
  });

  // 2. 核心位 (Base) - 确保有肉类和叶菜
  const hasMeat = results.some(r => r.ingredient.category === 'meat');
  const hasLeafy = results.some(r => r.ingredient.category === 'leafy');

  if (!hasMeat) {
    const meat = availableIngredients.find(
      i => i.category === 'meat' && !selectedIds.has(i.id)
    );
    if (meat && results.length < targetItemCount) {
      const amount = calculateAmount(meat);
      results.push({
        ingredient: meat,
        suggestedAmount: amount,
        reason: '肉类核心食材',
        priority: 'base'
      });
      selectedIds.add(meat.id);
    }
  }

  if (!hasLeafy) {
    // 优先选择剩余顿数少的叶菜
    const leafyOptions = availableIngredients
      .filter(i => i.category === 'leafy' && !selectedIds.has(i.id))
      .sort((a, b) => a.remainingCredits - b.remainingCredits);
    
    if (leafyOptions.length > 0 && results.length < targetItemCount) {
      const leafy = leafyOptions[0];
      const amount = calculateAmount(leafy);
      results.push({
        ingredient: leafy,
        suggestedAmount: amount,
        reason: leafy.remainingCredits <= 2 ? '不耐放，需优先消耗' : '叶菜核心食材',
        priority: 'base'
      });
      selectedIds.add(leafy.id);
    }
  }

  // 3. 填充位 (Filler) - 根据 CP 库补足
  const selectedMeat = results.find(r => r.ingredient.category === 'meat');
  if (selectedMeat) {
    const pairings = flavorPairings[selectedMeat.ingredient.name] || [];
    for (const pairingName of pairings) {
      if (results.length >= targetItemCount - (targetItemCount === 5 ? 1 : 0)) break;
      
      const pairedItem = availableIngredients.find(
        i => i.name === pairingName && !selectedIds.has(i.id)
      );
      if (pairedItem) {
        const amount = calculateAmount(pairedItem);
        results.push({
          ingredient: pairedItem,
          suggestedAmount: amount,
          reason: `与${selectedMeat.ingredient.name}是黄金搭配`,
          priority: 'filler'
        });
        selectedIds.add(pairedItem.id);
      }
    }
  }

  // 补足剩余位置（非主食）
  const remaining = availableIngredients
    .filter(i => !selectedIds.has(i.id) && i.category !== 'staple')
    .sort((a, b) => a.remainingCredits - b.remainingCredits);

  for (const item of remaining) {
    if (results.length >= targetItemCount - (targetItemCount === 5 ? 1 : 0)) break;
    
    const amount = calculateAmount(item);
    results.push({
      ingredient: item,
      suggestedAmount: amount,
      reason: '填充食材',
      priority: 'filler'
    });
    selectedIds.add(item.id);
  }

  // 4. 弹性控制 - 5品类时从耐放食材增补
  if (targetItemCount === 5 && results.length < 5) {
    const durableItem = availableIngredients.find(
      i => durableIngredients.includes(i.name) && !selectedIds.has(i.id)
    );
    if (durableItem) {
      const amount = calculateAmount(durableItem);
      results.push({
        ingredient: durableItem,
        suggestedAmount: amount,
        reason: '耐放食材，增加丰富度',
        priority: 'bonus'
      });
      selectedIds.add(durableItem.id);
    } else {
      // 如果没有耐放食材，随便补一个
      const anyItem = availableIngredients.find(
        i => !selectedIds.has(i.id) && i.category !== 'staple'
      );
      if (anyItem) {
        const amount = calculateAmount(anyItem);
        results.push({
          ingredient: anyItem,
          suggestedAmount: amount,
          reason: '额外补充',
          priority: 'bonus'
        });
      }
    }
  }

  // 最后添加主食
  const staple = availableIngredients.find(
    i => i.category === 'staple' && !selectedIds.has(i.id)
  );
  if (staple) {
    results.push({
      ingredient: staple,
      suggestedAmount: 80, // 主食固定80g
      reason: '主食',
      priority: 'base'
    });
  }

  return results;
}

/**
 * 计算单品建议量
 * 公式: 单品建议量 = 该品类当前库存 * (1 - 损耗系数) / 该品类剩余顿数
 * 肉类超过200g时截断为150g
 * 按个数的食材会计算出建议使用几个
 */
function calculateAmount(ingredient: Ingredient): number {
  const effectiveStock = ingredient.quantity * (1 - ingredient.lossRate);
  let amount = effectiveStock / ingredient.remainingCredits;

  if (ingredient.unit === 'count') {
    // 按个数的食材，向上取整确保每顿至少1个
    amount = Math.max(1, Math.ceil(amount));
    
    // 如果库存不够每顿1个，就用完
    if (amount > ingredient.quantity) {
      amount = ingredient.quantity;
    }
  } else {
    // 按克的食材
    amount = Math.round(amount);
    
    // 肉类限制: 超过200g截断为150g
    if (ingredient.category === 'meat' && amount > 200) {
      amount = 150;
    }

    // 最小量保证
    if (amount < 20) {
      amount = 20;
    }
  }

  return amount;
}

/**
 * 计算购买建议
 * 根据计划顿数和每顿需求量，反推应该购买的量
 * 支持按个数或按克的食材
 */
export function calculateShoppingList(
  plannedItems: { name: string; credits: number }[],
  _totalCredits: number
): { name: string; suggestedAmount: number; unit: string; note: string }[] {
  return plannedItems.map(item => {
    const defaultUnit = getDefaultUnit(item.name);
    let perMealAmount: number;
    let unit: string;
    let note = '';

    if (defaultUnit === 'count') {
      // 按个数的食材
      unit = '个';
      perMealAmount = 1; // 默认每顿1个
      
      // 根据食材类型调整
      if (item.name.includes('蛋') && !item.name.includes('鹌鹑')) {
        perMealAmount = 2;
        note = '鸡蛋每顿约2个';
      } else if (item.name.includes('鹌鹑蛋')) {
        perMealAmount = 5;
        note = '鹌鹑蛋每顿约5个';
      } else if (item.name.includes('西红柿') || item.name.includes('番茄')) {
        perMealAmount = 1;
        note = '每顿1个';
      } else if (item.name.includes('土豆') || item.name.includes('红薯')) {
        perMealAmount = 1;
        note = '每顿1个，选中等大小的';
      }
      
      const suggestedAmount = Math.ceil(perMealAmount * item.credits);
      return { name: item.name, suggestedAmount, unit, note };
    } else {
      // 按克的食材
      unit = 'g';
      perMealAmount = 120; // 默认值

      // 根据食材名称判断类型并调整
      if (item.name.includes('肉') || item.name.includes('鸡') || item.name.includes('牛') || item.name.includes('猪')) {
        perMealAmount = 130;
        note = `约 ${Math.ceil((perMealAmount * item.credits) / 300)} 块`;
      } else if (item.name.includes('菠菜') || item.name.includes('生菜') || item.name.includes('油麦菜')) {
        perMealAmount = 150;
        note = `约 1 大把。注意：${item.name}只能撑 ${item.credits} 顿，别买多`;
      } else if (item.name.includes('菇')) {
        perMealAmount = 80;
        note = '约 1 包';
      } else if (item.name.includes('面') || item.name.includes('米')) {
        perMealAmount = 80;
        note = '主食';
      }

      const suggestedAmount = perMealAmount * item.credits;
      return { name: item.name, suggestedAmount, unit, note };
    }
  });
}

/**
 * 解析批量输入文本
 * 支持格式: 
 *   - "鸡胸肉800g，娃娃菜600g，菠菜500g"
 *   - "西红柿3个，鸡蛋6个"
 *   - "鸡胸肉 800g\n娃娃菜 600g"
 *   - 混合: "鸡胸肉800g，西红柿3个，菠菜500g"
 */
export function parseBatchInput(text: string): { name: string; quantity: number; unit: 'g' | 'count' }[] {
  const results: { name: string; quantity: number; unit: 'g' | 'count' }[] = [];
  
  // 分隔符: 逗号、顿号、换行、分号
  const items = text.split(/[,，、\n;；]+/).map(s => s.trim()).filter(Boolean);
  
  for (const item of items) {
    // 匹配模式: 食材名 + 数字 + 单位(可选)
    const match = item.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(g|克|个|只|颗|根|块)?$/i);
    if (match) {
      const name = match[1].trim();
      const quantity = parseFloat(match[2]);
      const unitStr = (match[3] || '').toLowerCase();
      
      // 判断单位
      let unit: 'g' | 'count';
      if (unitStr === '个' || unitStr === '只' || unitStr === '颗' || unitStr === '根' || unitStr === '块') {
        // 用户明确指定了个数单位
        unit = 'count';
      } else if (unitStr === 'g' || unitStr === '克') {
        // 用户明确指定了克
        unit = 'g';
      } else {
        // 没有指定单位，根据食材名自动判断
        unit = getDefaultUnit(name);
      }
      
      if (name && quantity > 0) {
        results.push({ name, quantity, unit });
      }
    }
  }
  
  return results;
}

/**
 * 根据食材名获取默认单位
 * 西红柿、鸡蛋、土豆等按个数更方便的食材会返回 'count'
 */
export function getDefaultUnit(ingredientName: string): 'g' | 'count' {
  // 首先检查是否在默认参数库中
  for (const [name, params] of Object.entries(defaultIngredientParams)) {
    if (ingredientName.includes(name) || name.includes(ingredientName)) {
      return params.unit;
    }
  }
  
  // 模糊匹配一些常见按个数的食材
  const countBasedPatterns = [
    '蛋', '西红柿', '番茄', '土豆', '洋葱', '胡萝卜', '黄瓜', 
    '茄子', '青椒', '辣椒', '玉米', '红薯', '紫薯', '西葫芦',
    '萝卜', '豆腐', '娃娃菜', '杏鲍菇'
  ];
  
  for (const pattern of countBasedPatterns) {
    if (ingredientName.includes(pattern)) {
      return 'count';
    }
  }
  
  // 默认按克
  return 'g';
}

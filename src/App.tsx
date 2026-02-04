import { useState, useEffect } from 'react';
import {
  Ingredient,
  MealPlan,
  MealIngredient,
  ShoppingItem,
  IngredientCategory,
  categoryNames,
  categoryColors,
  defaultIngredientParams,
} from './types';
import {
  generateMealPlan,
  generateShoppingList,
  getMaxRemainingCredits,
  parseIngredientInput,
  normalizeIngredientName,
  getStockWarnings,
  getDoNotBuyList,
  StockWarning,
} from './algorithm';
import { storage } from './store';
import { cn } from './utils/cn';

type ViewType = 'home' | 'stock' | 'cook' | 'shop';

// ============ 主应用 ============
export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [lastMealConfirmed, setLastMealConfirmed] = useState(true);

  // 加载数据
  useEffect(() => {
    setIngredients(storage.getIngredients());
    setMealPlans(storage.getMealPlans());
    setLastMealConfirmed(storage.getLastMealConfirmed());
  }, []);

  // 保存食材
  const saveIngredients = (newIngredients: Ingredient[]) => {
    setIngredients(newIngredients);
    storage.saveIngredients(newIngredients);
  };

  // 保存用餐计划
  const saveMealPlans = (newPlans: MealPlan[]) => {
    setMealPlans(newPlans);
    storage.saveMealPlans(newPlans);
  };

  // 确认上一餐
  const confirmLastMeal = (action: 'completed' | 'skipped' | 'modified', modifications?: Record<string, number>) => {
    if (action === 'completed') {
      // 按计划执行，扣减库存
      const lastPlan = mealPlans[mealPlans.length - 1];
      if (lastPlan && lastPlan.status === 'planned') {
        const updatedIngredients = ingredients.map(ing => {
          const mealIng = lastPlan.ingredients.find(mi => mi.ingredientId === ing.id);
          if (mealIng) {
            return {
              ...ing,
              quantity: Math.max(0, ing.quantity - mealIng.suggestedAmount),
              remainingCredits: Math.max(0, ing.remainingCredits - 1),
            };
          }
          return ing;
        }).filter(ing => ing.quantity > 0);
        
        saveIngredients(updatedIngredients);
        
        const updatedPlans = mealPlans.map(p => 
          p.id === lastPlan.id ? { ...p, status: 'completed' as const, completedAt: Date.now() } : p
        );
        saveMealPlans(updatedPlans);
      }
    } else if (action === 'modified' && modifications) {
      // 手动修正
      const updatedIngredients = ingredients.map(ing => {
        const actualAmount = modifications[ing.id];
        if (actualAmount !== undefined) {
          return {
            ...ing,
            quantity: Math.max(0, ing.quantity - actualAmount),
            remainingCredits: Math.max(0, ing.remainingCredits - 1),
          };
        }
        return ing;
      }).filter(ing => ing.quantity > 0);
      
      saveIngredients(updatedIngredients);
    }
    
    setLastMealConfirmed(true);
    storage.saveLastMealConfirmed(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* 顶部标题 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            🍲 MyRation
          </h1>
          <p className="text-center text-gray-500 text-sm">智能食材配给系统</p>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {currentView === 'home' && (
          <HomeView 
            ingredients={ingredients}
            lastMealConfirmed={lastMealConfirmed}
            onConfirmMeal={confirmLastMeal}
          />
        )}
        {currentView === 'stock' && (
          <StockView 
            ingredients={ingredients}
            onSave={saveIngredients}
          />
        )}
        {currentView === 'cook' && (
          <CookView 
            ingredients={ingredients}
            onSaveIngredients={saveIngredients}
            onSaveMealPlan={(plan) => saveMealPlans([...mealPlans, plan])}
          />
        )}
        {currentView === 'shop' && (
          <ShopView ingredients={ingredients} />
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {[
            { id: 'home', icon: '🏠', label: '首页' },
            { id: 'stock', icon: '📦', label: '入库' },
            { id: 'cook', icon: '🍳', label: '做饭' },
            { id: 'shop', icon: '🛒', label: '买菜' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewType)}
              className={cn(
                'flex flex-col items-center px-4 py-2 rounded-lg transition-all',
                currentView === item.id 
                  ? 'bg-green-100 text-green-700' 
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ============ 首页视图 ============
function HomeView({ 
  ingredients, 
  lastMealConfirmed, 
  onConfirmMeal 
}: { 
  ingredients: Ingredient[];
  lastMealConfirmed: boolean;
  onConfirmMeal: (action: 'completed' | 'skipped' | 'modified', modifications?: Record<string, number>) => void;
}) {
  const maxCredits = getMaxRemainingCredits(ingredients);
  const stockWarnings = getStockWarnings(ingredients);
  const criticalItems = stockWarnings.filter(w => w.type === 'opened' || w.type === 'expiring');

  return (
    <div className="space-y-6">
      {/* 库存概览卡片 */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 库存概览</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{ingredients.length}</div>
            <div className="text-sm text-gray-600">食材种类</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{maxCredits}</div>
            <div className="text-sm text-gray-600">最大剩余顿数</div>
          </div>
        </div>
      </div>

      {/* 库存警告 */}
      {stockWarnings.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">⚠️ 库存提醒</h2>
          <div className="space-y-2">
            {stockWarnings.map((warning, idx) => (
              <div 
                key={idx}
                className={cn(
                  "p-3 rounded-lg text-sm",
                  warning.type === 'opened' ? 'bg-red-50 text-red-700' :
                  warning.type === 'expiring' ? 'bg-orange-50 text-orange-700' :
                  'bg-yellow-50 text-yellow-700'
                )}
              >
                {warning.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 紧急食材 */}
      {criticalItems.length > 0 && (
        <div className="bg-red-50 rounded-2xl shadow-md p-6 border-2 border-red-200">
          <h2 className="text-lg font-semibold text-red-700 mb-4">🚨 请立即处理</h2>
          <div className="space-y-2">
            {criticalItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg">
                <span className="font-medium">{item.ingredient.name}</span>
                <span className="text-sm text-red-600">
                  {item.ingredient.quantity}{item.ingredient.unit === 'count' ? '个' : 'g'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上一餐确认 */}
      {!lastMealConfirmed && (
        <div className="bg-amber-50 rounded-2xl shadow-md p-6 border-2 border-amber-200">
          <h2 className="text-lg font-semibold text-amber-700 mb-4">📋 确认上一餐</h2>
          <div className="space-y-3">
            <button
              onClick={() => onConfirmMeal('completed')}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition"
            >
              ✅ 按计划执行了
            </button>
            <button
              onClick={() => onConfirmMeal('skipped')}
              className="w-full py-3 bg-gray-500 text-white rounded-xl font-medium hover:bg-gray-600 transition"
            >
              🍕 外出就餐了
            </button>
            <button
              onClick={() => {/* TODO: 打开修正弹窗 */}}
              className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition"
            >
              ✏️ 需要手动修正
            </button>
          </div>
        </div>
      )}

      {/* 食材列表 */}
      {ingredients.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🥗 当前库存</h2>
          <div className="space-y-3">
            {ingredients.map(ing => (
              <div key={ing.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className={cn('px-2 py-1 rounded-full text-xs', categoryColors[ing.category])}>
                    {categoryNames[ing.category]}
                  </span>
                  <span className="font-medium">{ing.name}</span>
                  {ing.status === 'opened' && <span className="text-red-500 text-xs">已切开</span>}
                </div>
                <div className="text-right">
                  <div className="font-semibold">{ing.quantity}{ing.unit === 'count' ? '个' : 'g'}</div>
                  <div className="text-xs text-gray-500">剩余{ing.remainingCredits}顿</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {ingredients.length === 0 && (
        <div className="bg-white rounded-2xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🥬</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">冰箱空空如也</h3>
          <p className="text-gray-500">点击下方"入库"开始添加食材</p>
        </div>
      )}
    </div>
  );
}

// ============ 入库视图 ============
function StockView({ 
  ingredients, 
  onSave 
}: { 
  ingredients: Ingredient[];
  onSave: (ingredients: Ingredient[]) => void;
}) {
  const [input, setInput] = useState('');
  const [globalCredits, setGlobalCredits] = useState(6);
  const [parsedItems, setParsedItems] = useState<Array<{
    name: string;
    quantity: number;
    unit: 'g' | 'count';
    category: IngredientCategory;
    credits: number;
  }>>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  const handleParse = () => {
    const parsed = parseIngredientInput(input);
    const items = parsed.map(p => {
      const params = defaultIngredientParams[p.name];
      return {
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        category: (params?.category || 'other') as IngredientCategory,
        credits: globalCredits,
      };
    });
    setParsedItems(items);
    setStep('preview');
  };

  const handleSave = () => {
    const newIngredients: Ingredient[] = parsedItems.map(item => {
      const params = defaultIngredientParams[item.name];
      // 检查是否已存在
      const existing = ingredients.find(i => i.name === item.name);
      
      if (existing) {
        // 合并库存
        return {
          ...existing,
          quantity: existing.quantity + item.quantity,
          remainingCredits: Math.max(existing.remainingCredits, item.credits),
          updatedAt: Date.now(),
        };
      }
      
      return {
        id: crypto.randomUUID(),
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        remainingCredits: item.credits,
        status: 'fresh' as const,
        lossRate: params?.lossRate || 0.1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    // 合并新旧库存
    const mergedIngredients = [...ingredients];
    for (const newIng of newIngredients) {
      const existingIdx = mergedIngredients.findIndex(i => i.name === newIng.name);
      if (existingIdx >= 0) {
        mergedIngredients[existingIdx] = newIng;
      } else {
        mergedIngredients.push(newIng);
      }
    }

    onSave(mergedIngredients);
    setInput('');
    setParsedItems([]);
    setStep('input');
    alert('✅ 入库成功！新老库存已合并。');
  };

  const updateItemCredits = (index: number, credits: number) => {
    setParsedItems(items => items.map((item, i) => 
      i === index ? { ...item, credits } : item
    ));
  };

  const updateItemUnit = (index: number, unit: 'g' | 'count') => {
    setParsedItems(items => items.map((item, i) => 
      i === index ? { ...item, unit } : item
    ));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📦 食材入库</h2>
        
        {step === 'input' ? (
          <>
            {/* 全局顿数设置 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                这批菜计划吃几顿？
              </label>
              <div className="flex gap-2">
                {[4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setGlobalCredits(n)}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium transition',
                      globalCredits === n
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {n}顿
                  </button>
                ))}
              </div>
            </div>

            {/* 批量输入 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                批量输入食材（支持别名，如"番茄"会自动识别为"西红柿"）
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="例如：鸡胸肉800g，番茄3个，菠菜500g，金针菇1包"
                className="w-full h-32 p-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 支持的单位：g/克、个、根、包、把
              </p>
            </div>

            <button
              onClick={handleParse}
              disabled={!input.trim()}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition disabled:bg-gray-300"
            >
              下一步：预览确认
            </button>
          </>
        ) : (
          <>
            {/* 预览和微调 */}
            <div className="mb-4 space-y-3">
              {parsedItems.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('px-2 py-1 rounded-full text-xs', categoryColors[item.category])}>
                        {categoryNames[item.category]}
                      </span>
                      <span className="font-semibold">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.quantity}{item.unit === 'count' ? '个' : 'g'}</span>
                  </div>
                  
                  {/* 单位切换 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">单位：</span>
                    <button
                      onClick={() => updateItemUnit(idx, 'g')}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm',
                        item.unit === 'g' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                      )}
                    >
                      克(g)
                    </button>
                    <button
                      onClick={() => updateItemUnit(idx, 'count')}
                      className={cn(
                        'px-3 py-1 rounded-lg text-sm',
                        item.unit === 'count' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                      )}
                    >
                      个数
                    </button>
                  </div>
                  
                  {/* 顿数调整 */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">计划吃几顿：</span>
                    <div className="flex gap-1">
                      {[...Array(8)].map((_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => updateItemCredits(idx, i + 1)}
                          className={cn(
                            'w-8 h-8 rounded-lg text-sm font-medium transition',
                            item.credits === i + 1
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition"
              >
                返回修改
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition"
              >
                确认入库
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============ 做饭视图 ============
function CookView({ 
  ingredients, 
  onSaveIngredients,
  onSaveMealPlan 
}: { 
  ingredients: Ingredient[];
  onSaveIngredients: (ingredients: Ingredient[]) => void;
  onSaveMealPlan: (plan: MealPlan) => void;
}) {
  const [targetCount, setTargetCount] = useState<4 | 5>(4);
  const [mealPlan, setMealPlan] = useState<MealIngredient[]>([]);
  const [actualAmounts, setActualAmounts] = useState<Record<string, number>>({});
  const [step, setStep] = useState<'select' | 'plan' | 'complete'>('select');
  const stockWarnings = getStockWarnings(ingredients);

  const handleGenerate = () => {
    const plan = generateMealPlan(ingredients, targetCount);
    setMealPlan(plan);
    const amounts: Record<string, number> = {};
    plan.forEach(p => { amounts[p.ingredientId] = p.suggestedAmount; });
    setActualAmounts(amounts);
    setStep('plan');
  };

  const handleComplete = () => {
    // 扣减库存
    const updatedIngredients = ingredients.map(ing => {
      const amount = actualAmounts[ing.id];
      if (amount !== undefined) {
        return {
          ...ing,
          quantity: Math.max(0, ing.quantity - amount),
          remainingCredits: Math.max(0, ing.remainingCredits - 1),
          status: ing.quantity - amount < ing.quantity * 0.3 ? 'opened' as const : ing.status,
          updatedAt: Date.now(),
        };
      }
      return ing;
    }).filter(ing => ing.quantity > 0);

    onSaveIngredients(updatedIngredients);

    // 保存用餐记录
    const plan: MealPlan = {
      id: crypto.randomUUID(),
      ingredients: mealPlan.map(p => ({ ...p, actualAmount: actualAmounts[p.ingredientId] })),
      targetItemCount: targetCount,
      createdAt: Date.now(),
      completedAt: Date.now(),
      status: 'completed',
    };
    onSaveMealPlan(plan);
    
    setStep('complete');
  };

  if (ingredients.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-12 text-center">
        <div className="text-6xl mb-4">🥺</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">没有食材</h3>
        <p className="text-gray-500">请先去入库添加食材</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 库存警告提醒 */}
      {stockWarnings.length > 0 && step === 'select' && (
        <div className="bg-amber-50 rounded-2xl shadow-md p-4 border border-amber-200">
          <h3 className="font-semibold text-amber-700 mb-2">📢 今日必用</h3>
          <div className="space-y-1">
            {stockWarnings.slice(0, 3).map((w, i) => (
              <p key={i} className="text-sm text-amber-600">{w.message}</p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🍳 开始做饭</h2>
        
        {step === 'select' && (
          <>
            <p className="text-gray-600 mb-4">今天想吃几样？</p>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setTargetCount(4)}
                className={cn(
                  'flex-1 py-6 rounded-2xl text-xl font-bold transition',
                  targetCount === 4
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                4 品类
                <div className="text-sm font-normal mt-1">日常够吃</div>
              </button>
              <button
                onClick={() => setTargetCount(5)}
                className={cn(
                  'flex-1 py-6 rounded-2xl text-xl font-bold transition',
                  targetCount === 5
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                5 品类
                <div className="text-sm font-normal mt-1">今天丰盛</div>
              </button>
            </div>
            
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition"
            >
              🎲 生成今日配给
            </button>
          </>
        )}

        {step === 'plan' && (
          <>
            <div className="mb-6 space-y-4">
              {mealPlan.map((item) => (
                <div key={item.ingredientId} className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg">{item.name}</span>
                    <span className="text-sm text-gray-500">{item.reason}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">建议用量:</span>
                    <input
                      type="number"
                      value={actualAmounts[item.ingredientId] || 0}
                      onChange={(e) => setActualAmounts({
                        ...actualAmounts,
                        [item.ingredientId]: parseInt(e.target.value) || 0
                      })}
                      className="w-24 px-3 py-2 border rounded-lg text-center font-bold"
                    />
                    <span className="text-gray-600">{item.unit === 'count' ? '个' : 'g'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium"
              >
                重新选择
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium"
              >
                ✅ 完成本顿
              </button>
            </div>
          </>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-600 mb-2">本顿已完成！</h3>
            <p className="text-gray-500 mb-6">库存已自动更新</p>
            <button
              onClick={() => setStep('select')}
              className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium"
            >
              返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 买菜视图 ============
function ShopView({ ingredients }: { ingredients: Ingredient[] }) {
  const [input, setInput] = useState('');
  const [plannedCredits, setPlannedCredits] = useState(6);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [showInventoryCheck, setShowInventoryCheck] = useState(true);
  
  const stockWarnings = getStockWarnings(ingredients);
  const doNotBuyList = getDoNotBuyList(ingredients);
  const maxCredits = getMaxRemainingCredits(ingredients);

  const handleGenerateList = () => {
    const wantedItems = input.split(/[，,、\n]+/).map(s => s.trim()).filter(Boolean);
    const normalizedItems = wantedItems.map(normalizeIngredientName);
    const list = generateShoppingList(normalizedItems, plannedCredits, ingredients);
    setShoppingList(list);
    setShowInventoryCheck(false);
  };

  return (
    <div className="space-y-6">
      {/* 库存盘点提示 */}
      {showInventoryCheck && ingredients.length > 0 && (
        <div className="bg-blue-50 rounded-2xl shadow-md p-6 border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-700 mb-3">📦 库存盘点</h2>
          <p className="text-blue-600 mb-3">
            冰箱还剩 <strong>{ingredients.length}</strong> 种食材，约 <strong>{maxCredits}</strong> 顿的量
          </p>
          
          {stockWarnings.length > 0 && (
            <div className="space-y-2 mb-3">
              {stockWarnings.map((w, i) => (
                <div key={i} className={cn(
                  "p-2 rounded-lg text-sm",
                  w.type === 'opened' ? 'bg-red-100 text-red-700' :
                  w.type === 'old' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                )}>
                  {w.message}
                </div>
              ))}
            </div>
          )}
          
          {doNotBuyList.length > 0 && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <p className="font-semibold text-red-700 mb-2">🚫 不要买这些：</p>
              {doNotBuyList.map((item, i) => (
                <p key={i} className="text-sm text-red-600">
                  <strong>{item.name}</strong> - {item.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🛒 我要买菜</h2>
        
        {/* 追加顿数 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {ingredients.length > 0 ? '追加吃几顿？' : '这次买菜吃几顿？'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {[3, 4, 5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => setPlannedCredits(n)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition',
                  plannedCredits === n
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                )}
              >
                {n}顿
              </button>
            ))}
          </div>
          {ingredients.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              现有 {maxCredits} 顿 + 追加 {plannedCredits} 顿 = 总共 <strong>{maxCredits + plannedCredits}</strong> 顿
            </p>
          )}
        </div>

        {/* 输入想买的食材 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            想买什么？（支持别名，如"番茄"）
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：鸡胸肉、番茄、黄瓜、金针菇"
            className="w-full h-24 p-3 border rounded-xl"
          />
        </div>

        <button
          onClick={handleGenerateList}
          disabled={!input.trim()}
          className="w-full py-3 bg-green-500 text-white rounded-xl font-medium disabled:bg-gray-300"
        >
          生成购买清单
        </button>

        {/* 购物清单结果 */}
        {shoppingList.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold text-gray-800">📋 购买建议</h3>
            {shoppingList.map((item, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-1 rounded-full text-xs', categoryColors[item.category])}>
                      {categoryNames[item.category]}
                    </span>
                    <span className="font-semibold">{item.name}</span>
                  </div>
                  <span className="font-bold text-green-600">
                    {item.suggestedAmount > 0 
                      ? `买 ${item.suggestedAmount}${item.unit === 'count' ? '个' : 'g'}`
                      : '不用买'
                    }
                  </span>
                </div>
                {item.warning && (
                  <p className="text-sm text-amber-600">{item.warning}</p>
                )}
                {item.existingStock !== undefined && item.existingStock > 0 && !item.warning && (
                  <p className="text-sm text-gray-500">
                    库存还有 {item.existingStock}{item.unit === 'count' ? '个' : 'g'}
                  </p>
                )}
              </div>
            ))}

            {/* 不要买的提醒 */}
            {doNotBuyList.length > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="font-semibold text-red-700 mb-2">🚫 别买！别买！别买！</p>
                {doNotBuyList.map((item, i) => (
                  <p key={i} className="text-sm text-red-600">
                    <strong>{item.name}</strong>：{item.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

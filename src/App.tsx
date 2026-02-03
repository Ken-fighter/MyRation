import { useState, useEffect, useCallback } from 'react';
import { Ingredient, RationResult, categoryLabels, categoryColors, defaultIngredientParams } from './types';
import {
  getIngredients,
  addIngredientsBatch,
  updateIngredient,
  deleteIngredient,
  clearAllIngredients,
  consumeIngredients,
  saveMealRecord,
  getGlobalCredits,
  setGlobalCredits,
  getPendingMeal,
  setPendingMeal,
  clearPendingMeal
} from './store';
import { calculateRation, parseBatchInput, calculateShoppingList } from './algorithm';

type View = 'home' | 'stock' | 'cook' | 'shop' | 'history';

export function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [globalCredits, setGlobalCreditsState] = useState(6);
  const [pendingMeal, setPendingMealState] = useState<{ ingredientId: string; ingredientName: string; suggestedAmount: number }[] | null>(null);

  // 加载数据
  const loadData = useCallback(() => {
    setIngredients(getIngredients());
    setGlobalCreditsState(getGlobalCredits());
    setPendingMealState(getPendingMeal());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 导航栏
  const NavBar = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {[
          { view: 'home' as View, icon: '🏠', label: '首页' },
          { view: 'stock' as View, icon: '📦', label: '入库' },
          { view: 'cook' as View, icon: '🍳', label: '做饭' },
          { view: 'shop' as View, icon: '🛒', label: '买菜' },
        ].map(({ view, icon, label }) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`flex flex-col items-center py-3 px-6 transition-all ${
              currentView === view
                ? 'text-emerald-600 scale-110'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs mt-1 font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );

  // 首页视图
  const HomeView = () => {
    const totalItems = ingredients.length;
    const criticalItems = ingredients.filter(i => i.remainingCredits <= 1 || i.isOpened);
    const maxCredits = Math.max(...ingredients.map(i => i.remainingCredits), 0);

    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🍲 MyRation</h1>
          <p className="text-gray-500">个人食材库存配给系统</p>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
            <div className="text-4xl font-bold">{totalItems}</div>
            <div className="text-emerald-100 text-sm">种食材在库</div>
          </div>
          <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-4 text-white shadow-lg">
            <div className="text-4xl font-bold">{maxCredits}</div>
            <div className="text-orange-100 text-sm">最大剩余顿数</div>
          </div>
        </div>

        {/* 待确认餐食 */}
        {pendingMeal && pendingMeal.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4">
            <h3 className="font-bold text-yellow-800 mb-3">⚠️ 请确认上一顿的执行情况</h3>
            <div className="space-y-2 mb-4">
              {pendingMeal.map((item, idx) => {
                const ing = ingredients.find(i => i.id === item.ingredientId);
                const unit = ing?.unit === 'count' ? '个' : 'g';
                return (
                  <div key={idx} className="text-sm text-yellow-700">
                    {item.ingredientName}: {item.suggestedAmount}{unit}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmMeal('completed')}
                className="flex-1 bg-emerald-500 text-white py-2 rounded-lg font-medium hover:bg-emerald-600 transition"
              >
                ✅ 按计划执行
              </button>
              <button
                onClick={() => handleConfirmMeal('skipped')}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600 transition"
              >
                🍕 外出就餐
              </button>
            </div>
            <button
              onClick={() => setCurrentView('cook')}
              className="w-full mt-2 bg-orange-500 text-white py-2 rounded-lg font-medium hover:bg-orange-600 transition"
            >
              ✏️ 手动修正用量
            </button>
          </div>
        )}

        {/* 紧急提醒 */}
        {criticalItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="font-bold text-red-700 mb-2">🚨 需要优先处理</h3>
            <div className="space-y-2">
              {criticalItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-600">{item.name}</span>
                  <span className="text-red-500">
                    {item.isOpened ? '已切开' : `仅剩${item.remainingCredits}顿`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 库存概览 */}
        {ingredients.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h3 className="font-bold text-gray-700 mb-3">📋 库存概览</h3>
            <div className="space-y-2">
              {ingredients.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[item.category]}`}>
                      {categoryLabels[item.category].split(' ')[0]}
                    </span>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-gray-500">
                    {item.quantity}{item.unit === 'g' ? 'g' : '个'} · {item.remainingCredits}顿
                  </div>
                </div>
              ))}
              {ingredients.length > 5 && (
                <div className="text-center text-gray-400 text-sm pt-2">
                  还有 {ingredients.length - 5} 种食材...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🥬</div>
            <p className="text-gray-500 mb-4">冰箱空空如也</p>
            <button
              onClick={() => setCurrentView('stock')}
              className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-600 transition"
            >
              去入库
            </button>
          </div>
        )}
      </div>
    );
  };

  // 处理确认餐食
  const handleConfirmMeal = (status: 'completed' | 'skipped') => {
    if (!pendingMeal) return;

    if (status === 'completed') {
      // 按计划执行 - 扣减库存和顿数
      const consumptions = pendingMeal.map(item => ({
        id: item.ingredientId,
        amount: item.suggestedAmount
      }));
      consumeIngredients(consumptions);

      saveMealRecord({
        timestamp: Date.now(),
        items: pendingMeal.map(item => ({
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          plannedAmount: item.suggestedAmount,
          actualAmount: item.suggestedAmount
        })),
        status: 'completed'
      });
    } else {
      // 外出就餐 - 不扣减
      saveMealRecord({
        timestamp: Date.now(),
        items: pendingMeal.map(item => ({
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          plannedAmount: item.suggestedAmount,
          actualAmount: 0
        })),
        status: 'skipped'
      });
    }

    clearPendingMeal();
    loadData();
  };

  // 入库视图
  const StockView = () => {
    const [batchInput, setBatchInput] = useState('');
    const [localCredits, setLocalCreditsState] = useState(globalCredits);
    const [parsedItems, setParsedItems] = useState<{ name: string; quantity: number; unit: 'g' | 'count'; credits: number }[]>([]);
    const [showParsed, setShowParsed] = useState(false);

    // 解析输入
    const handleParse = () => {
      const parsed = parseBatchInput(batchInput);
      setParsedItems(parsed.map(item => ({
        ...item,
        credits: localCredits
      })));
      setShowParsed(true);
    };

    // 修改单个食材顿数
    const updateItemCredits = (index: number, credits: number) => {
      const updated = [...parsedItems];
      updated[index].credits = credits;
      setParsedItems(updated);
    };

    // 切换单位
    const toggleItemUnit = (index: number) => {
      const updated = [...parsedItems];
      updated[index].unit = updated[index].unit === 'g' ? 'count' : 'g';
      setParsedItems(updated);
    };

    // 确认入库
    const handleConfirmStock = () => {
      const newIngredients = parsedItems.map(item => {
        const defaults = defaultIngredientParams[item.name] || { category: 'other' as const, lossRate: 0.1 };
        return {
          name: item.name,
          category: defaults.category,
          quantity: item.quantity,
          unit: item.unit,
          remainingCredits: item.credits,
          isOpened: false,
          lossRate: defaults.lossRate
        };
      });

      addIngredientsBatch(newIngredients);
      setGlobalCredits(localCredits);

      setBatchInput('');
      setParsedItems([]);
      setShowParsed(false);
      loadData();

      alert(`✅ 入库完成！已添加 ${newIngredients.length} 种食材`);
    };

    return (
      <div className="p-4 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">📦 食材入库</h2>

        {/* 全局顿数设置 */}
        <div className="bg-emerald-50 rounded-2xl p-4">
          <label className="block text-sm font-medium text-emerald-700 mb-2">
            这批菜计划吃几顿？
          </label>
          <div className="flex items-center gap-2">
            {[4, 5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => setLocalCreditsState(n)}
                className={`w-12 h-12 rounded-xl font-bold text-lg transition ${
                  localCredits === n
                    ? 'bg-emerald-500 text-white shadow-lg scale-110'
                    : 'bg-white text-gray-600 hover:bg-emerald-100'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-emerald-600 font-medium ml-2">顿</span>
          </div>
        </div>

        {/* 批量输入 */}
        <div className="bg-white rounded-2xl shadow-md p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            批量输入食材
          </label>
          <p className="text-xs text-gray-500 mb-2">
            💡 支持：鸡胸肉800g、西红柿3个、鸡蛋6个
          </p>
          <textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            placeholder="鸡胸肉800g，西红柿3个，菠菜500g，鸡蛋6个，荞麦面400g"
            className="w-full h-32 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
          />
          <button
            onClick={handleParse}
            disabled={!batchInput.trim()}
            className="w-full mt-3 bg-emerald-500 text-white py-3 rounded-xl font-medium hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            解析并预览
          </button>
        </div>

        {/* 解析结果 */}
        {showParsed && parsedItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <h3 className="font-bold text-gray-700 mb-3">📋 确认入库清单</h3>
            <div className="space-y-3">
              {parsedItems.map((item, idx) => {
                const defaults = defaultIngredientParams[item.name];
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        defaults ? categoryColors[defaults.category] : 'bg-gray-100 text-gray-600'
                      }`}>
                        {defaults ? categoryLabels[defaults.category].split(' ')[0] : '🥗'}
                      </span>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500 text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => toggleItemUnit(idx)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                          item.unit === 'count' 
                            ? 'bg-purple-100 text-purple-600' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {item.unit === 'g' ? '克' : '个'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemCredits(idx, Math.max(1, item.credits - 1))}
                        className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-emerald-600">{item.credits}</span>
                      <button
                        onClick={() => updateItemCredits(idx, item.credits + 1)}
                        className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold"
                      >
                        +
                      </button>
                      <span className="text-gray-500 text-sm">顿</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleConfirmStock}
              className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 rounded-xl font-bold text-lg hover:opacity-90 transition shadow-lg"
            >
              ✅ 确认入库
            </button>
          </div>
        )}

        {/* 当前库存 */}
        {ingredients.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700">📦 当前库存</h3>
              <button
                onClick={() => {
                  if (confirm('确定要清空所有库存吗？')) {
                    clearAllIngredients();
                    loadData();
                  }
                }}
                className="text-red-500 text-sm hover:text-red-700"
              >
                清空全部
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[item.category]}`}>
                      {categoryLabels[item.category].split(' ')[0]}
                    </span>
                    <span>{item.name}</span>
                    <span className="text-gray-500 text-sm">
                      {item.quantity}{item.unit === 'g' ? 'g' : '个'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateIngredient(item.id, { isOpened: !item.isOpened });
                        loadData();
                      }}
                      className={`text-xs px-2 py-1 rounded ${
                        item.isOpened 
                          ? 'bg-orange-100 text-orange-600' 
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.isOpened ? '已切开' : '未开封'}
                    </button>
                    <span className="text-emerald-600 font-medium">{item.remainingCredits}顿</span>
                    <button
                      onClick={() => {
                        deleteIngredient(item.id);
                        loadData();
                      }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 做饭视图
  const CookView = () => {
    const [targetCount, setTargetCount] = useState<4 | 5>(4);
    const [rationResults, setRationResults] = useState<RationResult[]>([]);
    const [showRation, setShowRation] = useState(false);
    const [actualAmounts, setActualAmounts] = useState<Record<string, number>>({});
    const [showModify, setShowModify] = useState(false);

    // 生成配给
    const handleGenerateRation = () => {
      const results = calculateRation(ingredients, targetCount);
      setRationResults(results);
      setActualAmounts(
        Object.fromEntries(results.map(r => [r.ingredient.id, r.suggestedAmount]))
      );
      setShowRation(true);
    };

    // 确认做饭
    const handleConfirmCook = (modified: boolean) => {
      const mealItems = rationResults.map(r => ({
        ingredientId: r.ingredient.id,
        ingredientName: r.ingredient.name,
        suggestedAmount: r.suggestedAmount
      }));

      if (modified) {
        // 使用实际用量扣减
        const consumptions = rationResults.map(r => ({
          id: r.ingredient.id,
          amount: actualAmounts[r.ingredient.id] || r.suggestedAmount
        }));
        consumeIngredients(consumptions);

        saveMealRecord({
          timestamp: Date.now(),
          items: rationResults.map(r => ({
            ingredientId: r.ingredient.id,
            ingredientName: r.ingredient.name,
            plannedAmount: r.suggestedAmount,
            actualAmount: actualAmounts[r.ingredient.id] || r.suggestedAmount
          })),
          status: 'modified'
        });

        clearPendingMeal();
      } else {
        // 保存待确认状态
        setPendingMeal(mealItems);
      }

      loadData();
      setShowRation(false);
      setShowModify(false);
      
      if (modified) {
        alert('✅ 已记录本顿用量');
      } else {
        alert('🍳 开始做饭！做完后请确认执行情况');
      }
    };

    const priorityLabels = {
      critical: { text: '必吃', color: 'bg-red-100 text-red-600' },
      base: { text: '核心', color: 'bg-emerald-100 text-emerald-600' },
      filler: { text: '搭配', color: 'bg-blue-100 text-blue-600' },
      bonus: { text: '加餐', color: 'bg-purple-100 text-purple-600' }
    };

    return (
      <div className="p-4 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">🍳 开始做饭</h2>

        {ingredients.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🥬</div>
            <p className="text-gray-500">库存为空，请先入库食材</p>
          </div>
        ) : !showRation ? (
          <>
            {/* 丰富度选择 */}
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="font-bold text-gray-700 mb-4">今天想吃几样？</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setTargetCount(4)}
                  className={`flex-1 py-6 rounded-2xl font-bold text-xl transition ${
                    targetCount === 4
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-3xl mb-2">4️⃣</div>
                  4 品类
                  <div className="text-sm font-normal opacity-80">经典搭配</div>
                </button>
                <button
                  onClick={() => setTargetCount(5)}
                  className={`flex-1 py-6 rounded-2xl font-bold text-xl transition ${
                    targetCount === 5
                      ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-3xl mb-2">5️⃣</div>
                  5 品类
                  <div className="text-sm font-normal opacity-80">丰盛大餐</div>
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerateRation}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition shadow-lg"
            >
              🎲 生成今日配给
            </button>
          </>
        ) : (
          <>
            {/* 配给结果 */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-4 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-orange-800">【今日配给】</h3>
                <span className="text-orange-600 text-sm">
                  剩余最大顿数: {Math.max(...ingredients.map(i => i.remainingCredits))}
                </span>
              </div>
              
              <div className="space-y-3">
                {rationResults.map(result => (
                  <div key={result.ingredient.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${priorityLabels[result.priority].color}`}>
                          {priorityLabels[result.priority].text}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[result.ingredient.category]}`}>
                          {categoryLabels[result.ingredient.category].split(' ')[0]}
                        </span>
                        <span className="font-bold text-gray-800">{result.ingredient.name}</span>
                      </div>
                      {showModify ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={actualAmounts[result.ingredient.id]}
                            onChange={(e) => setActualAmounts({
                              ...actualAmounts,
                              [result.ingredient.id]: parseInt(e.target.value) || 0
                            })}
                            className="w-20 px-2 py-1 border rounded text-center"
                          />
                          <span className="text-gray-500">
                            {result.ingredient.unit === 'g' ? 'g' : '个'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-orange-600">
                          {result.suggestedAmount}
                          <span className="text-sm text-gray-500 font-normal">
                            {result.ingredient.unit === 'g' ? 'g' : '个'}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">💡 {result.reason}</p>
                    <div className="text-xs text-gray-400 mt-1">
                      库存: {result.ingredient.quantity}{result.ingredient.unit === 'g' ? 'g' : '个'} · 剩余 {result.ingredient.remainingCredits} 顿
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="space-y-3">
              {!showModify ? (
                <>
                  <button
                    onClick={() => handleConfirmCook(false)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition shadow-lg"
                  >
                    🍳 开始做饭
                  </button>
                  <button
                    onClick={() => setShowModify(true)}
                    className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    ✏️ 我要调整用量
                  </button>
                  <button
                    onClick={() => setShowRation(false)}
                    className="w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-300 transition"
                  >
                    ← 返回重选
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleConfirmCook(true)}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition shadow-lg"
                  >
                    ✅ 确认实际用量
                  </button>
                  <button
                    onClick={() => setShowModify(false)}
                    className="w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-300 transition"
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // 买菜视图
  const ShopView = () => {
    const [plannedCredits, setPlannedCredits] = useState(6);
    const [shoppingInput, setShoppingInput] = useState('');
    const [shoppingList, setShoppingList] = useState<{ name: string; suggestedAmount: number; unit: string; note: string; credits: number }[]>([]);
    const [showList, setShowList] = useState(false);

    // 当前库存中需要处理的食材
    const warningItems = ingredients.filter(i => i.remainingCredits <= 2);

    // 生成购物清单
    const handleGenerateList = () => {
      const items = shoppingInput.split(/[,，、\n;；]+/).map(s => s.trim()).filter(Boolean);
      const plannedItems = items.map(name => ({
        name,
        credits: plannedCredits
      }));
      
      const suggestions = calculateShoppingList(plannedItems, plannedCredits);
      setShoppingList(suggestions.map(s => ({ ...s, credits: plannedCredits })));
      setShowList(true);
    };

    // 调整单项顿数
    const updateItemCredits = (index: number, credits: number) => {
      const updated = [...shoppingList];
      // 重新计算建议量
      const item = updated[index];
      const perMealAmount = item.suggestedAmount / item.credits;
      updated[index] = {
        ...item,
        credits,
        suggestedAmount: Math.round(perMealAmount * credits)
      };
      setShoppingList(updated);
    };

    return (
      <div className="p-4 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">🛒 我要买菜</h2>

        {/* 库存警告 */}
        {warningItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="font-bold text-red-700 mb-2">⚠️ 冰箱里还有存货</h3>
            <div className="space-y-1">
              {warningItems.map(item => (
                <div key={item.id} className="text-sm text-red-600">
                  • {item.name}: 还剩 {item.quantity}{item.unit === 'g' ? 'g' : '个'}，请先吃掉！
                </div>
              ))}
            </div>
          </div>
        )}

        {!showList ? (
          <>
            {/* 计划顿数 */}
            <div className="bg-blue-50 rounded-2xl p-4">
              <label className="block text-sm font-medium text-blue-700 mb-2">
                这次计划吃几顿？
              </label>
              <div className="flex items-center gap-2">
                {[4, 5, 6, 7, 8].map(n => (
                  <button
                    key={n}
                    onClick={() => setPlannedCredits(n)}
                    className={`w-12 h-12 rounded-xl font-bold text-lg transition ${
                      plannedCredits === n
                        ? 'bg-blue-500 text-white shadow-lg scale-110'
                        : 'bg-white text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-blue-600 font-medium ml-2">顿</span>
              </div>
            </div>

            {/* 想买的食材 */}
            <div className="bg-white rounded-2xl shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                想买哪些食材？（用逗号分隔）
              </label>
              <textarea
                value={shoppingInput}
                onChange={(e) => setShoppingInput(e.target.value)}
                placeholder="菠菜、西葫芦、金针菇、鸡胸肉、荞麦面"
                className="w-full h-24 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleGenerateList}
                disabled={!shoppingInput.trim()}
                className="w-full mt-3 bg-blue-500 text-white py-3 rounded-xl font-medium hover:bg-blue-600 transition disabled:opacity-50"
              >
                📝 生成购买建议
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 购物清单 */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4">
                🛒 购买清单（{plannedCredits} 顿计划）
              </h3>
              <div className="space-y-3">
                {shoppingList.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-800">{item.name}</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {item.suggestedAmount}
                        <span className="text-sm text-gray-500 font-normal">{item.unit}</span>
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-sm text-gray-500 mb-2">💡 {item.note}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">调整顿数:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateItemCredits(idx, Math.max(1, item.credits - 1))}
                          className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-blue-600">{item.credits}</span>
                        <button
                          onClick={() => updateItemCredits(idx, item.credits + 1)}
                          className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 font-bold"
                        >
                          +
                        </button>
                        <span className="text-gray-500 text-sm">顿</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowList(false)}
              className="w-full bg-gray-200 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-300 transition"
            >
              ← 返回修改
            </button>
          </>
        )}
      </div>
    );
  };

  // 渲染当前视图
  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'stock':
        return <StockView />;
      case 'cook':
        return <CookView />;
      case 'shop':
        return <ShopView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <div className="max-w-lg mx-auto">
        {renderView()}
      </div>
      <NavBar />
    </div>
  );
}

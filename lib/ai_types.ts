// ============ AI Provider Types ============

export type AIProvider = 'openai' | 'claude' | 'gemini';

// Available models for each provider
export type OpenAIModel =
    | 'gpt-5.2'
    | 'gpt-5.1'
    | 'gpt-5'
    | 'gpt-4o'
    | 'gpt-4o-mini'
    | 'gpt-4-turbo'
    | 'o3-mini'
    | 'o1'
    | 'o1-mini';

export type ClaudeModel =
    | 'claude-sonnet-4-20250514'
    | 'claude-opus-4-20250514'
    | 'claude-3-5-sonnet-20241022'
    | 'claude-3-5-haiku-20241022'
    | 'claude-3-opus-20240229';

export type GeminiModel =
    | 'gemini-3-pro'
    | 'gemini-2.5-pro'
    | 'gemini-2.5-flash'
    | 'gemini-2.0-flash'
    | 'gemini-2.0-flash-lite'
    | 'gemini-1.5-pro'
    | 'gemini-1.5-flash';

export type AIModel = OpenAIModel | ClaudeModel | GeminiModel;

export interface AISettings {
    openaiApiKey: string;
    claudeApiKey: string;
    geminiApiKey: string;
    selectedProvider: AIProvider;
    selectedModel: AIModel;
    systemPrompt: string;
}

export const AI_PROVIDER_NAMES: Record<AIProvider, string> = {
    openai: 'OpenAI',
    claude: 'Anthropic Claude',
    gemini: 'Google Gemini',
};

// Model display names and info
export const AI_MODELS: Record<AIProvider, { id: AIModel; name: string; description: string }[]> = {
    openai: [
        { id: 'gpt-5.2', name: 'GPT-5.2', description: '🔥 最新最強 - 代碼與代理任務最佳' },
        { id: 'gpt-5.1', name: 'GPT-5.1', description: '速度與智能平衡 - 通用首選' },
        { id: 'gpt-5', name: 'GPT-5', description: '第五代旗艦 - 強大多模態' },
        { id: 'gpt-4o', name: 'GPT-4o', description: '經典款 - 穩定可靠' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '快速且經濟' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '128K 上下文' },
        { id: 'o3-mini', name: 'o3 Mini', description: '推理模型 - 高效能' },
        { id: 'o1', name: 'o1', description: '推理模型 - 複雜問題' },
        { id: 'o1-mini', name: 'o1 Mini', description: '快速推理' },
    ],
    claude: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '最新 - 平衡性能與成本' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '最強大 - 複雜任務專用' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '經典款 - 穩定可靠' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '最快速 - 即時回應' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '舊版旗艦' },
    ],
    gemini: [
        { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: '🔥 最新 - 高精度多模態推理' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '專業版 - 深度思考' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '價效比最佳 - 自適應思考' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '2倍速度提升' },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '超低延遲' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '100萬 Token' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '經典快速版' },
    ],
};

// Default model for each provider
export const DEFAULT_MODELS: Record<AIProvider, AIModel> = {
    openai: 'gpt-5.2',
    claude: 'claude-sonnet-4-20250514',
    gemini: 'gemini-3-pro',
};

// ============ Default System Prompt ============

export const DEFAULT_SYSTEM_PROMPT = `你是一位專業的加密貨幣交易分析師，專門分析交易歷史並提供改進建議。

## 你的分析能力：
1. **倉位分析** - 識別獲利和虧損模式
2. **風險管理** - 評估止損設置和倉位大小
3. **時機分析** - 分析進出場時機
4. **心理因素** - 識別情緒化交易行為

## 分析格式：
請按照以下格式提供分析：

### 📊 整體表現摘要
- 總結關鍵統計數據（勝率、盈虧比、最大回撤等）

### ✅ 做得好的地方
- 列出成功的交易模式和良好的執行紀律

### ⚠️ 需要改進的地方
- 分析虧損原因和常見錯誤

### 💡 具體建議
- 提供可執行的改進方案（至少3點）

### 🎯 下一步行動
- 立即可實施的調整（1-2個重點）

請用繁體中文回覆，保持專業但易懂的語氣。分析要具體，避免泛泛而談。`;

// ============ AI Analysis Types ============

export interface TradingDataForAI {
    exchange: string;
    stats: {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        profitFactor: number;
        avgWin: number;
        avgLoss: number;
        totalRealizedPnl: number;
        totalFunding: number;
        totalFees: number;
        netPnl: number;
        tradingDays: number;
    };
    recentPositions: {
        symbol: string;
        side: 'long' | 'short';
        pnl: number;
        duration: string;
        maxSize: number;
    }[];
    monthlyPnl: {
        month: string;
        pnl: number;
    }[];
}

export interface AIAnalysisRequest {
    provider: AIProvider;
    apiKey: string;
    systemPrompt: string;
    tradingData: TradingDataForAI;
}

export interface AIAnalysisResponse {
    success: boolean;
    analysis?: string;
    error?: string;
}

// ============ LocalStorage Keys ============

export const AI_SETTINGS_KEY = 'tradevoyage_ai_settings';

// ============ Helper Functions ============

export function getDefaultAISettings(): AISettings {
    return {
        openaiApiKey: '',
        claudeApiKey: '',
        geminiApiKey: '',
        selectedProvider: 'openai',
        selectedModel: 'gpt-4o',
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
    };
}

export function loadAISettings(): AISettings {
    if (typeof window === 'undefined') return getDefaultAISettings();

    try {
        const saved = localStorage.getItem(AI_SETTINGS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...getDefaultAISettings(), ...parsed };
        }
    } catch (e) {
        console.error('Failed to load AI settings:', e);
    }
    return getDefaultAISettings();
}

export function saveAISettings(settings: AISettings): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save AI settings:', e);
    }
}

export function getApiKeyForProvider(settings: AISettings, provider: AIProvider): string {
    switch (provider) {
        case 'openai': return settings.openaiApiKey;
        case 'claude': return settings.claudeApiKey;
        case 'gemini': return settings.geminiApiKey;
    }
}

export function hasConfiguredProvider(settings: AISettings): boolean {
    return !!(settings.openaiApiKey || settings.claudeApiKey || settings.geminiApiKey);
}

import { NextRequest, NextResponse } from 'next/server';
import { AIAnalysisRequest, AIAnalysisResponse, TradingDataForAI, AIModel } from '@/lib/ai_types';

export async function POST(request: NextRequest): Promise<NextResponse<AIAnalysisResponse>> {
    try {
        const body: AIAnalysisRequest & { model?: AIModel } = await request.json();
        const { provider, apiKey, systemPrompt, tradingData, model } = body;

        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API key is required' });
        }

        // Build the user message with trading data
        const userMessage = buildUserMessage(tradingData);

        let analysis: string;

        switch (provider) {
            case 'openai':
                analysis = await callOpenAI(apiKey, systemPrompt, userMessage, model || 'gpt-4o');
                break;
            case 'claude':
                analysis = await callClaude(apiKey, systemPrompt, userMessage, model || 'claude-sonnet-4-20250514');
                break;
            case 'gemini':
                analysis = await callGemini(apiKey, systemPrompt, userMessage, model || 'gemini-2.0-flash');
                break;
            default:
                return NextResponse.json({ success: false, error: 'Unknown provider' });
        }

        return NextResponse.json({ success: true, analysis });
    } catch (error: any) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to analyze'
        });
    }
}

function buildUserMessage(data: TradingDataForAI): string {
    const { stats, recentPositions, monthlyPnl, exchange } = data;

    const currencyUnit = exchange === 'bitmex' ? 'BTC' : 'USDT';

    let message = `## 交易數據分析請求

### 交易所
${exchange.toUpperCase()}

### 整體統計
- 總交易次數: ${stats.totalTrades}
- 獲利交易: ${stats.winningTrades} 筆
- 虧損交易: ${stats.losingTrades} 筆
- 勝率: ${stats.winRate.toFixed(2)}%
- 盈虧比 (Profit Factor): ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
- 平均獲利: ${stats.avgWin.toFixed(6)} ${currencyUnit}
- 平均虧損: ${stats.avgLoss.toFixed(6)} ${currencyUnit}
- 總已實現盈虧: ${stats.totalRealizedPnl.toFixed(4)} ${currencyUnit}
- 總資金費用: ${stats.totalFunding.toFixed(4)} ${currencyUnit}
- 總手續費: ${stats.totalFees.toFixed(4)} ${currencyUnit}
- 淨盈虧: ${stats.netPnl.toFixed(4)} ${currencyUnit}
- 交易天數: ${stats.tradingDays} 天

### 最近 ${recentPositions.length} 筆倉位
`;

    recentPositions.forEach((p, i) => {
        const pnlClass = p.pnl >= 0 ? '獲利' : '虧損';
        message += `${i + 1}. ${p.symbol} ${p.side.toUpperCase()} | ${pnlClass}: ${p.pnl.toFixed(4)} ${currencyUnit} | 持倉時間: ${p.duration} | 最大倉位: ${p.maxSize}\n`;
    });

    if (monthlyPnl.length > 0) {
        message += `\n### 月度盈虧\n`;
        monthlyPnl.forEach(m => {
            const pnlSign = m.pnl >= 0 ? '+' : '';
            message += `- ${m.month}: ${pnlSign}${m.pnl.toFixed(4)} ${currencyUnit}\n`;
        });
    }

    message += `\n請根據以上數據提供詳細的交易分析和改進建議。`;

    return message;
}

// ============ OpenAI API ============

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string, model: string): Promise<string> {
    // GPT-5+ models use max_completion_tokens instead of max_tokens
    const isNewModel = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3');
    const tokenParam = isNewModel
        ? { max_completion_tokens: 4000 }
        : { max_tokens: 2000 };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            ...tokenParam,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenAI';
}

// ============ Claude API ============

async function callClaude(apiKey: string, systemPrompt: string, userMessage: string, model: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage },
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response from Claude';
}

// ============ Gemini API ============

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string, model: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    parts: [{ text: userMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';
}

'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Bot,
    Sparkles,
    Loader2,
    AlertCircle,
    Settings,
    RefreshCw,
    CheckCircle2,
    Clock,
    Trash2
} from 'lucide-react';
import {
    AIProvider,
    AISettings,
    AIModel,
    AI_PROVIDER_NAMES,
    AI_MODELS,
    DEFAULT_MODELS,
    loadAISettings,
    getApiKeyForProvider,
    hasConfiguredProvider,
    TradingDataForAI
} from '@/lib/ai_types';
import { ExchangeType } from '@/lib/exchange_types';
import Link from 'next/link';

interface AIAnalysisProps {
    stats: any;
    sessions: any[];
    exchange: ExchangeType;
}

export function AIAnalysis({ stats, sessions, exchange }: AIAnalysisProps) {
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
    const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-5.2');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analysisTime, setAnalysisTime] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const ANALYSIS_STORAGE_KEY = `tradevoyage_ai_analysis_${exchange}`;

    // Load settings and previous analysis from localStorage
    useEffect(() => {
        const loaded = loadAISettings();
        setSettings(loaded);
        setSelectedProvider(loaded.selectedProvider);
        setSelectedModel(loaded.selectedModel || DEFAULT_MODELS[loaded.selectedProvider]);

        // Clear previous analysis state first when exchange changes
        setAnalysis(null);
        setAnalysisTime(null);
        setError(null);

        // Load previous analysis for this exchange
        try {
            const saved = localStorage.getItem(ANALYSIS_STORAGE_KEY);
            if (saved) {
                const { content, timestamp, provider } = JSON.parse(saved);
                setAnalysis(content);
                setAnalysisTime(timestamp);
                if (provider) setSelectedProvider(provider);
            }
        } catch (e) {
            console.error('Failed to load previous analysis:', e);
        }
    }, [exchange]);

    // Prepare trading data for AI
    const prepareTradingData = (): TradingDataForAI => {
        // Get recent positions (last 20)
        const recentPositions = (sessions || []).slice(0, 20).map(s => ({
            symbol: s.displaySymbol || s.symbol,
            side: s.side as 'long' | 'short',
            pnl: s.realizedPnl || 0,
            duration: formatDuration(s.durationMs),
            maxSize: s.maxSize || 0,
        }));

        // Monthly PnL
        const monthlyPnl = (stats?.monthlyPnl || []).map((m: any) => ({
            month: m.month,
            pnl: m.pnl || 0,
        }));

        return {
            exchange,
            stats: {
                totalTrades: stats?.totalTrades || 0,
                winningTrades: stats?.winningTrades || 0,
                losingTrades: stats?.losingTrades || 0,
                winRate: stats?.winRate || 0,
                profitFactor: stats?.profitFactor || 0,
                avgWin: stats?.avgWin || 0,
                avgLoss: stats?.avgLoss || 0,
                totalRealizedPnl: stats?.totalRealizedPnl || 0,
                totalFunding: stats?.totalFunding || 0,
                totalFees: stats?.totalFees || 0,
                netPnl: stats?.netPnl || 0,
                tradingDays: stats?.tradingDays || 0,
            },
            recentPositions,
            monthlyPnl,
        };
    };

    const formatDuration = (ms: number): string => {
        if (!ms) return 'N/A';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) {
            return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    const runAnalysis = async () => {
        if (!settings) return;

        const apiKey = getApiKeyForProvider(settings, selectedProvider);
        if (!apiKey) {
            setError(`請先在設定中配置 ${AI_PROVIDER_NAMES[selectedProvider]} API Key`);
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setAnalysis(null);
        setAnalysisTime(null);

        try {
            const tradingData = prepareTradingData();

            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedProvider,
                    model: selectedModel,
                    apiKey,
                    systemPrompt: settings.systemPrompt,
                    tradingData,
                }),
            });

            const result = await response.json();

            if (result.success) {
                const timestamp = new Date().toISOString();
                setAnalysis(result.analysis);
                setAnalysisTime(timestamp);

                // Save to localStorage
                try {
                    localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify({
                        content: result.analysis,
                        timestamp,
                        provider: selectedProvider,
                    }));
                } catch (e) {
                    console.error('Failed to save analysis:', e);
                }
            } else {
                setError(result.error || 'Analysis failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect to AI service');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const clearAnalysisHistory = () => {
        try {
            localStorage.removeItem(ANALYSIS_STORAGE_KEY);
            setAnalysis(null);
            setAnalysisTime(null);
        } catch (e) {
            console.error('Failed to clear analysis history:', e);
        }
    };

    const formatTimestamp = (isoString: string): string => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Check if any provider is configured
    const hasProvider = settings && hasConfiguredProvider(settings);
    const currentApiKey = settings ? getApiKeyForProvider(settings, selectedProvider) : '';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                        <Bot className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">AI Trading Analysis</h2>
                        <p className="text-sm text-muted-foreground">使用 AI 分析您的交易表現並獲得改進建議</p>
                    </div>
                </div>
            </div>

            {/* Provider Selection & Controls */}
            <div className="glass rounded-xl p-6 border border-white/10">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                AI Provider
                            </label>
                            <select
                                value={selectedProvider}
                                onChange={(e) => {
                                    const newProvider = e.target.value as AIProvider;
                                    setSelectedProvider(newProvider);
                                    setSelectedModel(DEFAULT_MODELS[newProvider]);
                                }}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-foreground focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                                disabled={isAnalyzing}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="claude">Anthropic Claude</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Model
                            </label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-foreground focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors min-w-[180px]"
                                disabled={isAnalyzing}
                            >
                                {AI_MODELS[selectedProvider].map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status indicator */}
                        <div className="flex items-center gap-2 mt-5">
                            {currentApiKey ? (
                                <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    已配置
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-amber-400 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    未配置
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/settings"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            設定 API Key
                        </Link>

                        <button
                            onClick={runAnalysis}
                            disabled={isAnalyzing || !currentApiKey}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    分析我的交易
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Trading Stats Preview */}
                <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-sm text-muted-foreground mb-3">將分析以下數據：</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">總交易</p>
                            <p className="text-lg font-bold text-foreground">{stats?.totalTrades || 0}</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">勝率</p>
                            <p className="text-lg font-bold text-foreground">{(stats?.winRate || 0).toFixed(1)}%</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">盈虧比</p>
                            <p className="text-lg font-bold text-foreground">{(stats?.profitFactor || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">倉位數</p>
                            <p className="text-lg font-bold text-foreground">{sessions?.length || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="glass rounded-xl p-4 border border-rose-500/30 bg-rose-500/10">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5" />
                        <div>
                            <p className="font-medium text-rose-400">分析失敗</p>
                            <p className="text-sm text-rose-300/80 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isAnalyzing && (
                <div className="glass rounded-xl p-8 border border-purple-500/30">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
                            <Bot className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-foreground">AI 正在分析您的交易...</p>
                            <p className="text-sm text-muted-foreground mt-1">這可能需要 10-30 秒</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Result */}
            {analysis && !isAnalyzing && (
                <div className="glass rounded-xl border border-purple-500/20 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-b border-white/10">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <h3 className="font-semibold text-foreground">AI 分析報告</h3>
                                {analysisTime && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground bg-zinc-800 px-2 py-1 rounded">
                                        <Clock className="w-3 h-3" />
                                        {formatTimestamp(analysisTime)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={clearAnalysisHistory}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    清除
                                </button>
                                <button
                                    onClick={runAnalysis}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-sm transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    重新分析
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="ai-analysis-content">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h3>,
                                    h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h4>,
                                    p: ({ children }) => <p className="mb-3 text-muted-foreground leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-muted-foreground">{children}</ol>,
                                    li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                    em: ({ children }) => <em className="italic text-purple-300">{children}</em>,
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-purple-500 pl-4 my-4 italic text-muted-foreground bg-purple-500/5 py-2 rounded-r">
                                            {children}
                                        </blockquote>
                                    ),
                                    code: ({ children }) => (
                                        <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 text-sm font-mono">
                                            {children}
                                        </code>
                                    ),
                                    hr: () => <hr className="my-6 border-zinc-700" />,
                                }}
                            >
                                {analysis}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div >
            )
            }

            {/* No Provider Configured */}
            {
                !hasProvider && !isAnalyzing && !analysis && (
                    <div className="glass rounded-xl p-8 border border-amber-500/30 bg-amber-500/5">
                        <div className="flex flex-col items-center justify-center gap-4 text-center">
                            <div className="p-4 rounded-full bg-amber-500/20">
                                <Settings className="w-8 h-8 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">尚未配置 AI API Key</h3>
                                <p className="text-muted-foreground mt-1">請先在設定中配置至少一個 AI Provider 的 API Key</p>
                            </div>
                            <Link
                                href="/settings"
                                className="mt-2 px-6 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition-colors"
                            >
                                前往設定
                            </Link>
                        </div>
                    </div>
                )
            }
        </div >
    );
}


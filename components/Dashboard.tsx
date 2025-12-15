'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Trade, PositionSession } from '@/lib/types';
import { TradeList } from './TradeList';
import { PositionSessionList } from './PositionSessionList';
import { PositionDetail } from './PositionDetail';
import { StatsOverview } from './StatsOverview';
import { MonthlyPnLChart } from './MonthlyPnLChart';
import { EquityCurve } from './EquityCurve';
import TradingViewChart from './TradingViewChart';
import { AIAnalysis } from './AIAnalysis';
import {
    Loader2,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    History,
    BarChart3,
    TrendingUp,
    Activity,
    Settings,
    Database,
    Sun,
    Moon,
    Github,
    Bot,
} from 'lucide-react';
import { ExchangeType, EXCHANGE_DISPLAY_NAMES } from '@/lib/exchange_types';
import { useTheme } from './ThemeProvider';

type ViewMode = 'overview' | 'positions' | 'trades' | 'ai';

export function Dashboard() {
    const { theme, toggleTheme } = useTheme();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [sessions, setSessions] = useState<PositionSession[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [account, setAccount] = useState<any>(null);
    const [equityCurve, setEquityCurve] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedExchange, setSelectedExchange] = useState<ExchangeType>('bitmex');
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [selectedSession, setSelectedSession] = useState<PositionSession | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const limit = 20;

    // State for all sessions (loaded upfront for chart markers)
    const [allSessions, setAllSessions] = useState<PositionSession[]>([]);

    // Collect Entry & Exit points from ALL sessions for the TradingView chart
    // Only show entry price and exit price, not all individual trades
    const allSessionTrades = useMemo(() => {
        if (!allSessions || allSessions.length === 0) return [];

        const trades: { datetime: string; side: 'buy' | 'sell'; price: number; amount: number; sessionId: string; label: string }[] = [];

        // Normalize symbol for comparison (handle XBT/BTC aliasing and OKX format)
        const normalizeSymbol = (sym: string): string => {
            return sym.toUpperCase()
                .replace('XBT', 'BTC')  // BitMEX uses XBT for BTC
                .replace('-USDT-SWAP', '')  // OKX SWAP format
                .replace('-USD-SWAP', '')   // OKX USD SWAP
                .replace('-SWAP', '')       // Any other SWAP
                .replace('USD', '')
                .replace('USDT', '')
                .replace('/', '')
                .replace('-', '')
                .replace(':BTC', '');
        };

        const baseNormalized = normalizeSymbol(selectedSymbol);

        allSessions.forEach(session => {
            // Match symbol using normalized comparison
            const sessionNormalized = normalizeSymbol(session.symbol);
            if (sessionNormalized !== baseNormalized) {
                return;
            }

            // Only show entry and exit, not all trades
            if (session.avgEntryPrice > 0) {
                trades.push({
                    datetime: session.openTime,
                    side: session.side === 'long' ? 'buy' : 'sell',
                    price: session.avgEntryPrice,
                    amount: session.maxSize,
                    sessionId: session.id,
                    label: `${session.side.toUpperCase()} ENTRY`,
                });
            }

            if (session.status === 'closed' && session.avgExitPrice > 0 && session.closeTime) {
                trades.push({
                    datetime: session.closeTime,
                    side: session.side === 'long' ? 'sell' : 'buy',
                    price: session.avgExitPrice,
                    amount: session.maxSize,
                    sessionId: session.id,
                    label: `${session.side.toUpperCase()} EXIT`,
                });
            }
        });

        // Sort by datetime
        trades.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        console.log(`[allSessionTrades] Symbol: ${selectedSymbol}, Normalized: ${baseNormalized}, Found ${trades.length} trades from ${allSessions.length} sessions`);
        return trades;
    }, [allSessions, selectedSymbol]);

    // Get entry & exit for selected session only
    const selectedSessionTrades = useMemo(() => {
        if (!selectedSession) return [];

        const trades: { datetime: string; side: 'buy' | 'sell'; price: number; amount: number; label: string }[] = [];

        if (selectedSession.avgEntryPrice > 0) {
            trades.push({
                datetime: selectedSession.openTime,
                side: selectedSession.side === 'long' ? 'buy' : 'sell',
                price: selectedSession.avgEntryPrice,
                amount: selectedSession.maxSize,
                label: `ENTRY @ ${selectedSession.avgEntryPrice.toLocaleString()}`,
            });
        }

        if (selectedSession.status === 'closed' && selectedSession.avgExitPrice > 0 && selectedSession.closeTime) {
            trades.push({
                datetime: selectedSession.closeTime,
                side: selectedSession.side === 'long' ? 'sell' : 'buy',
                price: selectedSession.avgExitPrice,
                amount: selectedSession.maxSize,
                label: `EXIT @ ${selectedSession.avgExitPrice.toLocaleString()}`,
            });
        }

        return trades;
    }, [selectedSession]);

    // Symbol options based on exchange
    const symbolOptions = selectedExchange === 'bitmex'
        ? ['BTCUSD', 'ETHUSD']
        : selectedExchange === 'okx'
            ? ['BTC-USDT-SWAP', 'ETH-USDT-SWAP']
            : ['BTCUSDT', 'ETHUSDT'];

    // Reset symbol when exchange changes
    useEffect(() => {
        if (selectedExchange === 'bitmex') {
            setSelectedSymbol('BTCUSD');
        } else if (selectedExchange === 'okx') {
            setSelectedSymbol('BTC-USDT-SWAP');
        } else {
            setSelectedSymbol('BTCUSDT');
        }
    }, [selectedExchange]);

    // Load Stats and Account Data
    useEffect(() => {
        async function loadStats() {
            try {
                const res = await fetch(`/api/trades?type=stats&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();
                setStats(data.stats);
                setAccount(data.account);
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        loadStats();
    }, [selectedExchange]);

    // Load Equity Curve
    useEffect(() => {
        async function loadEquity() {
            try {
                const res = await fetch(`/api/trades?type=equity&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch equity');
                const data = await res.json();
                setEquityCurve(data.equityCurve);
            } catch (err) {
                console.error('Error loading equity:', err);
            }
        }
        loadEquity();
    }, [selectedExchange]);


    // Load all sessions upfront for chart markers
    useEffect(() => {
        async function loadAllSessions() {
            try {
                // Fetch all sessions for this exchange without pagination
                const res = await fetch(`/api/trades?type=sessions&limit=10000&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch sessions');
                const data = await res.json();
                setAllSessions(data.sessions || []);
            } catch (err) {
                console.error('Error loading sessions for markers:', err);
            }
        }
        loadAllSessions();
    }, [selectedExchange]);

    // Load Table Data (Paginated)
    useEffect(() => {
        async function loadData() {
            if (viewMode === 'overview') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const typeParam = viewMode === 'positions' ? '&type=sessions' : '';
                const res = await fetch(`/api/trades?page=${page}&limit=${limit}&symbol=${encodeURIComponent(selectedSymbol)}${typeParam}&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                if (viewMode === 'positions') {
                    setSessions(data.sessions);
                    setTotalPages(Math.ceil(data.total / limit));
                } else {
                    setTrades(data.trades);
                    setTotalPages(Math.ceil(data.total / limit));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [page, selectedSymbol, viewMode, selectedExchange]);

    // Reset selected session when switching views or symbols
    useEffect(() => {
        setSelectedSession(null);
    }, [viewMode, selectedSymbol]);

    // Handler to select a session and fetch full trade details
    const handleSelectSession = async (session: PositionSession) => {
        try {
            const res = await fetch(`/api/trades?sessionId=${encodeURIComponent(session.id)}&exchange=${selectedExchange}`);
            if (!res.ok) throw new Error('Failed to fetch session details');
            const data = await res.json();
            setSelectedSession(data.session);
        } catch (err) {
            console.error('Error fetching session:', err);
            // Fallback: use the session data we already have
            setSelectedSession(session);
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen text-destructive">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans selection:bg-primary/20">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                            TradeVoyage
                        </h1>
                        {/* Social Links */}
                        <div className="flex items-center gap-2 mt-2">
                            <a
                                href="https://github.com/0x0funky/TradeVoyage"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="GitHub"
                            >
                                <Github className="w-4 h-4" />
                            </a>
                            <a
                                href="#"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="X (Twitter)"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Exchange Selector */}
                        <div className="relative">
                            <select
                                value={selectedExchange}
                                onChange={(e) => {
                                    setSelectedExchange(e.target.value as ExchangeType);
                                    setPage(1);
                                }}
                                className="appearance-none pl-10 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:bg-secondary cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                            >
                                <option value="bitmex">BitMEX</option>
                                <option value="binance">Binance</option>
                                <option value="okx">OKX</option>
                                <option value="bybit">Bybit</option>
                            </select>
                            {/* Dynamic Exchange Icons */}
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                {selectedExchange === 'bitmex' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#F7931A" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F7931A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                                {selectedExchange === 'binance' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#F3BA2F">
                                        <path d="M12 4.5l-2.5 2.5L12 9.5l2.5-2.5L12 4.5zm-5.5 5.5L4 12.5l2.5 2.5L9 12.5 6.5 10zm11 0L15 12.5l2.5 2.5 2.5-2.5-2.5-2.5zM12 14.5l-2.5 2.5L12 19.5l2.5-2.5L12 14.5z" />
                                    </svg>
                                )}
                                {selectedExchange === 'okx' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="4" y="4" width="6" height="6" rx="1" fill="currentColor" />
                                        <rect x="14" y="4" width="6" height="6" rx="1" fill="currentColor" />
                                        <rect x="4" y="14" width="6" height="6" rx="1" fill="currentColor" />
                                        <rect x="14" y="14" width="6" height="6" rx="1" fill="currentColor" />
                                    </svg>
                                )}
                                {selectedExchange === 'bybit' && (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M5 6h6v12H5V6z" fill="#F7A600" />
                                        <path d="M13 6h6v6h-6V6z" fill="#F7A600" />
                                        <path d="M13 14h6v4h-6v-4z" fill="#F7A600" />
                                    </svg>
                                )}
                            </div>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>

                        {/* View Mode Tabs */}
                        <div className="flex bg-secondary backdrop-blur-sm rounded-xl p-1 border border-border">
                            <button
                                onClick={() => { setViewMode('overview'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'overview'
                                    ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <BarChart3 size={16} className="mr-2" /> Overview
                            </button>
                            <button
                                onClick={() => { setViewMode('positions'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'positions'
                                    ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <History size={16} className="mr-2" /> Positions
                            </button>
                            <button
                                onClick={() => { setViewMode('trades'); setPage(1); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'trades'
                                    ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)] ring-1 ring-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <LayoutList size={16} className="mr-2" /> Trades
                            </button>
                            <button
                                onClick={() => { setViewMode('ai'); }}
                                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${viewMode === 'ai'
                                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                <Bot size={16} className="mr-2" /> AI Analysis
                            </button>
                        </div>

                        {/* Symbol Selector */}
                        <div className="relative">
                            <select
                                value={selectedSymbol}
                                onChange={(e) => {
                                    setSelectedSymbol(e.target.value);
                                    setPage(1);
                                }}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all hover:bg-secondary cursor-pointer [&>option]:bg-background [&>option]:text-foreground"
                            >
                                {symbolOptions.map(sym => (
                                    <option key={sym} value={sym}>{sym}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-all"
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? (
                                <Sun className="w-5 h-5 text-amber-400" />
                            ) : (
                                <Moon className="w-5 h-5 text-indigo-500" />
                            )}
                        </button>

                        {/* Settings Link */}
                        <Link
                            href="/settings"
                            className="p-2.5 rounded-xl bg-secondary border border-border hover:bg-secondary/80 transition-all"
                            title="Import Data"
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                </header>

                {/* Exchange Section Title */}
                <div className="flex items-center gap-3">
                    {/* Exchange Icon */}
                    {selectedExchange === 'bitmex' ? (
                        <div className="w-10 h-10 rounded-xl bg-[#f7941d]/10 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#f7941d" />
                                <path d="M2 17L12 22L22 17" stroke="#f7941d" strokeWidth="2" />
                                <path d="M2 12L12 17L22 12" stroke="#f7941d" strokeWidth="2" />
                            </svg>
                        </div>
                    ) : selectedExchange === 'binance' ? (
                        <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#f0b90b">
                                <path d="M12 2L6 8.5L8.5 11L12 7.5L15.5 11L18 8.5L12 2Z" />
                                <path d="M3 12L5.5 9.5L8 12L5.5 14.5L3 12Z" />
                                <path d="M21 12L18.5 9.5L16 12L18.5 14.5L21 12Z" />
                                <path d="M12 16.5L8.5 13L6 15.5L12 22L18 15.5L15.5 13L12 16.5Z" />
                                <path d="M12 9.5L9.5 12L12 14.5L14.5 12L12 9.5Z" />
                            </svg>
                        </div>
                    ) : (
                        /* OKX */
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                                <circle cx="8" cy="8" r="3" fill="white" />
                                <circle cx="16" cy="8" r="3" fill="white" />
                                <circle cx="8" cy="16" r="3" fill="white" />
                                <circle cx="16" cy="16" r="3" fill="white" />
                            </svg>
                        </div>
                    )}
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        {EXCHANGE_DISPLAY_NAMES[selectedExchange]}
                        <span className="text-muted-foreground font-normal">•</span>
                        <span className="text-muted-foreground font-normal">
                            {account?.user?.username ? `@${account.user.username}` : 'Portfolio Analytics'}
                        </span>
                    </h2>
                </div>

                {/* Overview Mode */}
                {viewMode === 'overview' && stats && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <StatsOverview stats={stats} account={account} exchange={selectedExchange} />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="glass rounded-xl p-6 hover-card">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Equity Curve
                                </h3>
                                <EquityCurve data={equityCurve} exchange={selectedExchange} />
                            </div>
                            <div className="glass rounded-xl p-6 hover-card">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    Monthly PnL
                                </h3>
                                <MonthlyPnLChart data={stats.monthlyPnl} exchange={selectedExchange} />
                            </div>
                        </div>

                        {/* Price Chart */}
                        <div className="glass rounded-xl p-6 hover-card">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Price Action <span className="text-muted-foreground text-sm font-normal ml-2">{selectedSymbol.split(':')[0]}</span>
                                </h3>
                            </div>

                            {/* Chart */}
                            <TradingViewChart
                                symbol={selectedSymbol.replace('/', '').replace(':BTC', '')}
                                trades={allSessionTrades}
                                height={450}
                            />
                        </div>
                    </div>
                )}

                {/* Positions/Trades Mode */}
                {(viewMode === 'positions' || viewMode === 'trades') && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Chart Section */}
                        <section className="glass rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                {selectedSession ? (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 rounded-xl border border-primary/20">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                        <span className="text-sm font-medium text-primary">
                                            Viewing Position: {selectedSession.side.toUpperCase()} {selectedSession.maxSize.toLocaleString()}
                                        </span>
                                    </div>
                                ) : (
                                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                        <Activity className="w-5 h-5 text-primary" />
                                        {selectedSymbol.split(':')[0]} Chart
                                    </h3>
                                )}
                            </div>

                            {/* Chart */}
                            <TradingViewChart
                                symbol={selectedSymbol.replace('/', '').replace(':BTC', '')}
                                trades={selectedSession ? selectedSessionTrades : allSessionTrades}
                                focusTime={selectedSession ? (() => {
                                    // Calculate middle point between entry and exit for centering
                                    const entryTime = new Date(selectedSession.openTime).getTime();
                                    const exitTime = selectedSession.closeTime
                                        ? new Date(selectedSession.closeTime).getTime()
                                        : Date.now(); // Use current time for open positions
                                    return Math.floor((entryTime + exitTime) / 2);
                                })() : undefined}
                                height={450}
                            />
                        </section>

                        {/* Data Section */}
                        <section>
                            {selectedSession ? (
                                <PositionDetail
                                    session={selectedSession}
                                    onBack={() => setSelectedSession(null)}
                                />
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                                            {viewMode === 'trades' ? 'Trade Log' : 'Position History'}
                                        </h2>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <span className="text-sm font-medium px-2 text-muted-foreground">
                                                Page {page} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                className="p-2 rounded-lg border border-white/10 hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>

                                    {viewMode === 'trades' ? (
                                        <div className="glass rounded-xl overflow-hidden border border-white/5">
                                            <TradeList trades={trades} />
                                        </div>
                                    ) : (
                                        <PositionSessionList
                                            sessions={sessions}
                                            onSelectSession={handleSelectSession}
                                        />
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                )}

                {/* AI Analysis Mode */}
                {viewMode === 'ai' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <AIAnalysis
                            stats={stats}
                            sessions={allSessions}
                            exchange={selectedExchange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

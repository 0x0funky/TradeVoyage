'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';

interface Trade {
    datetime: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    sessionId?: string;
    label?: string;
}

interface TradingViewChartProps {
    symbol: string;
    trades?: Trade[];
    height?: number;
    focusTime?: number; // Unix timestamp in ms to auto-scroll to
}

type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

// Map to Binance API symbol format
function toBinanceSymbol(symbol: string): string {
    const symbolMap: Record<string, string> = {
        'XBTUSD': 'BTCUSDT',
        'ETHUSD': 'ETHUSDT',
        'BTC/USD': 'BTCUSDT',
        'ETH/USD': 'ETHUSDT',
        'BTCUSD': 'BTCUSDT',
    };
    return symbolMap[symbol] || symbol.toUpperCase();
}

// Map timeframe to Binance interval
function toBinanceInterval(tf: Timeframe): string {
    const intervalMap: Record<Timeframe, string> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
        '1w': '1w',
    };
    return intervalMap[tf];
}

// Fetch OHLCV data from Binance public API
// endTime is optional - if provided, fetches data BEFORE that time
async function fetchBinanceOHLCV(
    symbol: string,
    interval: string,
    limit: number = 1500,
    endTime?: number
): Promise<CandlestickData[]> {
    const binanceSymbol = toBinanceSymbol(symbol);
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

    if (endTime) {
        url += `&endTime=${endTime}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return data.map((candle: any[]) => ({
            time: (candle[0] / 1000) as Time, // Convert ms to seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
        }));
    } catch (error) {
        console.error('Failed to fetch Binance OHLCV:', error);
        return [];
    }
}

function TradingViewChartInner({ symbol, trades = [], height = 500, focusTime }: TradingViewChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    const [timeframe, setTimeframe] = useState<Timeframe>('1h');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Store all loaded candles and track oldest timestamp
    const allCandlesRef = useRef<CandlestickData[]>([]);
    const oldestTimestampRef = useRef<number | null>(null);
    const isLoadingMoreRef = useRef(false);

    // Store current trades in a ref to avoid stale closures
    const tradesRef = useRef<Trade[]>(trades);
    tradesRef.current = trades;

    // Navigation state for loading old data
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationProgress, setNavigationProgress] = useState({ loaded: 0, target: '' });
    const navigationCancelledRef = useRef(false);

    // Initialize chart
    useEffect(() => {
        if (!containerRef.current) return;

        // Clean up previous chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // Create chart
        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: height - 50, // Leave room for timeframe buttons
            layout: {
                background: { color: '#111111' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    width: 1,
                    color: '#6366f1',
                    style: 2,
                },
                horzLine: {
                    width: 1,
                    color: '#6366f1',
                    style: 2,
                },
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
            timeScale: {
                borderColor: '#374151',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Create candlestick series
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;

        // Handle resize
        const handleResize = () => {
            if (containerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: containerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [height]);

    // Function to update markers on the chart
    const updateMarkers = () => {
        if (!candleSeriesRef.current) return;

        const currentTrades = tradesRef.current;

        // If no trades, clear markers
        if (!currentTrades || currentTrades.length === 0) {
            candleSeriesRef.current.setMarkers([]);
            return;
        }

        const markers = currentTrades.map(trade => {
            const tradeTime = Math.floor(new Date(trade.datetime).getTime() / 1000) as Time;
            // Use custom label if provided, otherwise default format
            const label = trade.label || `${trade.side.toUpperCase()} @ ${trade.price.toLocaleString()}`;
            return {
                time: tradeTime,
                position: trade.side === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
                color: trade.side === 'buy' ? '#10b981' : '#ef4444',
                shape: trade.side === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
                text: label,
            };
        });

        // Sort markers by time
        markers.sort((a, b) => (a.time as number) - (b.time as number));
        candleSeriesRef.current.setMarkers(markers);
    };

    // Function to load more historical data
    const loadMoreData = async () => {
        if (isLoadingMoreRef.current || !oldestTimestampRef.current) return;

        isLoadingMoreRef.current = true;
        setLoadingMore(true);

        try {
            // Fetch data before the oldest timestamp we have
            const endTime = oldestTimestampRef.current * 1000; // Convert to ms
            const newCandles = await fetchBinanceOHLCV(symbol, toBinanceInterval(timeframe), 1500, endTime - 1);

            if (newCandles.length > 0) {
                // Prepend new candles (they're older)
                allCandlesRef.current = [...newCandles, ...allCandlesRef.current];

                // Update oldest timestamp
                oldestTimestampRef.current = newCandles[0].time as number;

                // Update chart
                if (candleSeriesRef.current) {
                    candleSeriesRef.current.setData(allCandlesRef.current);
                    updateMarkers();
                }
            }
        } catch (err) {
            console.error('Failed to load more data:', err);
        }

        setLoadingMore(false);
        isLoadingMoreRef.current = false;
    };

    // Fetch initial data when symbol or timeframe changes
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            allCandlesRef.current = [];
            oldestTimestampRef.current = null;

            // Clear markers immediately when symbol changes to prevent stale markers
            if (candleSeriesRef.current) {
                candleSeriesRef.current.setMarkers([]);
            }

            try {
                const candles = await fetchBinanceOHLCV(symbol, toBinanceInterval(timeframe), 1500);

                if (candles.length === 0) {
                    setError('No data available');
                    setLoading(false);
                    return;
                }

                // Store candles and oldest timestamp
                allCandlesRef.current = candles;
                oldestTimestampRef.current = candles[0].time as number;

                if (candleSeriesRef.current) {
                    candleSeriesRef.current.setData(candles);
                    updateMarkers();

                    // Fit content
                    if (chartRef.current) {
                        chartRef.current.timeScale().fitContent();
                    }
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load data');
            }

            setLoading(false);
        };

        loadData();

        // Auto-refresh every 60 seconds (fetch latest candle only)
        const interval = setInterval(async () => {
            if (allCandlesRef.current.length === 0) return;

            try {
                const latestCandles = await fetchBinanceOHLCV(symbol, toBinanceInterval(timeframe), 2);
                if (latestCandles.length > 0 && candleSeriesRef.current) {
                    // Update the last candle
                    const lastCandle = latestCandles[latestCandles.length - 1];
                    candleSeriesRef.current.update(lastCandle);
                }
            } catch (err) {
                console.error('Failed to update latest candle:', err);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [symbol, timeframe]);

    // Update markers when trades change
    useEffect(() => {
        updateMarkers();
    }, [trades]);

    // Set up scroll handler to load more data
    useEffect(() => {
        if (!chartRef.current) return;

        const timeScale = chartRef.current.timeScale();

        const handleVisibleRangeChange = () => {
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            // If user scrolled to the left edge (showing oldest data), load more
            if (visibleRange.from < 10 && !isLoadingMoreRef.current) {
                loadMoreData();
            }
        };

        timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

        return () => {
            timeScale.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
        };
    }, [chartRef.current, symbol, timeframe]);

    // Auto-scroll to focusTime when it changes
    useEffect(() => {
        if (!focusTime || !chartRef.current || allCandlesRef.current.length === 0) return;

        const focusTimeSeconds = Math.floor(focusTime / 1000);
        const timeScale = chartRef.current.timeScale();

        // Check if focus time is within loaded data
        const oldestLoaded = allCandlesRef.current[0]?.time as number;

        // Function to scroll to the focus time without changing zoom
        const scrollToFocusTime = () => {
            // Find the logical index of the candle closest to focusTime
            let targetIndex = -1;
            for (let i = 0; i < allCandlesRef.current.length; i++) {
                const candleTime = allCandlesRef.current[i].time as number;
                if (candleTime >= focusTimeSeconds) {
                    targetIndex = i;
                    break;
                }
            }
            if (targetIndex === -1) {
                targetIndex = allCandlesRef.current.length - 1;
            }

            // Get current visible range to preserve zoom level
            const visibleRange = timeScale.getVisibleLogicalRange();
            if (!visibleRange) return;

            const visibleBars = visibleRange.to - visibleRange.from;
            const halfVisible = Math.floor(visibleBars / 2);

            // Calculate position to center the focusTime
            // scrollToPosition: negative = scroll left (older), positive = scroll right (newer)
            const totalBars = allCandlesRef.current.length;
            const barsToRight = totalBars - targetIndex - 1;
            const scrollPosition = -(barsToRight - halfVisible);

            timeScale.scrollToPosition(scrollPosition, true);
        };

        if (focusTimeSeconds < oldestLoaded) {
            // Need to load older data first - with progress tracking
            const loadUntilFocusTime = async () => {
                navigationCancelledRef.current = false;
                setIsNavigating(true);
                setLoadingMore(true);

                const targetDate = new Date(focusTime).toLocaleDateString();
                setNavigationProgress({ loaded: allCandlesRef.current.length, target: targetDate });

                let attempts = 0;
                const maxAttempts = 100; // Increased from 10 to 100

                while (
                    oldestTimestampRef.current &&
                    oldestTimestampRef.current > focusTimeSeconds &&
                    attempts < maxAttempts &&
                    !navigationCancelledRef.current
                ) {
                    await loadMoreData();
                    attempts++;
                    setNavigationProgress({ loaded: allCandlesRef.current.length, target: targetDate });
                    await new Promise(r => setTimeout(r, 300)); // Reduced delay for faster loading
                }

                setLoadingMore(false);
                setIsNavigating(false);

                // Only scroll if not cancelled
                if (!navigationCancelledRef.current) {
                    setTimeout(scrollToFocusTime, 300);
                }
            };

            loadUntilFocusTime();
        } else {
            // Data is already loaded, just scroll without changing zoom
            scrollToFocusTime();
        }
    }, [focusTime]);

    // Function to cancel navigation
    const cancelNavigation = () => {
        navigationCancelledRef.current = true;
        setIsNavigating(false);
        setLoadingMore(false);
    };


    const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

    return (
        <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-[#111]">
            {/* Header with timeframe selector */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">
                        {toBinanceSymbol(symbol)}
                    </span>
                    <span className="text-xs text-zinc-500">
                        Binance Futures • Real-time
                    </span>
                    {loading && (
                        <div className="flex items-center gap-2 text-blue-400 text-xs">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            Loading...
                        </div>
                    )}
                    {loadingMore && (
                        <div className="flex items-center gap-2 text-amber-400 text-xs">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            Loading history...
                        </div>
                    )}
                    {!loading && !loadingMore && allCandlesRef.current.length > 0 && (
                        <span className="text-xs text-zinc-600">
                            {allCandlesRef.current.length.toLocaleString()} candles
                        </span>
                    )}
                </div>

                {/* Timeframe buttons */}
                <div className="flex bg-zinc-800/50 rounded-lg p-1 border border-zinc-700/50">
                    {timeframes.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${timeframe === tf
                                ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                                }`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Trade count badges */}
            {trades.length > 0 && (
                <div className="absolute top-14 right-4 z-10 flex gap-2">
                    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-1 text-xs text-emerald-400 font-medium">
                        ▲ {trades.filter(t => t.side === 'buy').length} Buys
                    </div>
                    <div className="bg-red-500/20 border border-red-500/30 rounded-full px-2.5 py-1 text-xs text-red-400 font-medium">
                        ▼ {trades.filter(t => t.side === 'sell').length} Sells
                    </div>
                </div>
            )}

            {/* Chart container */}
            <div
                ref={containerRef}
                style={{ height: `${height - 50}px` }}
                className="w-full"
            />

            {/* Navigation Loading Modal */}
            {isNavigating && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm z-20">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <div>
                                <h3 className="text-white font-semibold">Loading Historical Data</h3>
                                <p className="text-zinc-400 text-sm">Navigating to {navigationProgress.target}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-zinc-400 mb-1">
                                <span>Loaded candles</span>
                                <span className="text-amber-400 font-medium">{navigationProgress.loaded.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-zinc-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min((navigationProgress.loaded / 50000) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                                This may take a while for older positions...
                            </p>
                        </div>

                        <button
                            onClick={cancelNavigation}
                            className="w-full px-4 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium border border-red-500/30"
                        >
                            Cancel Navigation
                        </button>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                    <div className="text-center">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button
                            onClick={() => setTimeframe(timeframe)}
                            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Trade list panel */}
            {trades.length > 0 && (
                <div className="border-t border-zinc-800 bg-zinc-900/80 max-h-48 overflow-y-auto">
                    <div className="p-3">
                        <h4 className="text-xs font-medium text-zinc-400 mb-2 flex items-center justify-between">
                            <span>Session Trades ({trades.length})</span>
                            <span className="text-emerald-400/70">● Markers shown on chart</span>
                        </h4>
                        <div className="grid gap-1">
                            {trades.slice(0, 30).map((trade, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${trade.side === 'buy'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}
                                >
                                    <span className="font-semibold uppercase w-10">{trade.side}</span>
                                    <span className="font-mono">{trade.amount.toFixed(4)}</span>
                                    <span className="font-mono">@ {trade.price.toLocaleString()}</span>
                                    <span className="text-zinc-500 text-[10px]">
                                        {new Date(trade.datetime).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                            {trades.length > 30 && (
                                <div className="text-center text-zinc-500 text-xs py-1">
                                    ... and {trades.length - 30} more trades
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Memo to prevent unnecessary re-renders
const TradingViewChart = memo(TradingViewChartInner);
export default TradingViewChart;

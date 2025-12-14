'use client';

import React from 'react';
import { PositionSession, formatDuration, isBinanceSymbol } from '@/lib/types';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Clock,
    DollarSign,
    Target,
    Layers,
    Receipt,
    Activity
} from 'lucide-react';

interface PositionDetailProps {
    session: PositionSession;
    onBack: () => void;
}

export function PositionDetail({ session, onBack }: PositionDetailProps) {
    const isProfit = session.netPnl >= 0;
    const pnlPercent = session.avgEntryPrice > 0 && session.avgExitPrice > 0
        ? ((session.avgExitPrice - session.avgEntryPrice) / session.avgEntryPrice * 100)
        : 0;
    
    // Determine currency based on symbol
    const isBinance = isBinanceSymbol(session.symbol);
    const currency = isBinance ? 'USDT' : 'XBT';
    const pnlDecimals = isBinance ? 2 : 6;
    const feeDecimals = isBinance ? 4 : 8;
    const sizeUnit = isBinance ? session.symbol.replace('USDT', '') : 'BTC';

    // Calculate running position for each trade
    let runningPosition = 0;
    const tradesWithPosition = session.trades.map(trade => {
        const positionBefore = runningPosition;
        if (trade.side === 'buy') {
            runningPosition += trade.amount;
        } else {
            runningPosition -= trade.amount;
        }
        return {
            ...trade,
            positionBefore,
            positionAfter: runningPosition
        };
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Back Button & Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors border border-border"
                >
                    <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                        {session.displaySymbol || session.symbol}
                        <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${session.side === 'long'
                                ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20'
                            }`}>
                            {session.side}
                        </span>
                    </h2>
                    <p className="text-sm text-muted-foreground font-medium mt-0.5">
                        {new Date(session.openTime).toLocaleString()}
                        {session.closeTime && ` → ${new Date(session.closeTime).toLocaleString()}`}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* PnL Card */}
                <div className={`glass rounded-2xl p-1 ${isProfit
                        ? 'ring-1 ring-emerald-500/20'
                        : 'ring-1 ring-rose-500/20'
                    }`}>
                    <div className={`bg-card/50 rounded-xl p-5 h-full ${isProfit ? 'bg-emerald-500/5' : 'bg-rose-500/5'
                        }`}>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">
                            <DollarSign className="w-4 h-4" />
                            Net P&L
                        </div>
                        <div className={`text-2xl font-bold tracking-tight ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isProfit ? '+' : ''}{session.netPnl.toFixed(pnlDecimals)} <span className="text-lg opacity-70">{currency}</span>
                        </div>
                        {session.status === 'closed' && (
                            <div className={`text-sm font-medium mt-1 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                            </div>
                        )}
                    </div>
                </div>

                {/* Entry/Exit Card */}
                <div className="glass rounded-2xl p-1">
                    <div className="bg-card/50 rounded-xl p-5 h-full">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">
                            <Target className="w-4 h-4" />
                            Entry → Exit
                        </div>
                        <div className="text-xl font-bold">
                            ${session.avgEntryPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">
                            → ${session.avgExitPrice > 0
                                ? session.avgExitPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                : 'Open'}
                        </div>
                    </div>
                </div>

                {/* Size Card */}
                <div className="glass rounded-2xl p-1">
                    <div className="bg-card/50 rounded-xl p-5 h-full">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">
                            <Layers className="w-4 h-4" />
                            Max Size
                        </div>
                        <div className="text-xl font-bold">
                            {session.maxSize.toLocaleString()} {sizeUnit}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">
                            ~${(session.maxSize * session.avgEntryPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                        </div>
                    </div>
                </div>

                {/* Duration Card */}
                <div className="glass rounded-2xl p-1">
                    <div className="bg-card/50 rounded-xl p-5 h-full">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">
                            <Clock className="w-4 h-4" />
                            Duration
                        </div>
                        <div className="text-xl font-bold">
                            {formatDuration(session.durationMs)}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">
                            {session.tradeCount} trades
                        </div>
                    </div>
                </div>
            </div>

            {/* Fee Summary */}
            <div className="glass rounded-2xl p-1">
                <div className="bg-amber-500/5 rounded-xl p-4 flex items-center justify-between border border-amber-500/10">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Receipt className="w-4 h-4" />
                        <span className="text-sm font-bold uppercase tracking-wide">Total Fees Paid</span>
                    </div>
                    <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                        {session.totalFees.toFixed(feeDecimals)} {currency}
                    </span>
                </div>
            </div>

            {/* Trade Timeline */}
            <div className="glass rounded-2xl overflow-hidden border border-border/50">
                <div className="px-6 py-4 border-b border-border/50 bg-secondary/30 backdrop-blur-sm">
                    <h3 className="font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Trade Timeline
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                        All {session.tradeCount} trades in this position
                    </p>
                </div>

                <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto bg-card/30">
                    {tradesWithPosition.map((trade, idx) => (
                        <div
                            key={trade.id}
                            className="px-6 py-4 hover:bg-secondary/50 transition-colors relative"
                        >
                            {/* Timeline Line */}
                            {idx !== tradesWithPosition.length - 1 && (
                                <div className="absolute left-[2.25rem] top-10 bottom-0 w-px bg-border/50 -z-10"></div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-4 ring-background ${trade.side === 'buy'
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : 'bg-rose-500/10 text-rose-500'
                                        }`}>
                                        {trade.side === 'buy'
                                            ? <TrendingUp className="w-5 h-5" />
                                            : <TrendingDown className="w-5 h-5" />
                                        }
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm uppercase tracking-wide ${trade.side === 'buy'
                                                    ? 'text-emerald-500'
                                                    : 'text-rose-500'
                                                }`}>
                                                {trade.side}
                                            </span>
                                            <span className="font-mono font-medium">
                                                {trade.amount.toLocaleString()} @ ${trade.price.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                                            {new Date(trade.datetime).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-sm font-medium text-foreground">
                                        Pos: {trade.positionAfter.toLocaleString()}
                                    </div>
                                    <div className={`text-xs font-medium ${(trade.positionAfter - trade.positionBefore) > 0 ? 'text-emerald-500' : 'text-rose-500'
                                        }`}>
                                        {trade.positionBefore >= 0 ? '+' : ''}{trade.positionAfter - trade.positionBefore}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

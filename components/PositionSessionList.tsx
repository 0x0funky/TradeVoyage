'use client';

import React from 'react';
import { PositionSession, formatDuration, isBinanceSymbol } from '@/lib/types';
import { TrendingUp, TrendingDown, Clock, BarChart3, ArrowRight } from 'lucide-react';

interface PositionSessionListProps {
    sessions: PositionSession[];
    onSelectSession: (session: PositionSession) => void;
}

export function PositionSessionList({ sessions, onSelectSession }: PositionSessionListProps) {
    return (
        <div className="space-y-3">
            {sessions.map((session) => {
                const isProfit = session.netPnl >= 0;
                const pnlPercent = session.avgEntryPrice > 0
                    ? ((session.avgExitPrice - session.avgEntryPrice) / session.avgEntryPrice * 100)
                    : 0;

                return (
                    <div
                        key={session.id}
                        onClick={() => onSelectSession(session)}
                        className="glass rounded-xl p-1 hover-card group cursor-pointer"
                    >
                        <div className="bg-card/50 rounded-lg p-4 transition-colors group-hover:bg-card/80">
                            {/* Header Row */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ring-1 ${session.side === 'long'
                                        ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-500 ring-rose-500/20'}`}>
                                        {session.side === 'long'
                                            ? <TrendingUp className="w-5 h-5" />
                                            : <TrendingDown className="w-5 h-5" />
                                        }
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-lg tracking-tight">
                                                {session.displaySymbol || session.symbol}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${session.side === 'long'
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : 'bg-rose-500/10 text-rose-500'
                                                }`}>
                                                {session.side}
                                            </span>
                                            {session.status === 'open' && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 animate-pulse">
                                                    OPEN
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 font-medium">
                                            {new Date(session.openTime).toLocaleDateString()}
                                            {session.closeTime && ` → ${new Date(session.closeTime).toLocaleDateString()}`}
                                        </div>
                                    </div>
                                </div>

                                {/* PnL Display */}
                                <div className="text-right">
                                    {(() => {
                                        const isBinance = isBinanceSymbol(session.symbol);
                                        const currency = isBinance ? 'USDT' : 'XBT';
                                        const decimals = isBinance ? 2 : 6;
                                        return (
                                            <>
                                                <div className={`text-xl font-bold tracking-tight ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {isProfit ? '+' : ''}{session.netPnl.toFixed(decimals)} <span className="text-sm opacity-70">{currency}</span>
                                                </div>
                                                {session.status === 'closed' && (
                                                    <div className={`text-xs font-medium ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-border/50">
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Entry Price</div>
                                    <div className="text-sm font-bold">
                                        ${session.avgEntryPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Exit Price</div>
                                    <div className="text-sm font-bold">
                                        {session.avgExitPrice > 0
                                            ? `$${session.avgExitPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                                            : '-'
                                        }
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Max Size</div>
                                    <div className="text-sm font-bold">
                                        {session.maxSize.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Duration</div>
                                    <div className="text-sm font-bold flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                        {formatDuration(session.durationMs)}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    {session.tradeCount} trades
                                </div>
                                <div className="flex items-center gap-1 text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    View Details
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

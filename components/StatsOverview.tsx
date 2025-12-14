'use client';

import React from 'react';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Target,
    Percent,
    Clock,
    DollarSign,
    Activity,
    Zap
} from 'lucide-react';

interface TradingStats {
    totalTrades: number;
    totalOrders: number;
    filledOrders: number;
    canceledOrders: number;
    fillRate: number;
    cancelRate: number;
    limitOrders: number;
    marketOrders: number;
    limitOrderPercent: number;
    totalRealizedPnl: number;
    totalFunding: number;
    totalFees: number;
    netPnl: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    fundingPaid: number;
    fundingReceived: number;
    tradingDays: number;
    avgTradesPerDay: number;
}

interface AccountSummary {
    wallet: {
        marginBalance: number;
        availableMargin: number;
        unrealisedPnl: number;
    };
    positions: {
        symbol: string;
        displaySymbol?: string;
        currentQty: number;
        avgEntryPrice: number;
        unrealisedPnl: number;
        liquidationPrice: number;
    }[];
}

interface StatsOverviewProps {
    stats: TradingStats;
    account: AccountSummary | null;
    exchange?: 'bitmex' | 'binance';
}

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    color = 'blue',
    trend
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    subValue?: string;
    color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
    trend?: 'up' | 'down';
}) {
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
        green: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
        red: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
        amber: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
        purple: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
    };

    return (
        <div className="glass rounded-xl p-4 hover-card group h-full">
            <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ring-1 ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-lg font-bold tracking-tight text-foreground">{value}</p>
                        {trend && (
                            <div className={`flex items-center ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {trend === 'up'
                                    ? <TrendingUp className="w-4 h-4" />
                                    : <TrendingDown className="w-4 h-4" />
                                }
                            </div>
                        )}
                    </div>
                    {subValue && (
                        <p className="text-xs text-muted-foreground mt-1 font-medium truncate">{subValue}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function StatsOverview({ stats, account, exchange = 'bitmex' }: StatsOverviewProps) {
    const currentPosition = account?.positions?.[0];
    const currencyUnit = exchange === 'binance' ? 'USDT' : 'BTC';

    return (
        <div className="space-y-6">
            {/* Current Account Status */}
            {account && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/40 via-indigo-900/40 to-purple-900/40 border border-white/10 shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
                    <div className="relative p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <p className="text-blue-200/80 text-sm font-medium mb-2 flex items-center gap-2 uppercase tracking-wider">
                                    <Wallet className="w-4 h-4" /> Account Balance
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-4xl font-bold tracking-tight text-white">{account.wallet.marginBalance.toFixed(4)}</p>
                                    <span className="text-xl font-medium text-white/60">{currencyUnit}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-3">
                                    <p className="text-sm text-blue-200/60 font-medium">
                                        Available: <span className="text-blue-100">{account.wallet.availableMargin.toFixed(4)} {currencyUnit}</span>
                                    </p>
                                </div>
                            </div>
                            <div className={`px-5 py-3 rounded-xl backdrop-blur-md border border-white/5 ${account.wallet.unrealisedPnl >= 0
                                ? 'bg-emerald-500/10 text-emerald-200'
                                : 'bg-rose-500/10 text-rose-200'
                                }`}>
                                <p className="text-xs font-bold opacity-70 mb-1 uppercase tracking-wider">Unrealized PnL</p>
                                <p className="text-xl font-bold flex items-center gap-2">
                                    {account.wallet.unrealisedPnl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    {account.wallet.unrealisedPnl >= 0 ? '+' : ''}{account.wallet.unrealisedPnl.toFixed(6)} {currencyUnit}
                                </p>
                            </div>
                        </div>

                        {currentPosition && (
                            <div className="mt-8 pt-6 border-t border-white/10">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                    <div>
                                        <p className="text-blue-200/60 text-xs font-bold uppercase tracking-wider mb-1">Position</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-lg font-bold text-white">
                                                {currentPosition.displaySymbol || currentPosition.symbol.replace('XBT', 'BTC')}
                                            </p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${currentPosition.currentQty > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                                }`}>
                                                {currentPosition.currentQty > 0 ? 'LONG' : 'SHORT'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-blue-200/60 text-xs font-bold uppercase tracking-wider mb-1">Size</p>
                                        <p className="text-lg font-bold text-white">{Math.abs(currentPosition.currentQty).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-200/60 text-xs font-bold uppercase tracking-wider mb-1">Avg Entry</p>
                                        <p className="text-lg font-bold text-white">${currentPosition.avgEntryPrice.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-200/60 text-xs font-bold uppercase tracking-wider mb-1">Liq Price</p>
                                        <p className="text-lg font-bold text-rose-300">${currentPosition.liquidationPrice.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Performance Stats */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <Activity className="w-5 h-5 text-primary" />
                    Performance Metrics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={DollarSign}
                        label="Total Realized PnL"
                        value={`${stats.totalRealizedPnl >= 0 ? '+' : ''}${stats.totalRealizedPnl.toFixed(4)} ${currencyUnit}`}
                        color={stats.totalRealizedPnl >= 0 ? 'green' : 'red'}
                        trend={stats.totalRealizedPnl >= 0 ? 'up' : 'down'}
                    />
                    <StatCard
                        icon={Zap}
                        label="Net Funding"
                        value={`${stats.totalFunding >= 0 ? '+' : ''}${stats.totalFunding.toFixed(4)} ${currencyUnit}`}
                        subValue={`Paid: ${stats.fundingPaid.toFixed(4)} | Rcvd: ${stats.fundingReceived.toFixed(4)}`}
                        color={stats.totalFunding >= 0 ? 'green' : 'amber'}
                    />
                    <StatCard
                        icon={Target}
                        label="Win Rate"
                        value={`${stats.winRate.toFixed(1)}%`}
                        subValue={`${stats.winningTrades}W / ${stats.losingTrades}L`}
                        color={stats.winRate >= 50 ? 'green' : 'red'}
                    />
                    <StatCard
                        icon={BarChart3}
                        label="Profit Factor"
                        value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                        subValue={`Avg Win: ${stats.avgWin.toFixed(6)} | Avg Loss: ${stats.avgLoss.toFixed(6)}`}
                        color={stats.profitFactor >= 1.5 ? 'green' : stats.profitFactor >= 1 ? 'amber' : 'red'}
                    />
                </div>
            </div>

            {/* Trading Activity & Order Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                        <Clock className="w-5 h-5 text-primary" />
                        Activity
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard
                            icon={Activity}
                            label="Total Trades"
                            value={stats.totalTrades.toLocaleString()}
                            subValue={`${stats.tradingDays} trading days`}
                            color="blue"
                        />
                        <StatCard
                            icon={Clock}
                            label="Avg Trades/Day"
                            value={stats.avgTradesPerDay.toFixed(1)}
                            color="purple"
                        />
                        <StatCard
                            icon={Percent}
                            label="Fill Rate"
                            value={`${stats.fillRate.toFixed(1)}%`}
                            subValue={`${stats.filledOrders.toLocaleString()} / ${stats.totalOrders.toLocaleString()}`}
                            color="green"
                        />
                        <StatCard
                            icon={Wallet}
                            label="Total Fees"
                            value={`${stats.totalFees.toFixed(4)} ${currencyUnit}`}
                            color="amber"
                        />
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                        <Target className="w-5 h-5 text-primary" />
                        Order Analysis
                    </h3>
                    <div className="glass rounded-xl p-6 h-[calc(100%-2.5rem)] flex flex-col justify-center">
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="text-center p-4 rounded-lg bg-secondary/30 border border-white/5">
                                <p className="text-2xl font-bold text-blue-400 mb-1">{stats.limitOrders.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Limit</p>
                                <p className="text-xs text-blue-400/80 font-bold mt-1">{stats.limitOrderPercent.toFixed(1)}%</p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-secondary/30 border border-white/5">
                                <p className="text-2xl font-bold text-purple-400 mb-1">{stats.marketOrders.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Market</p>
                                <p className="text-xs text-purple-400/80 font-bold mt-1">{(100 - stats.limitOrderPercent).toFixed(1)}%</p>
                            </div>
                            <div className="text-center p-4 rounded-lg bg-secondary/30 border border-white/5">
                                <p className="text-2xl font-bold text-amber-400 mb-1">{stats.canceledOrders.toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Canceled</p>
                                <p className="text-xs text-amber-400/80 font-bold mt-1">{stats.cancelRate.toFixed(1)}%</p>
                            </div>
                        </div>

                        {/* Order type bar */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                <span>Limit Orders</span>
                                <span>Market Orders</span>
                            </div>
                            <div className="h-3 rounded-full bg-secondary overflow-hidden flex ring-1 ring-white/5">
                                <div
                                    className="bg-blue-500 h-full shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                    style={{ width: `${stats.limitOrderPercent}%` }}
                                />
                                <div
                                    className="bg-purple-500 h-full shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                    style={{ width: `${100 - stats.limitOrderPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

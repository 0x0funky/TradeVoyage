'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';

interface MonthlyData {
    month: string;
    pnl: number;
    funding: number;
    trades: number;
}

interface MonthlyPnLChartProps {
    data: MonthlyData[];
    exchange?: 'bitmex' | 'binance';
}

export function MonthlyPnLChart({ data, exchange = 'bitmex' }: MonthlyPnLChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const currencyUnit = exchange === 'binance' ? 'USDT' : 'BTC';

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3af',
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            rightPriceScale: {
                borderColor: '#334155',
            },
            timeScale: {
                borderColor: '#334155',
                timeVisible: false,
            },
        });

        chartRef.current = chart;

        // Create histogram series for PnL
        const histogramSeries = chart.addHistogramSeries({
            color: '#10b981',
            priceFormat: {
                type: 'custom',
                formatter: (price: number) => price.toFixed(4) + ' ' + currencyUnit,
            },
        });

        // Convert monthly data to chart format
        // Using month index as time (workaround for string months)
        const chartData = data.map((d, index) => {
            const [year, month] = d.month.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            return {
                time: Math.floor(date.getTime() / 1000) as any,
                value: d.pnl,
                color: d.pnl >= 0 ? '#10b981' : '#ef4444',
            };
        });

        histogramSeries.setData(chartData);
        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    // Calculate summary stats
    const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
    const totalFunding = data.reduce((sum, d) => sum + d.funding, 0);
    const profitableMonths = data.filter(d => d.pnl > 0).length;
    const avgMonthlyPnl = data.length > 0 ? totalPnl / data.length : 0;

    return (
        <div className="w-full">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-muted-foreground">
                        {data.length} months tracked
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(4)} {currencyUnit}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {profitableMonths}/{data.length} profitable months ({((profitableMonths / data.length) * 100).toFixed(0)}%)
                    </p>
                </div>
            </div>

            <div ref={chartContainerRef} className="w-full h-[300px]" />

            {/* Monthly summary table */}
            <div className="mt-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                        <tr>
                            <th className="text-left py-2 font-medium">Month</th>
                            <th className="text-right py-2 font-medium">Realized PnL</th>
                            <th className="text-right py-2 font-medium">Funding</th>
                            <th className="text-right py-2 font-medium">Trades</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {[...data].reverse().slice(0, 12).map((d) => (
                            <tr key={d.month} className="hover:bg-secondary/30 transition-colors">
                                <td className="py-2 font-medium">{d.month}</td>
                                <td className={`py-2 text-right font-bold ${d.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(4)}
                                </td>
                                <td className={`py-2 text-right ${d.funding >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {d.funding >= 0 ? '+' : ''}{d.funding.toFixed(4)}
                                </td>
                                <td className="py-2 text-right text-muted-foreground">{d.trades.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { NextResponse } from 'next/server';
import { 
    loadTradesFromCSV, 
    getPaginatedTrades, 
    getOHLCData,
    loadAccountSummary,
    calculateTradingStats,
    getEquityCurve,
    getFundingHistory,
    getPositionSessions,
    toInternalSymbol,
    hasExchangeData,
} from '@/lib/data_loader';
import { ExchangeType } from '@/lib/exchange_types';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const chart = searchParams.get('chart');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const symbol = searchParams.get('symbol') || undefined;
    const timeframe = (searchParams.get('timeframe') || '1d') as '1h' | '4h' | '1d' | '1w';
    const sessionId = searchParams.get('sessionId');
    const exchange = (searchParams.get('exchange') || 'bitmex') as ExchangeType;

    try {
        // Check if exchange data exists
        if (!hasExchangeData(exchange)) {
            return NextResponse.json({
                error: `No data found for ${exchange}. Please import data first.`,
                noData: true,
            }, { status: 404 });
        }

        // Chart data
        if (chart === 'true') {
            const { candles, markers } = getOHLCData(symbol, timeframe, exchange);
            return NextResponse.json({ candles, markers });
        }

        // Stats overview
        if (type === 'stats') {
            const stats = calculateTradingStats(exchange);
            const account = loadAccountSummary(exchange);
            return NextResponse.json({ stats, account });
        }

        // Equity curve data
        if (type === 'equity') {
            const equityCurve = getEquityCurve(exchange);
            return NextResponse.json({ equityCurve });
        }

        // Funding history
        if (type === 'funding') {
            const fundingHistory = getFundingHistory(exchange);
            return NextResponse.json({ fundingHistory });
        }

        // Position Sessions
        if (type === 'sessions') {
            const allSessions = getPositionSessions(exchange);
            
            let filteredSessions = allSessions;
            if (symbol) {
                const internalSymbol = toInternalSymbol(symbol);
                filteredSessions = allSessions.filter(s => 
                    s.symbol === symbol || 
                    s.symbol === internalSymbol || 
                    s.displaySymbol === symbol
                );
            }

            const start = (page - 1) * limit;
            const end = start + limit;
            const paginatedSessions = filteredSessions.slice(start, end);

            // Don't send full trade arrays for list view
            const lightSessions = paginatedSessions.map(s => ({
                ...s,
                trades: []
            }));

            return NextResponse.json({
                sessions: lightSessions,
                total: filteredSessions.length,
                page,
                limit
            });
        }

        // Get specific session with full trade details
        if (sessionId) {
            const allSessions = getPositionSessions(exchange);
            const session = allSessions.find(s => s.id === sessionId);
            
            if (!session) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            return NextResponse.json({ session });
        }

        // Default: Trade list
        const { trades, total } = getPaginatedTrades(page, limit, symbol, exchange);
        return NextResponse.json({ trades, total, page, limit });

    } catch (error) {
        console.error("API Route Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Failed to load data',
            details: errorMessage
        }, { status: 500 });
    }
}

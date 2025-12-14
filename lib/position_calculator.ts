// SERVER-SIDE ONLY - Position Session Calculator
// Separate logic for BitMEX and Binance

import { Execution, Trade, PositionSession, formatSymbol, isBinanceSymbol } from './types';

// ============================================================================
// BITMEX POSITION CALCULATOR (Original Logic)
// Processes execution-by-execution for accurate position tracking
// ============================================================================

interface ExecutionForCalc {
    execID: string;
    orderID: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    lastQty: number;
    lastPx: number;
    execCost: number;
    execComm: number;
    timestamp: string;
    text: string;
}

function calculateBitMEXPositionSessions(executions: Execution[]): PositionSession[] {
    // Filter only actual trade executions
    const tradeExecutions = executions.filter(e =>
        e.execType === 'Trade' &&
        e.side &&
        e.lastQty > 0
    );

    // Group by symbol
    const executionsBySymbol = new Map<string, ExecutionForCalc[]>();

    tradeExecutions.forEach(e => {
        const symbol = e.symbol;
        if (!executionsBySymbol.has(symbol)) {
            executionsBySymbol.set(symbol, []);
        }
        executionsBySymbol.get(symbol)!.push({
            execID: e.execID,
            orderID: e.orderID,
            symbol: e.symbol,
            side: e.side,
            lastQty: e.lastQty,
            lastPx: e.lastPx,
            execCost: e.execCost,
            execComm: e.execComm,
            timestamp: e.timestamp,
            text: e.text,
        });
    });

    const allSessions: PositionSession[] = [];
    let globalSessionId = 0;

    // Process each symbol
    executionsBySymbol.forEach((symbolExecutions, symbol) => {
        // Sort by timestamp
        symbolExecutions.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        let runningPosition = 0;
        let sessionExecutions: ExecutionForCalc[] = [];
        let sessionStartTime: string | null = null;

        // Tracking for current session
        let totalBought = 0;
        let totalSold = 0;
        let totalBuyCost = 0;
        let totalSellCost = 0;
        let totalCommission = 0;
        let maxPosition = 0;

        const closeSession = (endTime: string, endPosition: number) => {
            if (sessionExecutions.length === 0 || sessionStartTime === null) return;

            // Determine session side based on first non-zero position
            const side: 'long' | 'short' = totalBought > totalSold ? 'long' : 'short';

            // Calculate average prices
            const avgEntryPrice = side === 'long'
                ? (totalBought > 0 ? totalBuyCost / totalBought : 0)
                : (totalSold > 0 ? totalSellCost / totalSold : 0);

            const avgExitPrice = side === 'long'
                ? (totalSold > 0 ? totalSellCost / totalSold : 0)
                : (totalBought > 0 ? totalBuyCost / totalBought : 0);

            // Calculate realized PnL for inverse contracts
            let realizedPnl = 0;
            const closedQty = Math.min(totalBought, totalSold);

            if (closedQty > 0 && avgEntryPrice > 0 && avgExitPrice > 0) {
                // Inverse contract: PnL = qty * (1/entry - 1/exit) for long
                if (side === 'long') {
                    realizedPnl = closedQty * (1 / avgEntryPrice - 1 / avgExitPrice);
                } else {
                    realizedPnl = closedQty * (1 / avgExitPrice - 1 / avgEntryPrice);
                }
            }

            // Convert commission from satoshis to BTC
            const totalFees = Math.abs(totalCommission) / 100000000;

            // Convert executions to trades for the session
            const trades: Trade[] = sessionExecutions.map(e => ({
                id: e.execID,
                datetime: e.timestamp,
                symbol: e.symbol,
                displaySymbol: formatSymbol(e.symbol),
                side: e.side.toLowerCase() as 'buy' | 'sell',
                price: e.lastPx,
                amount: e.lastQty,
                cost: Math.abs(e.execCost),
                fee: {
                    cost: e.execComm,
                    currency: 'XBT',
                },
                orderID: e.orderID,
                execType: 'Trade',
            }));

            const durationMs = new Date(endTime).getTime() - new Date(sessionStartTime).getTime();

            allSessions.push({
                id: `${symbol}-${globalSessionId++}`,
                symbol,
                displaySymbol: formatSymbol(symbol),
                side,
                openTime: sessionStartTime,
                closeTime: endPosition === 0 ? endTime : null,
                durationMs,
                maxSize: maxPosition,
                totalBought,
                totalSold,
                avgEntryPrice,
                avgExitPrice: endPosition === 0 ? avgExitPrice : 0,
                realizedPnl: endPosition === 0 ? realizedPnl : 0,
                totalFees,
                netPnl: endPosition === 0 ? realizedPnl - totalFees : -totalFees,
                tradeCount: sessionExecutions.length,
                trades,
                status: endPosition === 0 ? 'closed' : 'open',
            });
        };

        const resetSession = () => {
            sessionExecutions = [];
            sessionStartTime = null;
            totalBought = 0;
            totalSold = 0;
            totalBuyCost = 0;
            totalSellCost = 0;
            totalCommission = 0;
            maxPosition = 0;
        };

        // Process each execution
        for (const exec of symbolExecutions) {
            const positionBefore = runningPosition;
            const qty = exec.lastQty;
            const price = exec.lastPx;

            // Update running position
            if (exec.side === 'Buy') {
                runningPosition += qty;
                totalBought += qty;
                totalBuyCost += qty * price;
            } else {
                runningPosition -= qty;
                totalSold += qty;
                totalSellCost += qty * price;
            }

            totalCommission += exec.execComm;
            sessionExecutions.push(exec);
            maxPosition = Math.max(maxPosition, Math.abs(runningPosition));

            // Check for session start
            if (positionBefore === 0 && runningPosition !== 0) {
                sessionStartTime = exec.timestamp;
            }

            // Check for session end (position back to 0)
            if (positionBefore !== 0 && runningPosition === 0) {
                closeSession(exec.timestamp, 0);
                resetSession();
            }

            // Check for position flip (long to short or short to long)
            if ((positionBefore > 0 && runningPosition < 0) ||
                (positionBefore < 0 && runningPosition > 0)) {

                // Close the previous session at the flip point
                const overflowQty = Math.abs(runningPosition);

                // Adjust the last session's totals
                if (exec.side === 'Buy') {
                    totalBought -= overflowQty;
                    totalBuyCost -= overflowQty * price;
                } else {
                    totalSold -= overflowQty;
                    totalSellCost -= overflowQty * price;
                }

                closeSession(exec.timestamp, 0);
                resetSession();

                // Start new session with the overflow
                sessionStartTime = exec.timestamp;
                sessionExecutions = [exec];
                if (exec.side === 'Buy') {
                    totalBought = overflowQty;
                    totalBuyCost = overflowQty * price;
                } else {
                    totalSold = overflowQty;
                    totalSellCost = overflowQty * price;
                }
                totalCommission = exec.execComm;
                maxPosition = overflowQty;
            }
        }

        // Handle any remaining open position
        if (runningPosition !== 0 && sessionExecutions.length > 0) {
            closeSession(
                sessionExecutions[sessionExecutions.length - 1].timestamp,
                runningPosition
            );
        }
    });

    // Sort by close time (or open time), newest first
    allSessions.sort((a, b) => {
        const timeA = new Date(a.closeTime || a.openTime).getTime();
        const timeB = new Date(b.closeTime || b.openTime).getTime();
        return timeB - timeA;
    });

    return allSessions;
}

// ============================================================================
// BINANCE POSITION CALCULATOR
// Handles HEDGE MODE (dual position) - LONG and SHORT positions tracked separately
// Uses realizedPnl from execution data
// ============================================================================

const BINANCE_POSITION_TOLERANCE = 0.01; // 0.01 BTC/ETH
const BINANCE_SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

function parseRealizedPnlFromText(text: string): number {
    if (!text) return 0;
    const match = text.match(/realizedPnl[:\s]*(-?[\d.]+)/i);
    return match ? parseFloat(match[1]) || 0 : 0;
}

function parsePositionSideFromText(text: string): 'LONG' | 'SHORT' | 'BOTH' {
    if (!text) return 'BOTH';
    const match = text.match(/positionSide:(\w+)/i);
    if (match) {
        const side = match[1].toUpperCase();
        if (side === 'LONG' || side === 'SHORT') return side;
    }
    return 'BOTH';
}

function isBinancePositionClosed(position: number): boolean {
    return Math.abs(position) < BINANCE_POSITION_TOLERANCE;
}

interface BinanceAggregatedOrder {
    orderID: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    positionSide: 'LONG' | 'SHORT' | 'BOTH';
    totalQty: number;
    avgPrice: number;
    totalCost: number;
    totalComm: number;
    realizedPnl: number;
    timestamp: string;
    executions: Execution[];
}

function calculateBinancePositionSessions(executions: Execution[]): PositionSession[] {
    const tradeExecutions = executions.filter(e => 
        e.execType === 'Trade' && e.side && e.lastQty > 0
    );

    // Group by symbol + positionSide for hedge mode support
    // Key format: "BTCUSDT:LONG" or "ETHUSDT:SHORT"
    const executionsByKey = new Map<string, Execution[]>();
    tradeExecutions.forEach(e => {
        const positionSide = parsePositionSideFromText(e.text);
        const key = `${e.symbol}:${positionSide}`;
        if (!executionsByKey.has(key)) {
            executionsByKey.set(key, []);
        }
        executionsByKey.get(key)!.push(e);
    });

    const allSessions: PositionSession[] = [];
    let globalSessionId = 0;

    executionsByKey.forEach((keyExecutions, key) => {
        const [symbol, positionSideStr] = key.split(':');
        const positionSide = positionSideStr as 'LONG' | 'SHORT' | 'BOTH';
        
        // Step 1: Aggregate executions by orderID
        const orderMap = new Map<string, BinanceAggregatedOrder>();
        
        keyExecutions.forEach(e => {
            const orderID = e.orderID;
            const pnl = parseRealizedPnlFromText(e.text);
            
            if (!orderMap.has(orderID)) {
                orderMap.set(orderID, {
                    orderID,
                    symbol: e.symbol,
                    side: e.side,
                    positionSide,
                    totalQty: 0,
                    avgPrice: 0,
                    totalCost: 0,
                    totalComm: 0,
                    realizedPnl: 0,
                    timestamp: e.timestamp,
                    executions: [],
                });
            }
            
            const order = orderMap.get(orderID)!;
            order.totalQty += e.lastQty;
            order.totalCost += e.lastQty * e.lastPx;
            order.totalComm += e.execComm;
            order.realizedPnl += pnl;
            order.executions.push(e);
            
            if (e.timestamp < order.timestamp) {
                order.timestamp = e.timestamp;
            }
        });
        
        orderMap.forEach(order => {
            order.avgPrice = order.totalQty > 0 ? order.totalCost / order.totalQty : 0;
        });
        
        // Step 2: Sort orders by timestamp
        const orders = Array.from(orderMap.values())
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Step 3: Build position sessions
        // For HEDGE MODE:
        // - LONG position: Buy = open/add, Sell = close
        // - SHORT position: Sell = open/add, Buy = close
        const isShortPosition = positionSide === 'SHORT';
        
        let runningPosition = 0;
        let sessionOrders: BinanceAggregatedOrder[] = [];
        let sessionStartTime: string | null = null;
        let lastOrderTime = 0;
        
        // Helper to calculate position change based on positionSide
        const getPositionDelta = (order: BinanceAggregatedOrder): number => {
            if (isShortPosition) {
                // SHORT: Sell opens/adds, Buy closes
                return order.side === 'Sell' ? order.totalQty : -order.totalQty;
            } else {
                // LONG/BOTH: Buy opens/adds, Sell closes
                return order.side === 'Buy' ? order.totalQty : -order.totalQty;
            }
        };
        
        const closeSession = (endTime: string) => {
            if (sessionOrders.length === 0 || sessionStartTime === null) return;
            
            let totalEntry = 0, totalExit = 0;
            let totalEntryCost = 0, totalExitCost = 0;
            let totalComm = 0, totalRealizedPnl = 0;
            
            sessionOrders.forEach(order => {
                const isOpening = isShortPosition 
                    ? order.side === 'Sell'  // SHORT: Sell opens
                    : order.side === 'Buy';  // LONG: Buy opens
                    
                if (isOpening) {
                    totalEntry += order.totalQty;
                    totalEntryCost += order.totalCost;
                } else {
                    totalExit += order.totalQty;
                    totalExitCost += order.totalCost;
                }
                totalComm += order.totalComm;
                totalRealizedPnl += order.realizedPnl;
            });
            
            // Session side is determined by positionSide
            const side: 'long' | 'short' = isShortPosition ? 'short' : 'long';
            
            const avgEntryPrice = totalEntry > 0 ? totalEntryCost / totalEntry : 0;
            const avgExitPrice = totalExit > 0 ? totalExitCost / totalExit : 0;
            
            // For Binance, use realizedPnl directly from execution data
            const realizedPnl = totalRealizedPnl;
            const totalFees = Math.abs(totalComm) / 100000000;
            
            // Calculate max position
            let tempPos = 0, maxPosition = 0;
            sessionOrders.forEach(order => {
                tempPos += getPositionDelta(order);
                maxPosition = Math.max(maxPosition, Math.abs(tempPos));
            });
            
            // Build trades array
            const trades: Trade[] = [];
            sessionOrders.forEach(order => {
                order.executions.forEach(e => {
                    trades.push({
                        id: e.execID,
                        datetime: e.timestamp,
                        symbol: e.symbol,
                        displaySymbol: formatSymbol(e.symbol),
                        side: e.side.toLowerCase() as 'buy' | 'sell',
                        price: e.lastPx,
                        amount: e.lastQty,
                        cost: Math.abs(e.execCost),
                        fee: { cost: e.execComm, currency: 'USDT' },
                        orderID: e.orderID,
                        execType: 'Trade',
                    });
                });
            });
            
            trades.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
            
            const isClosed = isBinancePositionClosed(totalEntry - totalExit);
            const durationMs = new Date(endTime).getTime() - new Date(sessionStartTime!).getTime();
            
            allSessions.push({
                id: `${symbol}-${positionSide}-${globalSessionId++}`,
                symbol,
                displaySymbol: formatSymbol(symbol),
                side,
                openTime: sessionStartTime!,
                closeTime: isClosed ? endTime : null,
                durationMs,
                maxSize: maxPosition,
                totalBought: isShortPosition ? totalExit : totalEntry,  // For display consistency
                totalSold: isShortPosition ? totalEntry : totalExit,
                avgEntryPrice,
                avgExitPrice: isClosed ? avgExitPrice : 0,
                realizedPnl: isClosed ? realizedPnl : 0,
                totalFees,
                netPnl: isClosed ? realizedPnl - totalFees : -totalFees,
                tradeCount: trades.length,
                trades,
                status: isClosed ? 'closed' : 'open',
            });
        };
        
        const resetSession = () => {
            sessionOrders = [];
            sessionStartTime = null;
        };
        
        // Step 4: Process each order
        for (const order of orders) {
            const orderTime = new Date(order.timestamp).getTime();
            const timeSinceLastOrder = lastOrderTime > 0 ? orderTime - lastOrderTime : 0;
            const positionBefore = runningPosition;
            const wasPositionClosed = isBinancePositionClosed(positionBefore);
            
            // Time gap check - only close if position is small
            if (timeSinceLastOrder > BINANCE_SESSION_GAP_MS && sessionOrders.length > 0 && wasPositionClosed) {
                closeSession(sessionOrders[sessionOrders.length - 1].timestamp);
                resetSession();
                runningPosition = 0;
            }
            
            // Update running position using positionSide-aware logic
            runningPosition += getPositionDelta(order);
            
            const isNowClosed = isBinancePositionClosed(runningPosition);
            
            // Session start
            if (wasPositionClosed && !isNowClosed && sessionOrders.length === 0) {
                sessionStartTime = order.timestamp;
            }
            
            sessionOrders.push(order);
            lastOrderTime = orderTime;
            
            // Session end - position returned to ~0
            if (!wasPositionClosed && isNowClosed) {
                closeSession(order.timestamp);
                resetSession();
                runningPosition = 0;
            }
        }
        
        // Handle remaining open position
        if (sessionOrders.length > 0) {
            closeSession(sessionOrders[sessionOrders.length - 1].timestamp);
        }
    });

    allSessions.sort((a, b) => {
        const timeA = new Date(a.closeTime || a.openTime).getTime();
        const timeB = new Date(b.closeTime || b.openTime).getTime();
        return timeB - timeA;
    });

    return allSessions;
}

// ============================================================================
// MAIN ENTRY POINT
// Automatically selects the correct calculator based on exchange
// ============================================================================

export function calculatePositionSessionsFromExecutions(
    executions: Execution[],
    exchangeId?: string
): PositionSession[] {
    if (executions.length === 0) return [];
    
    // Auto-detect exchange from first execution's symbol
    const firstSymbol = executions[0]?.symbol || '';
    const isBinance = exchangeId === 'binance' || isBinanceSymbol(firstSymbol);
    
    if (isBinance) {
        console.log('[Position Calculator] Using Binance calculator');
        return calculateBinancePositionSessions(executions);
    } else {
        console.log('[Position Calculator] Using BitMEX calculator');
        return calculateBitMEXPositionSessions(executions);
    }
}

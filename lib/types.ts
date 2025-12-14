// ============ Symbol Mapping ============
const SYMBOL_MAP: Record<string, string> = {
    'XBTUSD': 'BTCUSD',
    'XBTUSDT': 'BTCUSDT',
    'ETHUSD': 'ETHUSD',
    'ETHUSDT': 'ETHUSDT',
};

export function formatSymbol(symbol: string): string {
    return SYMBOL_MAP[symbol] || symbol.replace('XBT', 'BTC');
}

export function toInternalSymbol(displaySymbol: string): string {
    // Only convert for BitMEX style symbols (BTCUSD -> XBTUSD)
    // Don't convert USDT pairs (BTCUSDT stays BTCUSDT)
    if (displaySymbol.endsWith('USDT')) {
        return displaySymbol;
    }
    return displaySymbol.replace('BTC', 'XBT');
}

// Check if symbol is from Binance (USDT-margined)
export function isBinanceSymbol(symbol: string): boolean {
    return symbol.endsWith('USDT') && !symbol.startsWith('XBT');
}

// Check if contract is inverse (settled in BTC) - only BitMEX XBTUSD/ETHUSD
export function isInverseContract(symbol: string): boolean {
    return symbol === 'XBTUSD' || symbol === 'ETHUSD' || 
           symbol === 'BTCUSD' || // Display symbol for XBTUSD
           (symbol.startsWith('XBT') && !symbol.endsWith('USDT'));
}

// ============ Types ============

export interface Execution {
    execID: string;
    orderID: string;
    symbol: string;
    displaySymbol: string;
    side: 'Buy' | 'Sell';
    lastQty: number;
    lastPx: number;
    execType: 'Trade' | 'Funding' | 'Settlement' | 'Canceled' | 'New' | 'Replaced';
    ordType: string;
    ordStatus: string;
    execCost: number;
    execComm: number;
    timestamp: string;
    text: string;
}

export interface Trade {
    id: string;
    datetime: string;
    symbol: string;
    displaySymbol: string;
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    cost: number;
    fee: {
        cost: number;
        currency: string;
    };
    orderID: string;
    execType: string;
    executionCount?: number; // Number of partial fills for this order
}

export interface Order {
    orderID: string;
    symbol: string;
    displaySymbol: string;
    side: 'Buy' | 'Sell';
    ordType: 'Limit' | 'Market' | 'Stop' | 'StopLimit';
    orderQty: number;
    price: number | null;
    stopPx: number | null;
    avgPx: number | null;
    cumQty: number;
    ordStatus: 'Filled' | 'Canceled' | 'Rejected' | 'New' | 'PartiallyFilled';
    timestamp: string;
    text: string;
}

export interface WalletTransaction {
    transactID: string;
    account: number | string;  // number for BitMEX, string (symbol) for Binance
    currency: string;
    transactType: 'RealisedPNL' | 'Funding' | 'Deposit' | 'Withdrawal' | 'UnrealisedPNL' | 'AffiliatePayout' | 'Transfer' | 'Commission';
    amount: number;
    fee: number;
    transactStatus: string;
    address: string;
    tx: string;
    text: string;
    timestamp: string;
    walletBalance: number;
    marginBalance: number | null;
}

export interface AccountSummary {
    exportDate: string;
    user: {
        id: number;
        username: string;
        email: string;
    };
    wallet: {
        walletBalance: number | null;
        marginBalance: number;
        availableMargin: number;
        unrealisedPnl: number;
        realisedPnl: number;
    };
    positions: {
        symbol: string;
        displaySymbol: string;
        currentQty: number;
        avgEntryPrice: number;
        unrealisedPnl: number;
        liquidationPrice: number;
    }[];
}

export interface TradingStats {
    totalTrades: number;
    totalOrders: number;
    filledOrders: number;
    canceledOrders: number;
    rejectedOrders: number;
    fillRate: number;
    cancelRate: number;
    limitOrders: number;
    marketOrders: number;
    stopOrders: number;
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
    monthlyPnl: { month: string; pnl: number; funding: number; trades: number }[];
}

// ============ Position Session Types ============

export interface PositionSession {
    id: string;
    symbol: string;
    displaySymbol: string;
    side: 'long' | 'short';
    openTime: string;
    closeTime: string | null;
    durationMs: number;
    maxSize: number;
    totalBought: number;
    totalSold: number;
    avgEntryPrice: number;
    avgExitPrice: number;
    realizedPnl: number;
    totalFees: number;
    netPnl: number;
    tradeCount: number;
    trades: Trade[];
    status: 'open' | 'closed';
}

// ============ Utility Functions ============

export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${seconds}s`;
}


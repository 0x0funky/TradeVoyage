// ============ Exchange Types ============

export type ExchangeType = 'bitmex' | 'binance';

export interface ExchangeConfig {
    exchange: ExchangeType;
    apiKey: string;
    apiSecret: string;
    startDate: string;
    endDate: string;
    forceRefetch?: boolean;
}

// ============ Symbol Mapping ============

const BITMEX_SYMBOL_MAP: Record<string, string> = {
    'XBTUSD': 'BTCUSD',
    'XBTUSDT': 'BTCUSDT',
    'ETHUSD': 'ETHUSD',
    'ETHUSDT': 'ETHUSDT',
};

const BINANCE_SYMBOL_MAP: Record<string, string> = {
    'BTCUSDT': 'BTCUSDT',
    'ETHUSDT': 'ETHUSDT',
    'BTCUSD_PERP': 'BTCUSD',
    'ETHUSD_PERP': 'ETHUSD',
};

export function formatSymbol(symbol: string, exchange: ExchangeType = 'bitmex'): string {
    if (exchange === 'bitmex') {
        return BITMEX_SYMBOL_MAP[symbol] || symbol.replace('XBT', 'BTC');
    }
    return BINANCE_SYMBOL_MAP[symbol] || symbol;
}

export function toInternalSymbol(displaySymbol: string, exchange: ExchangeType = 'bitmex'): string {
    if (exchange === 'bitmex') {
        return displaySymbol.replace('BTC', 'XBT');
    }
    return displaySymbol;
}

// ============ Common Execution/Trade Types ============

export interface UnifiedExecution {
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
    execCost: number;  // In satoshis for BTC
    execComm: number;  // In satoshis for BTC
    timestamp: string;
    text: string;
    exchange: ExchangeType;
}

export interface UnifiedTrade {
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
    executionCount?: number;
    exchange: ExchangeType;
}

export interface UnifiedOrder {
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
    exchange: ExchangeType;
}

export interface UnifiedWalletTransaction {
    transactID: string;
    account: number | string;
    currency: string;
    transactType: 'RealisedPNL' | 'Funding' | 'Deposit' | 'Withdrawal' | 'UnrealisedPNL' | 'AffiliatePayout' | 'Transfer' | 'Commission';
    amount: number;  // In satoshis for BTC
    fee: number;
    transactStatus: string;
    address: string;
    tx: string;
    text: string;
    timestamp: string;
    walletBalance: number;
    marginBalance: number | null;
    exchange: ExchangeType;
}

export interface UnifiedAccountSummary {
    exportDate: string;
    exchange: ExchangeType;
    user: {
        id: number | string;
        username: string;
        email?: string;
    };
    wallet: {
        walletBalance: number | null;
        marginBalance: number;
        availableMargin: number;
        unrealisedPnl: number;
        realisedPnl: number;
        currency: string;
    };
    positions: {
        symbol: string;
        displaySymbol: string;
        currentQty: number;
        avgEntryPrice: number;
        unrealisedPnl: number;
        liquidationPrice: number | null;
    }[];
}

// ============ Import Result Types ============

export interface ImportProgress {
    status: 'idle' | 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete' | 'error';
    message: string;
    progress: number; // 0-100
    details?: {
        executions?: number;
        trades?: number;
        orders?: number;
        walletHistory?: number;
    };
}

export interface ImportResult {
    success: boolean;
    message: string;
    stats?: {
        executions: number;
        trades: number;
        orders: number;
        walletHistory: number;
    };
    error?: string;
}

// ============ Exchange Supported Symbols ============

export const EXCHANGE_SYMBOLS: Record<ExchangeType, string[]> = {
    bitmex: ['BTCUSD', 'ETHUSD'],
    binance: ['BTCUSDT', 'ETHUSDT', 'BTCUSD_PERP', 'ETHUSD_PERP'],
};

export const EXCHANGE_DISPLAY_NAMES: Record<ExchangeType, string> = {
    bitmex: 'BitMEX',
    binance: 'Binance Futures',
};


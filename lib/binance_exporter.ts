/**
 * Binance Futures Data Exporter
 * 
 * Exports:
 * 1. Trade History - 成交記錄
 * 2. Order History - 訂單歷史
 * 3. Income History (Funding, PnL) - 資金費率、已實現盈虧
 * 4. Account Info - 帳戶資訊
 */

import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { 
    ExchangeConfig, 
    formatSymbol,
    UnifiedExecution,
    UnifiedWalletTransaction,
    UnifiedAccountSummary,
    ImportResult 
} from './exchange_types';

const BINANCE_FUTURES_BASE = 'fapi.binance.com';
const SAT_TO_BTC = 100000000;

// Rate limiting settings
const REQUEST_DELAY = 500; // 500ms between requests
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Check if CSV file exists and has data
function csvExists(filename: string): boolean {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    return stats.size > 100; // More than just headers
}

interface BinanceRequestParams {
    [key: string]: string | number | undefined;
}

// Server time offset (to sync with Binance server)
let serverTimeOffset = 0;

// Sleep helper
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get server time and calculate offset
async function syncServerTime(): Promise<void> {
    return new Promise((resolve, reject) => {
        const localTime = Date.now();
        
        const options = {
            hostname: BINANCE_FUTURES_BASE,
            port: 443,
            path: '/fapi/v1/time',
            method: 'GET',
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.serverTime) {
                        serverTimeOffset = json.serverTime - localTime;
                        console.log(`   ⏱️ Server time synced (offset: ${serverTimeOffset}ms)`);
                    }
                    resolve();
                } catch (e) {
                    console.warn('Failed to sync server time, using local time');
                    resolve();
                }
            });
        });
        
        req.on('error', () => {
            console.warn('Failed to sync server time, using local time');
            resolve();
        });
        req.end();
    });
}

// Helper function to make signed Binance Futures API requests
async function binanceRequest(
    apiKey: string,
    apiSecret: string,
    method: string,
    endpoint: string,
    params: BinanceRequestParams = {}
): Promise<any> {
    return new Promise((resolve, reject) => {
        // Use synced server time
        const timestamp = Date.now() + serverTimeOffset;
        const queryParams = { ...params, timestamp, recvWindow: 60000 };
        
        const queryString = Object.entries(queryParams)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
            .join('&');
        
        const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
        const fullQuery = `${queryString}&signature=${signature}`;
        
        const requestPath = method === 'GET' ? `${endpoint}?${fullQuery}` : endpoint;
        const body = method === 'POST' ? fullQuery : '';
        
        const options = {
            hostname: BINANCE_FUTURES_BASE,
            port: 443,
            path: requestPath,
            method: method,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-MBX-APIKEY': apiKey,
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(json)}`));
                    } else {
                        resolve(json);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${data}`));
                }
            });
        });
        
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Export Binance Orders (All Orders History)
// NOTE: Binance API only allows fetching orders from the last 90 days!
async function exportBinanceOrders(config: ExchangeConfig, forceRefetch: boolean = false): Promise<number> {
    const csvFile = 'binance_orders.csv';
    
    // Skip if file exists and not forcing refetch
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n📋 Binance Orders: Using existing CSV (skip fetch)');
        return 0;
    }
    
    console.log('\n📋 Exporting Binance Order History...');
    console.log('   ⚠️ Note: Binance API only allows fetching orders from the last 90 days');
    
    const { apiKey, apiSecret, endDate } = config;
    const allOrders: any[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    // Binance only allows fetching the last 90 days of orders
    const now = Date.now();
    const earliestAllowed = now - NINETY_DAYS_MS + (24 * 60 * 60 * 1000); // Add 1 day buffer
    const endTime = Math.min(new Date(endDate).getTime(), now);
    const startTime = earliestAllowed;
    
    console.log(`   📅 Fetching orders from: ${new Date(startTime).toISOString().split('T')[0]} to ${new Date(endTime).toISOString().split('T')[0]}`);
    
    for (const symbol of symbols) {
        console.log(`   Processing ${symbol} orders...`);
        let symbolCount = 0;
        
        await sleep(REQUEST_DELAY);
        
        try {
            // For orders, we don't use time range - just fetch all recent orders
            const params: BinanceRequestParams = {
                symbol,
                limit: 1000,
            };
            
            const orders = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/allOrders', params);
            
            if (orders && orders.length > 0) {
                allOrders.push(...orders);
                symbolCount += orders.length;
            }
            
            console.log(`   ✅ ${symbol}: ${symbolCount} orders`);
            
        } catch (error: any) {
            if (error.message.includes('429') || error.message.includes('418')) {
                console.log(`   ⚠️ Rate limited, waiting 60s...`);
                await sleep(60000);
            } else {
                console.error(`   ⚠️ ${symbol} orders error: ${error.message}`);
            }
        }
    }
    
    // Save orders to CSV
    if (allOrders.length > 0) {
        const ordersPath = path.join(process.cwd(), csvFile);
        const ordersHeaders = 'orderID,symbol,side,ordType,orderQty,price,stopPx,avgPx,cumQty,ordStatus,timestamp,text\n';
        const ordersRows = allOrders.map(o => [
            o.orderId,
            o.symbol,
            o.side,
            o.type,
            o.origQty,
            o.price || '',
            o.stopPrice || '',
            o.avgPrice || '',
            o.executedQty || 0,
            o.status,
            new Date(o.time).toISOString(),
            `"${(o.clientOrderId || '').replace(/"/g, '""')}"`
        ].join(',')).join('\n');
        fs.writeFileSync(ordersPath, ordersHeaders + ordersRows);
        console.log(`   ✅ Orders saved: ${allOrders.length}`);
    }
    
    return allOrders.length;
}

// Export Binance Trades (User Trade History) - with 7-day chunking
async function exportBinanceTrades(config: ExchangeConfig, forceRefetch: boolean = false): Promise<UnifiedExecution[]> {
    const csvFile = 'binance_executions.csv';
    
    // Skip if file exists and not forcing refetch
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n📊 Binance Trades: Using existing CSV (skip fetch)');
        // Return empty - data will be loaded from existing CSV
        return [];
    }
    
    console.log('\n📊 Exporting Binance Trade History...');
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const allExecutions: UnifiedExecution[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    for (const symbol of symbols) {
        console.log(`   Processing ${symbol}...`);
        let symbolCount = 0;
        
        // Split into 7-day chunks
        let currentStart = startTime;
        while (currentStart < endTime) {
            const currentEnd = Math.min(currentStart + SEVEN_DAYS_MS - 1, endTime);
            
            await sleep(REQUEST_DELAY);
            
            try {
                const params: BinanceRequestParams = {
                    symbol,
                    limit: 1000,
                    startTime: currentStart,
                    endTime: currentEnd,
                };
                
                const trades = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/userTrades', params);
                
                if (trades && trades.length > 0) {
                    const executions: UnifiedExecution[] = trades.map((t: any) => {
                        const side: 'Buy' | 'Sell' = t.side === 'BUY' ? 'Buy' : 'Sell';
                        const qty = parseFloat(t.qty);
                        const price = parseFloat(t.price);
                        const commission = parseFloat(t.commission);
                        const realizedPnl = parseFloat(t.realizedPnl || '0');
                        const positionSide = t.positionSide || 'BOTH'; // LONG, SHORT, or BOTH (one-way mode)
                        
                        const execCost = qty * price;
                        const execComm = t.commissionAsset === 'USDT' ? commission : commission * price;
                        
                        return {
                            execID: t.id.toString(),
                            orderID: t.orderId.toString(),
                            symbol: t.symbol,
                            displaySymbol: formatSymbol(t.symbol, 'binance'),
                            side,
                            lastQty: qty,
                            lastPx: price,
                            execType: 'Trade' as const,
                            ordType: t.maker ? 'Limit' : 'Market',
                            ordStatus: 'Filled',
                            execCost: Math.round(execCost * SAT_TO_BTC),
                            execComm: Math.round(execComm * SAT_TO_BTC),
                            timestamp: new Date(t.time).toISOString(),
                            // Store realizedPnl and positionSide for position calculation
                            text: `realizedPnl:${realizedPnl}|positionSide:${positionSide}|buyer:${t.buyer}`,
                            exchange: 'binance' as const,
                        };
                    });
                    
                    allExecutions.push(...executions);
                    symbolCount += trades.length;
                }
                
                process.stdout.write(`\r   ${symbol}: ${symbolCount} trades (${new Date(currentStart).toISOString().split('T')[0]} - ${new Date(currentEnd).toISOString().split('T')[0]})    `);
                
            } catch (error: any) {
                // If rate limited, wait longer
                if (error.message.includes('429') || error.message.includes('418')) {
                    console.log(`\n   ⚠️ Rate limited, waiting 60s...`);
                    await sleep(60000);
                } else {
                    console.error(`\n   ⚠️ ${symbol} error: ${error.message}`);
                }
            }
            
            currentStart = currentEnd + 1;
        }
        
        console.log(`\n   ✅ ${symbol}: ${symbolCount} trades total`);
    }
    
    return allExecutions;
}

// Export Binance Income History (Funding, PnL, etc.) - optimized to avoid rate limits
async function exportBinanceIncome(config: ExchangeConfig, forceRefetch: boolean = false): Promise<UnifiedWalletTransaction[]> {
    const csvFile = 'binance_wallet_history.csv';
    
    // Skip if file exists and not forcing refetch
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n💰 Binance Income: Using existing CSV (skip fetch)');
        return [];
    }
    
    console.log('\n💰 Exporting Binance Income History...');
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const allTransactions: UnifiedWalletTransaction[] = [];
    
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    // Process income types one at a time with longer delays
    const incomeTypes = ['REALIZED_PNL', 'FUNDING_FEE'];
    
    for (const incomeType of incomeTypes) {
        console.log(`   Processing ${incomeType}...`);
        let typeCount = 0;
        
        // Split into 7-day chunks
        let currentStart = startTime;
        while (currentStart < endTime) {
            const currentEnd = Math.min(currentStart + SEVEN_DAYS_MS - 1, endTime);
            
            await sleep(REQUEST_DELAY * 2); // Longer delay for income history
            
            try {
                const params: BinanceRequestParams = {
                    incomeType,
                    startTime: currentStart,
                    endTime: currentEnd,
                    limit: 1000,
                };
                
                const income = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/income', params);
                
                if (income && income.length > 0) {
                    const transactions: UnifiedWalletTransaction[] = income.map((i: any) => {
                        const amount = parseFloat(i.income);
                        const transactType = mapBinanceIncomeType(i.incomeType);
                        
                        return {
                            transactID: i.tranId?.toString() || `${i.time}-${i.incomeType}`,
                            account: i.symbol || 'USDT',
                            currency: i.asset || 'USDT',
                            transactType,
                            amount: Math.round(amount * SAT_TO_BTC),
                            fee: 0,
                            transactStatus: 'Completed',
                            address: '',
                            tx: '',
                            text: i.info || '',
                            timestamp: new Date(i.time).toISOString(),
                            walletBalance: 0,
                            marginBalance: null,
                            exchange: 'binance' as const,
                        };
                    });
                    
                    allTransactions.push(...transactions);
                    typeCount += income.length;
                }
                
                process.stdout.write(`\r   ${incomeType}: ${typeCount} records (${new Date(currentStart).toISOString().split('T')[0]})    `);
                
            } catch (error: any) {
                if (error.message.includes('429') || error.message.includes('418')) {
                    console.log(`\n   ⚠️ Rate limited, waiting 60s...`);
                    await sleep(60000);
                    // Retry this chunk
                    continue;
                } else {
                    console.error(`\n   ⚠️ ${incomeType} error: ${error.message}`);
                }
            }
            
            currentStart = currentEnd + 1;
        }
        
        console.log(`\n   ✅ ${incomeType}: ${typeCount} records total`);
    }
    
    // Sort by timestamp
    allTransactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Calculate cumulative wallet balance
    let runningBalance = 0;
    for (const tx of allTransactions) {
        runningBalance += tx.amount;
        tx.walletBalance = runningBalance;
    }
    
    console.log(`   ✅ Total income records: ${allTransactions.length}`);
    
    return allTransactions;
}

function mapBinanceIncomeType(incomeType: string): UnifiedWalletTransaction['transactType'] {
    const mapping: Record<string, UnifiedWalletTransaction['transactType']> = {
        'REALIZED_PNL': 'RealisedPNL',
        'FUNDING_FEE': 'Funding',
        'COMMISSION': 'Commission',
        'TRANSFER': 'Transfer',
        'WELCOME_BONUS': 'Transfer',
        'INSURANCE_CLEAR': 'RealisedPNL',
        'REFERRAL_KICKBACK': 'AffiliatePayout',
        'COMMISSION_REBATE': 'Commission',
    };
    return mapping[incomeType] || 'Transfer';
}

// Get Binance Account Info
async function getBinanceAccountInfo(config: ExchangeConfig): Promise<UnifiedAccountSummary> {
    console.log('\n👤 Fetching Binance Account Info...');
    
    const { apiKey, apiSecret } = config;
    
    try {
        const account = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v2/account', {});
        
        const positions = account.positions?.filter((p: any) => parseFloat(p.positionAmt) !== 0) || [];
        
        const summary: UnifiedAccountSummary = {
            exportDate: new Date().toISOString(),
            exchange: 'binance',
            user: {
                id: 'binance_user',
                username: 'Binance Futures',
            },
            wallet: {
                walletBalance: parseFloat(account.totalWalletBalance || '0'),
                marginBalance: parseFloat(account.totalMarginBalance || '0'),
                availableMargin: parseFloat(account.availableBalance || '0'),
                unrealisedPnl: parseFloat(account.totalUnrealizedProfit || '0'),
                realisedPnl: 0,
                currency: 'USDT',
            },
            positions: positions.map((p: any) => ({
                symbol: p.symbol,
                displaySymbol: formatSymbol(p.symbol, 'binance'),
                currentQty: parseFloat(p.positionAmt),
                avgEntryPrice: parseFloat(p.entryPrice),
                unrealisedPnl: parseFloat(p.unrealizedProfit),
                liquidationPrice: parseFloat(p.liquidationPrice) || null,
            })),
        };
        
        console.log(`   ✅ Wallet Balance: ${summary.wallet.walletBalance.toFixed(2)} USDT`);
        console.log(`   ✅ Open Positions: ${positions.length}`);
        
        return summary;
    } catch (error: any) {
        console.error(`   ❌ Account info failed: ${error.message}`);
        throw error;
    }
}

// Main export function for Binance
export async function exportBinanceData(config: ExchangeConfig): Promise<ImportResult> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           Binance Futures Data Export');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Date Range: ${config.startDate} to ${config.endDate}`);
    console.log('═══════════════════════════════════════════════════════════');

    const startTime = Date.now();

    try {
        // Sync server time first
        await syncServerTime();
        
        const forceRefetch = config.forceRefetch || false;
        
        // Get account info first (always fetch - it's quick)
        const accountSummary = await getBinanceAccountInfo(config);
        
        // Export orders
        const ordersCount = await exportBinanceOrders(config, forceRefetch);
        
        // Export trades
        const executions = await exportBinanceTrades(config, forceRefetch);
        
        // Export income history
        const walletHistory = await exportBinanceIncome(config, forceRefetch);
        
        // Save files
        const baseDir = process.cwd();
        
        // Save executions
        const execPath = path.join(baseDir, 'binance_executions.csv');
        const execHeaders = 'execID,orderID,symbol,side,lastQty,lastPx,execType,ordType,ordStatus,execCost,execComm,timestamp,text\n';
        const execRows = executions.map(e => [
            e.execID,
            e.orderID,
            e.symbol,
            e.side,
            e.lastQty,
            e.lastPx,
            e.execType,
            e.ordType,
            e.ordStatus,
            e.execCost,
            e.execComm,
            e.timestamp,
            `"${(e.text || '').replace(/"/g, '""')}"`
        ].join(',')).join('\n');
        fs.writeFileSync(execPath, execHeaders + execRows);
        
        // Save wallet history
        const walletPath = path.join(baseDir, 'binance_wallet_history.csv');
        const walletHeaders = 'transactID,account,currency,transactType,amount,fee,transactStatus,address,tx,text,timestamp,walletBalance,marginBalance\n';
        const walletRows = walletHistory.map(w => [
            w.transactID,
            w.account,
            w.currency,
            w.transactType,
            w.amount,
            w.fee,
            w.transactStatus,
            w.address,
            w.tx,
            `"${(w.text || '').replace(/"/g, '""')}"`,
            w.timestamp,
            w.walletBalance,
            w.marginBalance || ''
        ].join(',')).join('\n');
        fs.writeFileSync(walletPath, walletHeaders + walletRows);
        
        // Save account summary
        const summaryPath = path.join(baseDir, 'binance_account_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(accountSummary, null, 2));
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Count existing data if we skipped fetching
        let finalExecutions = executions.length;
        let finalOrders = ordersCount;
        let finalWallet = walletHistory.length;
        
        // If we skipped, count lines from existing CSVs
        if (executions.length === 0 && csvExists('binance_executions.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_executions.csv'), 'utf-8');
            finalExecutions = content.split('\n').length - 2; // Subtract header and empty line
        }
        if (ordersCount === 0 && csvExists('binance_orders.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_orders.csv'), 'utf-8');
            finalOrders = content.split('\n').length - 2;
        }
        if (walletHistory.length === 0 && csvExists('binance_wallet_history.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_wallet_history.csv'), 'utf-8');
            finalWallet = content.split('\n').length - 2;
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('                    Export Complete!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   Orders:     ${finalOrders}${ordersCount === 0 ? ' (existing)' : ''}`);
        console.log(`   Executions: ${finalExecutions}${executions.length === 0 ? ' (existing)' : ''}`);
        console.log(`   Wallet:     ${finalWallet}${walletHistory.length === 0 ? ' (existing)' : ''}`);
        console.log(`   Duration:   ${duration}s`);
        console.log('═══════════════════════════════════════════════════════════');

        const skippedMsg = (!forceRefetch && (executions.length === 0 || walletHistory.length === 0)) 
            ? ' (some data used from existing CSV)' : '';

        return {
            success: true,
            message: `Binance data ready: ${finalOrders} orders, ${finalExecutions} trades, ${finalWallet} income records${skippedMsg}`,
            stats: {
                executions: finalExecutions,
                trades: finalExecutions,
                orders: finalOrders,
                walletHistory: finalWallet,
            }
        };
    } catch (error: any) {
        console.error('Export failed:', error.message);
        return {
            success: false,
            message: 'Export failed',
            error: error.message,
        };
    }
}

// Test connection
export async function testBinanceConnection(apiKey: string, apiSecret: string): Promise<{ success: boolean; message: string }> {
    try {
        // Sync server time first
        await syncServerTime();
        
        const account = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v2/account', {});
        return {
            success: true,
            message: `Connected! Wallet Balance: ${parseFloat(account.totalWalletBalance).toFixed(2)} USDT`
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message
        };
    }
}

// ============================================================================
// STREAMING VERSION - With real-time progress callbacks
// ============================================================================

type LogCallback = (message: string, type?: 'info' | 'success' | 'error' | 'warning' | 'progress', progress?: number) => Promise<void>;

// Calculate estimated time based on date range
function estimateTime(startDate: string, endDate: string, forceRefetch: boolean): { estimate: string; windows: number } {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
    const windows = Math.ceil(days / 7); // 7-day windows
    
    // Estimate: ~2 seconds per window for trades, ~1 for income, per symbol
    const symbols = 2; // BTCUSDT, ETHUSDT
    const baseTime = forceRefetch ? (windows * 3 * symbols) : 5; // seconds
    
    if (baseTime < 60) {
        return { estimate: `~${baseTime} seconds`, windows };
    } else {
        return { estimate: `~${Math.ceil(baseTime / 60)} minutes`, windows };
    }
}

export async function exportBinanceDataWithProgress(
    config: ExchangeConfig,
    log: LogCallback
): Promise<ImportResult> {
    const startTime = Date.now();
    const forceRefetch = config.forceRefetch || false;

    await log('═══════════════════════════════════════════════════════════', 'info');
    await log('           Binance Futures Data Export', 'info');
    await log('═══════════════════════════════════════════════════════════', 'info');
    await log(`Date Range: ${config.startDate} to ${config.endDate}`, 'info');
    
    const timeEstimate = estimateTime(config.startDate, config.endDate, forceRefetch);
    await log(`Estimated time: ${timeEstimate.estimate} (${timeEstimate.windows} time windows)`, 'info');
    
    if (forceRefetch) {
        await log('⚠️ Force refetch enabled - will re-download all data', 'warning');
    }
    await log('═══════════════════════════════════════════════════════════', 'info');

    try {
        // Sync server time first
        await log('⏱️ Syncing server time...', 'info');
        await syncServerTime();
        await log('✓ Server time synced', 'success');
        
        // Get account info first
        await log('', 'info');
        await log('👤 Fetching account info...', 'info');
        const accountSummary = await getBinanceAccountInfo(config);
        await log(`✓ Wallet Balance: ${accountSummary.wallet.walletBalance.toFixed(2)} USDT`, 'success');
        await log(`✓ Open Positions: ${accountSummary.positions.length}`, 'success');
        
        // Export orders
        await log('', 'info');
        await log('📋 Fetching orders (last 90 days only - API limit)...', 'info');
        const ordersCount = await exportBinanceOrdersWithProgress(config, forceRefetch, log);
        
        // Export trades
        await log('', 'info');
        await log('📊 Fetching trade history...', 'info');
        const executions = await exportBinanceTradesWithProgress(config, forceRefetch, log, timeEstimate.windows);
        
        // Export income history
        await log('', 'info');
        await log('💰 Fetching income history (funding & PnL)...', 'info');
        const walletHistory = await exportBinanceIncomeWithProgress(config, forceRefetch, log, timeEstimate.windows);
        
        // Save files
        await log('', 'info');
        await log('💾 Saving data files...', 'info');
        
        const baseDir = process.cwd();
        
        // Save executions
        if (executions.length > 0) {
            const execPath = path.join(baseDir, 'binance_executions.csv');
            const execHeaders = 'execID,orderID,symbol,side,lastQty,lastPx,execType,ordType,ordStatus,execCost,execComm,timestamp,text\n';
            const execRows = executions.map(e => [
                e.execID, e.orderID, e.symbol, e.side, e.lastQty, e.lastPx,
                e.execType, e.ordType, e.ordStatus, e.execCost, e.execComm, e.timestamp,
                `"${(e.text || '').replace(/"/g, '""')}"`
            ].join(',')).join('\n');
            fs.writeFileSync(execPath, execHeaders + execRows);
            await log(`✓ Saved executions: ${executions.length} records`, 'success');
        }
        
        // Save wallet history
        if (walletHistory.length > 0) {
            const walletPath = path.join(baseDir, 'binance_wallet_history.csv');
            const walletHeaders = 'transactID,account,currency,transactType,amount,fee,transactStatus,address,tx,text,timestamp,walletBalance,marginBalance\n';
            const walletRows = walletHistory.map(w => [
                w.transactID, w.account, w.currency, w.transactType, w.amount, w.fee,
                w.transactStatus, w.address, w.tx, `"${(w.text || '').replace(/"/g, '""')}"`,
                w.timestamp, w.walletBalance, w.marginBalance || ''
            ].join(',')).join('\n');
            fs.writeFileSync(walletPath, walletHeaders + walletRows);
            await log(`✓ Saved wallet history: ${walletHistory.length} records`, 'success');
        }
        
        // Save account summary
        const summaryPath = path.join(baseDir, 'binance_account_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(accountSummary, null, 2));
        await log('✓ Saved account summary', 'success');
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Count data
        let finalExecutions = executions.length;
        let finalOrders = ordersCount;
        let finalWallet = walletHistory.length;
        
        if (executions.length === 0 && csvExists('binance_executions.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_executions.csv'), 'utf-8');
            finalExecutions = content.split('\n').length - 2;
        }
        if (ordersCount === 0 && csvExists('binance_orders.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_orders.csv'), 'utf-8');
            finalOrders = content.split('\n').length - 2;
        }
        if (walletHistory.length === 0 && csvExists('binance_wallet_history.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'binance_wallet_history.csv'), 'utf-8');
            finalWallet = content.split('\n').length - 2;
        }

        await log('', 'info');
        await log('═══════════════════════════════════════════════════════════', 'success');
        await log('                    ✅ Export Complete!', 'success');
        await log('═══════════════════════════════════════════════════════════', 'success');
        await log(`   Orders:     ${finalOrders}`, 'success');
        await log(`   Executions: ${finalExecutions}`, 'success');
        await log(`   Wallet:     ${finalWallet}`, 'success');
        await log(`   Duration:   ${duration}s`, 'success');
        await log('═══════════════════════════════════════════════════════════', 'success');

        return {
            success: true,
            message: `Binance data ready: ${finalOrders} orders, ${finalExecutions} trades, ${finalWallet} income records`,
            stats: {
                executions: finalExecutions,
                trades: finalExecutions,
                orders: finalOrders,
                walletHistory: finalWallet,
            }
        };
    } catch (error: any) {
        await log(`❌ Export failed: ${error.message}`, 'error');
        return {
            success: false,
            message: 'Export failed',
            error: error.message,
        };
    }
}

// Orders with progress
async function exportBinanceOrdersWithProgress(
    config: ExchangeConfig,
    forceRefetch: boolean,
    log: LogCallback
): Promise<number> {
    const csvFile = 'binance_orders.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        const content = fs.readFileSync(path.join(process.cwd(), csvFile), 'utf-8');
        const count = content.split('\n').length - 2;
        await log(`📋 Using existing orders CSV (${count} orders)`, 'info');
        return 0;
    }
    
    const { apiKey, apiSecret } = config;
    const allOrders: any[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    for (const symbol of symbols) {
        await sleep(REQUEST_DELAY);
        
        try {
            const params: BinanceRequestParams = { symbol, limit: 1000 };
            const orders = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/allOrders', params);
            
            if (orders && orders.length > 0) {
                allOrders.push(...orders);
                await log(`   ${symbol}: ${orders.length} orders`, 'info');
            } else {
                await log(`   ${symbol}: 0 orders`, 'info');
            }
        } catch (error: any) {
            await log(`   ⚠️ ${symbol}: ${error.message}`, 'warning');
        }
    }
    
    if (allOrders.length > 0) {
        const ordersPath = path.join(process.cwd(), csvFile);
        const ordersHeaders = 'orderID,symbol,side,ordType,orderQty,price,stopPx,avgPx,cumQty,ordStatus,timestamp,text\n';
        const ordersRows = allOrders.map(o => [
            o.orderId, o.symbol, o.side, o.type, o.origQty, o.price || '',
            o.stopPrice || '', o.avgPrice || '', o.executedQty || 0, o.status,
            new Date(o.time).toISOString(), `"${(o.clientOrderId || '').replace(/"/g, '""')}"`
        ].join(',')).join('\n');
        fs.writeFileSync(ordersPath, ordersHeaders + ordersRows);
    }
    
    await log(`✓ Total orders: ${allOrders.length}`, 'success');
    return allOrders.length;
}

// Trades with progress
async function exportBinanceTradesWithProgress(
    config: ExchangeConfig,
    forceRefetch: boolean,
    log: LogCallback,
    totalWindows: number
): Promise<UnifiedExecution[]> {
    const csvFile = 'binance_executions.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        const content = fs.readFileSync(path.join(process.cwd(), csvFile), 'utf-8');
        const count = content.split('\n').length - 2;
        await log(`📊 Using existing trades CSV (${count} trades)`, 'info');
        return [];
    }
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const allExecutions: UnifiedExecution[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT'];
    
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    let windowsProcessed = 0;
    
    for (const symbol of symbols) {
        let symbolCount = 0;
        let currentStart = startTime;
        
        while (currentStart < endTime) {
            const currentEnd = Math.min(currentStart + SEVEN_DAYS_MS - 1, endTime);
            
            await sleep(REQUEST_DELAY);
            windowsProcessed++;
            
            const progress = Math.round((windowsProcessed / (totalWindows * symbols.length)) * 50); // 0-50%
            
            try {
                const params: BinanceRequestParams = {
                    symbol,
                    limit: 1000,
                    startTime: currentStart,
                    endTime: currentEnd,
                };
                
                const trades = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/userTrades', params);
                
                if (trades && trades.length > 0) {
                    const executions: UnifiedExecution[] = trades.map((t: any) => {
                        const side: 'Buy' | 'Sell' = t.side === 'BUY' ? 'Buy' : 'Sell';
                        const qty = parseFloat(t.qty);
                        const price = parseFloat(t.price);
                        const commission = parseFloat(t.commission);
                        const realizedPnl = parseFloat(t.realizedPnl || '0');
                        const positionSide = t.positionSide || 'BOTH';
                        
                        const execCost = qty * price;
                        const execComm = t.commissionAsset === 'USDT' ? commission : commission * price;
                        
                        return {
                            execID: t.id.toString(),
                            orderID: t.orderId.toString(),
                            symbol: t.symbol,
                            displaySymbol: formatSymbol(t.symbol, 'binance'),
                            side,
                            lastQty: qty,
                            lastPx: price,
                            execType: 'Trade' as const,
                            ordType: t.maker ? 'Limit' : 'Market',
                            ordStatus: 'Filled',
                            execCost: Math.round(execCost * SAT_TO_BTC),
                            execComm: Math.round(execComm * SAT_TO_BTC),
                            timestamp: new Date(t.time).toISOString(),
                            text: `realizedPnl:${realizedPnl}|positionSide:${positionSide}|buyer:${t.buyer}`,
                            exchange: 'binance' as const,
                        };
                    });
                    
                    allExecutions.push(...executions);
                    symbolCount += trades.length;
                }
                
                const dateStr = new Date(currentStart).toISOString().split('T')[0];
                await log(`   ${symbol}: ${symbolCount} trades (${dateStr})`, 'progress', progress);
                
            } catch (error: any) {
                if (error.message.includes('429') || error.message.includes('418')) {
                    await log('   ⚠️ Rate limited, waiting 60s...', 'warning');
                    await sleep(60000);
                    continue;
                } else {
                    await log(`   ⚠️ ${symbol}: ${error.message}`, 'warning');
                }
            }
            
            currentStart = currentEnd + 1;
        }
        
        await log(`✓ ${symbol}: ${symbolCount} trades total`, 'success');
    }
    
    return allExecutions;
}

// Income with progress
async function exportBinanceIncomeWithProgress(
    config: ExchangeConfig,
    forceRefetch: boolean,
    log: LogCallback,
    totalWindows: number
): Promise<UnifiedWalletTransaction[]> {
    const csvFile = 'binance_wallet_history.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        const content = fs.readFileSync(path.join(process.cwd(), csvFile), 'utf-8');
        const count = content.split('\n').length - 2;
        await log(`💰 Using existing wallet CSV (${count} records)`, 'info');
        return [];
    }
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const allTransactions: UnifiedWalletTransaction[] = [];
    
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    
    const incomeTypes = ['REALIZED_PNL', 'FUNDING_FEE'];
    let windowsProcessed = 0;
    
    for (const incomeType of incomeTypes) {
        let typeCount = 0;
        let currentStart = startTime;
        
        while (currentStart < endTime) {
            const currentEnd = Math.min(currentStart + SEVEN_DAYS_MS - 1, endTime);
            
            await sleep(REQUEST_DELAY * 2);
            windowsProcessed++;
            
            const progress = 50 + Math.round((windowsProcessed / (totalWindows * incomeTypes.length)) * 50); // 50-100%
            
            try {
                const params: BinanceRequestParams = {
                    incomeType,
                    startTime: currentStart,
                    endTime: currentEnd,
                    limit: 1000,
                };
                
                const income = await binanceRequest(apiKey, apiSecret, 'GET', '/fapi/v1/income', params);
                
                if (income && income.length > 0) {
                    const transactions: UnifiedWalletTransaction[] = income.map((i: any) => {
                        const amount = parseFloat(i.income);
                        const transactType = mapBinanceIncomeType(i.incomeType);
                        
                        return {
                            transactID: i.tranId?.toString() || `${i.time}-${i.incomeType}`,
                            account: i.symbol || 'USDT',
                            currency: i.asset || 'USDT',
                            transactType,
                            amount: Math.round(amount * SAT_TO_BTC),
                            fee: 0,
                            transactStatus: 'Completed',
                            address: '',
                            tx: '',
                            text: i.info || '',
                            timestamp: new Date(i.time).toISOString(),
                            walletBalance: 0,
                            marginBalance: null,
                            exchange: 'binance' as const,
                        };
                    });
                    
                    allTransactions.push(...transactions);
                    typeCount += income.length;
                }
                
                const dateStr = new Date(currentStart).toISOString().split('T')[0];
                await log(`   ${incomeType}: ${typeCount} (${dateStr})`, 'progress', progress);
                
            } catch (error: any) {
                if (error.message.includes('429') || error.message.includes('418')) {
                    await log('   ⚠️ Rate limited, waiting 60s...', 'warning');
                    await sleep(60000);
                    continue;
                } else {
                    await log(`   ⚠️ ${incomeType}: ${error.message}`, 'warning');
                }
            }
            
            currentStart = currentEnd + 1;
        }
        
        await log(`✓ ${incomeType}: ${typeCount} records total`, 'success');
    }
    
    // Sort and calculate running balance
    allTransactions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let runningBalance = 0;
    for (const tx of allTransactions) {
        runningBalance += tx.amount;
        tx.walletBalance = runningBalance;
    }
    
    return allTransactions;
}

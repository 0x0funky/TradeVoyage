/**
 * BitMEX Data Exporter
 * 
 * Exports:
 * 1. Trade History (Executions) - 成交記錄
 * 2. Order History - 訂單歷史
 * 3. Wallet History - 錢包歷史（資金費率 Funding、存取款）
 * 4. Account Summary - 帳戶摘要
 */

import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { 
    ExchangeConfig, 
    formatSymbol,
    UnifiedAccountSummary,
    ImportResult 
} from './exchange_types';

// Check if CSV file exists and has data
function csvExists(filename: string): boolean {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    return stats.size > 100; // More than just headers
}

// Helper function to make signed BitMEX API requests
async function bitmexRequest(
    apiKey: string,
    apiSecret: string,
    method: string,
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    return new Promise((resolve, reject) => {
        const expires = Math.floor(Date.now() / 1000) + 60;
        
        let query = '';
        let body = '';
        
        if (method === 'GET' && Object.keys(params).length > 0) {
            query = '?' + new URLSearchParams(params).toString();
        } else if (method === 'POST') {
            body = JSON.stringify(params);
        }
        
        const requestPath = `/api/v1${endpoint}${query}`;
        const message = method + requestPath + expires + body;
        const signature = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
        
        const options = {
            hostname: 'www.bitmex.com',
            port: 443,
            path: requestPath,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'api-expires': expires,
                'api-key': apiKey,
                'api-signature': signature
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

// Export Executions
async function exportExecutions(config: ExchangeConfig, forceRefetch: boolean = false): Promise<number> {
    const csvFile = 'bitmex_executions.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n⚡ BitMEX Executions: Using existing CSV (skip fetch)');
        return 0;
    }
    
    console.log('\n⚡ Exporting Execution History...');
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const csvPath = path.join(process.cwd(), csvFile);
    const headers = 'execID,orderID,symbol,side,lastQty,lastPx,execType,ordType,ordStatus,execCost,execComm,timestamp,text\n';
    fs.writeFileSync(csvPath, headers);

    let start = 0;
    const count = 500;
    let totalCount = 0;

    try {
        while (true) {
            await new Promise(r => setTimeout(r, 1000));

            const executions = await bitmexRequest(apiKey, apiSecret, 'GET', '/execution/tradeHistory', {
                count: count,
                start: start,
                reverse: false,
                startTime: new Date(startDate).toISOString(),
                endTime: new Date(endDate).toISOString()
            });

            if (!executions || executions.length === 0) break;

            const csvRows = executions.map((e: any) => {
                return [
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
                ].join(',');
            }).join('\n');

            fs.appendFileSync(csvPath, csvRows + '\n');
            totalCount += executions.length;

            process.stdout.write(`\r   Fetched ${totalCount} executions...`);

            if (executions.length < count) break;
            start += count;
        }

        console.log(`\n   ✅ Executions exported: ${totalCount}`);
        return totalCount;
    } catch (error: any) {
        console.error("\n   ❌ Execution export failed:", error.message);
        return 0;
    }
}

// Export Orders
async function exportOrders(config: ExchangeConfig, forceRefetch: boolean = false): Promise<number> {
    const csvFile = 'bitmex_orders.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n📋 BitMEX Orders: Using existing CSV (skip fetch)');
        return 0;
    }
    
    console.log('\n📋 Exporting Order History...');
    
    const { apiKey, apiSecret, startDate, endDate } = config;
    const csvPath = path.join(process.cwd(), csvFile);
    const headers = 'orderID,symbol,side,ordType,orderQty,price,stopPx,avgPx,cumQty,ordStatus,timestamp,text\n';
    fs.writeFileSync(csvPath, headers);

    let start = 0;
    const count = 500;
    let totalCount = 0;

    try {
        while (true) {
            await new Promise(r => setTimeout(r, 1000));

            const orders = await bitmexRequest(apiKey, apiSecret, 'GET', '/order', {
                count: count,
                start: start,
                reverse: false,
                startTime: new Date(startDate).toISOString(),
                endTime: new Date(endDate).toISOString()
            });

            if (!orders || orders.length === 0) break;

            const csvRows = orders.map((o: any) => {
                return [
                    o.orderID,
                    o.symbol,
                    o.side,
                    o.ordType,
                    o.orderQty,
                    o.price || '',
                    o.stopPx || '',
                    o.avgPx || '',
                    o.cumQty || 0,
                    o.ordStatus,
                    o.timestamp,
                    `"${(o.text || '').replace(/"/g, '""')}"`
                ].join(',');
            }).join('\n');

            fs.appendFileSync(csvPath, csvRows + '\n');
            totalCount += orders.length;

            process.stdout.write(`\r   Fetched ${totalCount} orders...`);

            if (orders.length < count) break;
            start += count;
        }

        console.log(`\n   ✅ Orders exported: ${totalCount}`);
        return totalCount;
    } catch (error: any) {
        console.error("\n   ❌ Order export failed:", error.message);
        return 0;
    }
}

// Export Wallet History
async function exportWalletHistory(config: ExchangeConfig, forceRefetch: boolean = false): Promise<number> {
    const csvFile = 'bitmex_wallet_history.csv';
    
    if (!forceRefetch && csvExists(csvFile)) {
        console.log('\n💰 BitMEX Wallet: Using existing CSV (skip fetch)');
        return 0;
    }
    
    console.log('\n💰 Exporting Wallet History...');
    
    const { apiKey, apiSecret } = config;
    const csvPath = path.join(process.cwd(), csvFile);
    const headers = 'transactID,account,currency,transactType,amount,fee,transactStatus,address,tx,text,timestamp,walletBalance,marginBalance\n';
    fs.writeFileSync(csvPath, headers);

    let start = 0;
    const count = 500;
    let totalCount = 0;

    try {
        while (true) {
            await new Promise(r => setTimeout(r, 1000));

            const transactions = await bitmexRequest(apiKey, apiSecret, 'GET', '/user/walletHistory', {
                count: count,
                start: start,
                currency: 'XBt'
            });

            if (!transactions || transactions.length === 0) break;

            const csvRows = transactions.map((t: any) => {
                return [
                    t.transactID,
                    t.account,
                    t.currency,
                    t.transactType,
                    t.amount,
                    t.fee || 0,
                    t.transactStatus,
                    t.address || '',
                    t.tx || '',
                    `"${(t.text || '').replace(/"/g, '""')}"`,
                    t.timestamp,
                    t.walletBalance,
                    t.marginBalance || ''
                ].join(',');
            }).join('\n');

            fs.appendFileSync(csvPath, csvRows + '\n');
            totalCount += transactions.length;

            process.stdout.write(`\r   Fetched ${totalCount} transactions...`);

            if (transactions.length < count) break;
            start += count;
        }

        console.log(`\n   ✅ Wallet history exported: ${totalCount}`);
        return totalCount;
    } catch (error: any) {
        console.error("\n   ❌ Wallet history export failed:", error.message);
        return 0;
    }
}

// Get Account Summary
async function getAccountSummary(config: ExchangeConfig): Promise<UnifiedAccountSummary | null> {
    console.log('\n👤 Fetching Account Summary...');
    
    const { apiKey, apiSecret } = config;
    
    try {
        const user = await bitmexRequest(apiKey, apiSecret, 'GET', '/user', {});
        const wallet = await bitmexRequest(apiKey, apiSecret, 'GET', '/user/wallet', {});
        const margin = await bitmexRequest(apiKey, apiSecret, 'GET', '/user/margin', {});
        const positions = await bitmexRequest(apiKey, apiSecret, 'GET', '/position', {});
        
        const openPositions = positions.filter((p: any) => p.isOpen);
        
        const summary: UnifiedAccountSummary = {
            exportDate: new Date().toISOString(),
            exchange: 'bitmex',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            wallet: {
                walletBalance: wallet.walletBalance / 100000000,
                marginBalance: margin.marginBalance / 100000000,
                availableMargin: margin.availableMargin / 100000000,
                unrealisedPnl: margin.unrealisedPnl / 100000000,
                realisedPnl: margin.realisedPnl / 100000000,
                currency: 'XBT',
            },
            positions: openPositions.map((p: any) => ({
                symbol: p.symbol,
                displaySymbol: formatSymbol(p.symbol, 'bitmex'),
                currentQty: p.currentQty,
                avgEntryPrice: p.avgEntryPrice,
                unrealisedPnl: p.unrealisedPnl / 100000000,
                liquidationPrice: p.liquidationPrice
            }))
        };
        
        // Save to JSON
        const summaryPath = path.join(process.cwd(), 'bitmex_account_summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log(`   ✅ Account: ${summary.user.username}`);
        console.log(`   ✅ Wallet Balance: ${summary.wallet.walletBalance?.toFixed(8)} BTC`);
        
        return summary;
    } catch (error: any) {
        console.error("   ❌ Account summary failed:", error.message);
        return null;
    }
}

// Main export function for BitMEX
export async function exportBitmexData(config: ExchangeConfig): Promise<ImportResult> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           BitMEX Complete Data Export');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Date Range: ${config.startDate} to ${config.endDate}`);
    console.log('═══════════════════════════════════════════════════════════');

    const startTime = Date.now();
    const forceRefetch = config.forceRefetch || false;

    try {
        await getAccountSummary(config);
        const executions = await exportExecutions(config, forceRefetch);
        const orders = await exportOrders(config, forceRefetch);
        const wallet = await exportWalletHistory(config, forceRefetch);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Count existing data if we skipped fetching
        let finalExecutions = executions;
        let finalOrders = orders;
        let finalWallet = wallet;
        
        if (executions === 0 && csvExists('bitmex_executions.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_executions.csv'), 'utf-8');
            finalExecutions = content.split('\n').length - 2;
        }
        if (orders === 0 && csvExists('bitmex_orders.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_orders.csv'), 'utf-8');
            finalOrders = content.split('\n').length - 2;
        }
        if (wallet === 0 && csvExists('bitmex_wallet_history.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_wallet_history.csv'), 'utf-8');
            finalWallet = content.split('\n').length - 2;
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('                    Export Complete!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   Executions: ${finalExecutions}${executions === 0 ? ' (existing)' : ''}`);
        console.log(`   Orders:     ${finalOrders}${orders === 0 ? ' (existing)' : ''}`);
        console.log(`   Wallet:     ${finalWallet}${wallet === 0 ? ' (existing)' : ''}`);
        console.log(`   Duration:   ${duration}s`);
        console.log('═══════════════════════════════════════════════════════════');

        const skippedMsg = (!forceRefetch && (executions === 0 || orders === 0 || wallet === 0)) 
            ? ' (some data used from existing CSV)' : '';

        return {
            success: true,
            message: `BitMEX data ready: ${finalExecutions} executions, ${finalOrders} orders, ${finalWallet} wallet txs${skippedMsg}`,
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
export async function testBitmexConnection(apiKey: string, apiSecret: string): Promise<{ success: boolean; message: string }> {
    try {
        const user = await bitmexRequest(apiKey, apiSecret, 'GET', '/user', {});
        return {
            success: true,
            message: `Connected as: ${user.username}`
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

export async function exportBitmexDataWithProgress(
    config: ExchangeConfig,
    log: LogCallback
): Promise<ImportResult> {
    const startTime = Date.now();
    const forceRefetch = config.forceRefetch || false;

    await log('═══════════════════════════════════════════════════════════', 'info');
    await log('           BitMEX Complete Data Export', 'info');
    await log('═══════════════════════════════════════════════════════════', 'info');
    await log(`Date Range: ${config.startDate} to ${config.endDate}`, 'info');
    
    if (forceRefetch) {
        await log('⚠️ Force refetch enabled - will re-download all data', 'warning');
    }
    await log('═══════════════════════════════════════════════════════════', 'info');

    try {
        // Get account info
        await log('', 'info');
        await log('👤 Fetching account info...', 'info');
        await getAccountSummary(config);
        await log('✓ Account info fetched', 'success');
        
        // Export executions
        await log('', 'info');
        await log('📊 Fetching executions...', 'info', 10);
        const executions = await exportExecutions(config, forceRefetch);
        if (executions > 0) {
            await log(`✓ Fetched ${executions} executions`, 'success', 40);
        } else {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_executions.csv'), 'utf-8');
            const count = content.split('\n').length - 2;
            await log(`📊 Using existing executions CSV (${count} records)`, 'info', 40);
        }
        
        // Export orders
        await log('', 'info');
        await log('📋 Fetching orders...', 'info', 50);
        const orders = await exportOrders(config, forceRefetch);
        if (orders > 0) {
            await log(`✓ Fetched ${orders} orders`, 'success', 70);
        } else {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_orders.csv'), 'utf-8');
            const count = content.split('\n').length - 2;
            await log(`📋 Using existing orders CSV (${count} records)`, 'info', 70);
        }
        
        // Export wallet
        await log('', 'info');
        await log('💰 Fetching wallet history...', 'info', 80);
        const wallet = await exportWalletHistory(config, forceRefetch);
        if (wallet > 0) {
            await log(`✓ Fetched ${wallet} wallet transactions`, 'success', 100);
        } else {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_wallet_history.csv'), 'utf-8');
            const count = content.split('\n').length - 2;
            await log(`💰 Using existing wallet CSV (${count} records)`, 'info', 100);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Count data
        let finalExecutions = executions;
        let finalOrders = orders;
        let finalWallet = wallet;
        
        if (executions === 0 && csvExists('bitmex_executions.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_executions.csv'), 'utf-8');
            finalExecutions = content.split('\n').length - 2;
        }
        if (orders === 0 && csvExists('bitmex_orders.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_orders.csv'), 'utf-8');
            finalOrders = content.split('\n').length - 2;
        }
        if (wallet === 0 && csvExists('bitmex_wallet_history.csv')) {
            const content = fs.readFileSync(path.join(process.cwd(), 'bitmex_wallet_history.csv'), 'utf-8');
            finalWallet = content.split('\n').length - 2;
        }

        await log('', 'info');
        await log('═══════════════════════════════════════════════════════════', 'success');
        await log('                    ✅ Export Complete!', 'success');
        await log('═══════════════════════════════════════════════════════════', 'success');
        await log(`   Executions: ${finalExecutions}`, 'success');
        await log(`   Orders:     ${finalOrders}`, 'success');
        await log(`   Wallet:     ${finalWallet}`, 'success');
        await log(`   Duration:   ${duration}s`, 'success');
        await log('═══════════════════════════════════════════════════════════', 'success');

        return {
            success: true,
            message: `BitMEX data ready: ${finalExecutions} executions, ${finalOrders} orders, ${finalWallet} wallet txs`,
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


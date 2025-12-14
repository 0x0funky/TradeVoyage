'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
    ArrowLeft, 
    Key, 
    Database, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Calendar,
    Shield,
    Download,
    AlertTriangle,
    ExternalLink,
    RefreshCw,
    Terminal,
    FileCheck
} from 'lucide-react';
import { ExchangeType, EXCHANGE_DISPLAY_NAMES } from '@/lib/exchange_types';

interface ImportState {
    status: 'idle' | 'testing' | 'importing' | 'success' | 'error';
    message: string;
    stats?: {
        executions: number;
        trades: number;
        orders: number;
        walletHistory: number;
    };
}

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
}

export default function SettingsPage() {
    const [exchange, setExchange] = useState<ExchangeType>('bitmex');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [importState, setImportState] = useState<ImportState>({ status: 'idle', message: '' });
    const [connectionTested, setConnectionTested] = useState(false);
    const [forceRefetch, setForceRefetch] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [progress, setProgress] = useState(0);
    const [currentOperation, setCurrentOperation] = useState<string>(''); // For in-place updates
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs (only when new logs are added, not for progress updates)
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Add log - for permanent messages
    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, message, type }]);
        // Clear current operation when adding a permanent log
        if (type !== 'warning') {
            setCurrentOperation('');
        }
    };

    // Update current operation - for in-place progress updates (like terminal \r)
    const updateProgress = (message: string) => {
        setCurrentOperation(message);
    };

    const clearLogs = () => {
        setLogs([]);
        setCurrentOperation('');
    };

    const testConnection = async () => {
        if (!apiKey || !apiSecret) {
            setImportState({ status: 'error', message: 'Please enter API Key and Secret' });
            return;
        }

        setImportState({ status: 'testing', message: 'Testing connection...' });
        setConnectionTested(false);
        clearLogs();
        addLog(`Testing connection to ${EXCHANGE_DISPLAY_NAMES[exchange]}...`, 'info');

        try {
            const params = new URLSearchParams({
                exchange,
                apiKey,
                apiSecret,
            });
            
            const res = await fetch(`/api/import?${params}`);
            const data = await res.json();

            if (data.success) {
                setImportState({ status: 'success', message: data.message });
                setConnectionTested(true);
                addLog(`✓ ${data.message}`, 'success');
            } else {
                setImportState({ status: 'error', message: data.message });
                addLog(`✗ ${data.message}`, 'error');
            }
        } catch (error: any) {
            setImportState({ status: 'error', message: error.message });
            addLog(`✗ Error: ${error.message}`, 'error');
        }
    };

    const startImport = async () => {
        if (!connectionTested) {
            setImportState({ status: 'error', message: 'Please test connection first' });
            return;
        }

        setImportState({ status: 'importing', message: 'Starting import...' });
        setProgress(0);
        clearLogs();

        try {
            // Use streaming endpoint for real-time progress
            const res = await fetch('/api/import/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchange,
                    apiKey,
                    apiSecret,
                    startDate,
                    endDate,
                    forceRefetch,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Import failed');
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('Stream not available');
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                // Process complete SSE messages
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep incomplete message in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            // Check if it's the final result
                            if (data.message && data.message.startsWith('{')) {
                                try {
                                    const finalData = JSON.parse(data.message);
                                    if (finalData.done && finalData.result) {
                                        const result = finalData.result;
                                        setProgress(100);
                                        if (result.success) {
                                            setImportState({ 
                                                status: 'success', 
                                                message: result.message,
                                                stats: result.stats,
                                            });
                                        } else {
                                            setImportState({ 
                                                status: 'error', 
                                                message: result.message || result.error 
                                            });
                                        }
                                        continue;
                                    }
                                } catch {
                                    // Not JSON, treat as regular message
                                }
                            }
                            
                            // Handle different message types
                            if (data.message) {
                                if (data.type === 'progress') {
                                    // Progress messages update in place (like terminal \r)
                                    updateProgress(data.message);
                                } else {
                                    // Other messages are added as permanent logs
                                    addLog(data.message, data.type || 'info');
                                }
                            }
                            
                            // Update progress bar
                            if (data.progress !== undefined) {
                                setProgress(data.progress);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE message:', line);
                        }
                    }
                }
            }
        } catch (error: any) {
            setImportState({ status: 'error', message: error.message });
            addLog(`✗ Error: ${error.message}`, 'error');
        }
    };

    const getStatusIcon = () => {
        switch (importState.status) {
            case 'testing':
            case 'importing':
                return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />;
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return null;
        }
    };

    const getStatusClass = () => {
        switch (importState.status) {
            case 'success':
                return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
            case 'error':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            case 'testing':
            case 'importing':
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
            default:
                return 'bg-zinc-800/50 border-zinc-700 text-zinc-400';
        }
    };

    const getLogColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'success': return 'text-emerald-400';
            case 'error': return 'text-red-400';
            case 'warning': return 'text-amber-400';
            default: return 'text-zinc-300';
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <header className="flex items-center gap-4 pb-6 border-b border-zinc-800">
                    <Link 
                        href="/"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-300" />
                    </Link>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                            Data Import
                        </h1>
                        <p className="text-zinc-400 mt-1">
                            Connect your exchange API to import trading data
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Settings */}
                    <div className="space-y-6">
                        {/* Warning */}
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-amber-300">Security Notice</p>
                                <p className="text-amber-200/80 mt-1">
                                    Use <strong>Read-Only</strong> API keys. Keys are never stored.
                                </p>
                            </div>
                        </div>

                        {/* Exchange Selection */}
                        <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                            <div className="flex items-center gap-3 mb-4">
                                <Database className="w-5 h-5 text-blue-400" />
                                <h2 className="text-lg font-semibold text-white">Exchange</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {(['bitmex', 'binance'] as ExchangeType[]).map((ex) => (
                                    <button
                                        key={ex}
                                        onClick={() => {
                                            setExchange(ex);
                                            setConnectionTested(false);
                                            setImportState({ status: 'idle', message: '' });
                                        }}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            exchange === ex
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-white">{EXCHANGE_DISPLAY_NAMES[ex]}</span>
                                            {exchange === ex && (
                                                <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-1 text-left">
                                            {ex === 'bitmex' ? 'BTC/ETH Perpetuals' : 'USDT-M Futures'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* API Credentials */}
                        <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Key className="w-5 h-5 text-blue-400" />
                                    <h2 className="text-lg font-semibold text-white">API Credentials</h2>
                                </div>
                                <a
                                    href={exchange === 'bitmex' 
                                        ? 'https://www.bitmex.com/app/apiKeys'
                                        : 'https://www.binance.com/en/my/settings/api-management'
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Get API Key <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        API Key
                                    </label>
                                    <input
                                        type="text"
                                        value={apiKey}
                                        onChange={(e) => {
                                            setApiKey(e.target.value);
                                            setConnectionTested(false);
                                        }}
                                        placeholder="Enter your API Key"
                                        className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 
                                                 text-white placeholder-zinc-500
                                                 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                                                 outline-none transition-all font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        API Secret
                                    </label>
                                    <input
                                        type="password"
                                        value={apiSecret}
                                        onChange={(e) => {
                                            setApiSecret(e.target.value);
                                            setConnectionTested(false);
                                        }}
                                        placeholder="Enter your API Secret"
                                        className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 
                                                 text-white placeholder-zinc-500
                                                 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                                                 outline-none transition-all font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={importState.status === 'testing' || importState.status === 'importing'}
                                className="w-full mt-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 
                                         border border-zinc-700 text-white font-medium transition-all
                                         disabled:opacity-50 disabled:cursor-not-allowed
                                         flex items-center justify-center gap-2"
                            >
                                {importState.status === 'testing' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Testing Connection...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-4 h-4" />
                                        Test Connection
                                    </>
                                )}
                            </button>
                        </section>

                        {/* Date Range & Options */}
                        <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                            <div className="flex items-center gap-3 mb-4">
                                <Calendar className="w-5 h-5 text-blue-400" />
                                <h2 className="text-lg font-semibold text-white">Date Range</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 
                                                 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                                                 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 
                                                 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 
                                                 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Force Refetch Option */}
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={forceRefetch}
                                    onChange={(e) => setForceRefetch(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 
                                             focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-zinc-400" />
                                        <span className="font-medium text-white">Force Refetch</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Re-download all data even if CSV files exist
                                    </p>
                                </div>
                            </label>
                        </section>

                        {/* Import Button */}
                        <button
                            onClick={startImport}
                            disabled={!connectionTested || importState.status === 'importing'}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 
                                     hover:from-blue-500 hover:to-blue-400
                                     font-semibold text-white transition-all shadow-lg shadow-blue-500/20
                                     disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                                     flex items-center justify-center gap-2"
                        >
                            {importState.status === 'importing' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Importing Data... {progress > 0 && `(${progress}%)`}
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Start Import
                                </>
                            )}
                        </button>

                        {/* Progress Bar */}
                        {importState.status === 'importing' && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-zinc-400">
                                    <span>Progress</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="text-xs text-zinc-500 text-center">
                                    {progress < 50 ? 'Fetching trades...' : 
                                     progress < 100 ? 'Fetching income history...' : 
                                     'Saving files...'}
                                </div>
                            </div>
                        )}

                        {/* Success Actions */}
                        {importState.status === 'success' && importState.stats && (
                            <div className="flex gap-4">
                                <Link
                                    href="/"
                                    className="flex-1 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 
                                             text-emerald-400 font-medium text-center hover:bg-emerald-500/30 transition-all"
                                >
                                    View Dashboard
                                </Link>
                                <button
                                    onClick={() => {
                                        setImportState({ status: 'idle', message: '' });
                                        clearLogs();
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-zinc-800 border border-zinc-700 
                                             text-white font-medium text-center hover:bg-zinc-700 transition-all"
                                >
                                    Import More Data
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Logs & Status */}
                    <div className="space-y-6">
                        {/* Status */}
                        {importState.status !== 'idle' && (
                            <div className={`rounded-xl p-4 border ${getStatusClass()} transition-all`}>
                                <div className="flex items-center gap-3">
                                    {getStatusIcon()}
                                    <span className="font-medium">{importState.message}</span>
                                </div>
                                {importState.stats && (
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-emerald-400">
                                                {importState.stats.executions.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-zinc-400">Executions</div>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-blue-400">
                                                {importState.stats.orders.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-zinc-400">Orders</div>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-purple-400">
                                                {importState.stats.walletHistory.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-zinc-400">Wallet Txs</div>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-amber-400">
                                                {importState.stats.trades.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-zinc-400">Trades</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Console Logs */}
                        <section className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-zinc-400" />
                                    <h3 className="font-semibold text-white">Import Log</h3>
                                </div>
                                {logs.length > 0 && (
                                    <button
                                        onClick={clearLogs}
                                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="h-80 overflow-y-auto p-4 font-mono text-sm bg-black/30">
                                {logs.length === 0 ? (
                                    <p className="text-zinc-600 italic">
                                        Import logs will appear here...
                                    </p>
                                ) : (
                                    <>
                                        {logs.map((log, idx) => (
                                            <div key={idx} className={`${getLogColor(log.type)} mb-1`}>
                                                <span className="text-zinc-600">[{log.time}]</span>{' '}
                                                {log.message}
                                            </div>
                                        ))}
                                        {/* Current operation - updates in place like terminal */}
                                        {currentOperation && (
                                            <div className="text-blue-400 mb-1 animate-pulse">
                                                <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>{' '}
                                                {currentOperation}
                                            </div>
                                        )}
                                    </>
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </section>

                        {/* Existing Files Status */}
                        <section className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                            <div className="flex items-center gap-3 mb-4">
                                <FileCheck className="w-5 h-5 text-blue-400" />
                                <h2 className="text-lg font-semibold text-white">Data Files</h2>
                            </div>
                            <p className="text-sm text-zinc-400 mb-3">
                                {exchange === 'binance' ? 'Binance' : 'BitMEX'} data files in project:
                            </p>
                            <div className="space-y-2 text-sm font-mono">
                                {['executions', 'orders', 'wallet_history', 'account_summary'].map(file => (
                                    <div key={file} className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-lg">
                                        <span className="text-zinc-300">
                                            {exchange}_{file}.{file === 'account_summary' ? 'json' : 'csv'}
                                        </span>
                                        <span className="text-zinc-500">—</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer Info */}
                <footer className="text-center text-sm text-zinc-500 pb-8 pt-4">
                    <p>Data is saved locally. Your API credentials are never stored.</p>
                </footer>
            </div>
        </div>
    );
}

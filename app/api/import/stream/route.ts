import { NextRequest } from 'next/server';
import { ExchangeConfig } from '@/lib/exchange_types';
import { exportBinanceDataWithProgress } from '@/lib/binance_exporter';
import { exportBitmexDataWithProgress } from '@/lib/bitmex_exporter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streaming import with real-time progress
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { exchange, apiKey, apiSecret, startDate, endDate, forceRefetch } = body;

    if (!exchange || !apiKey || !apiSecret || !startDate || !endDate) {
        return new Response(
            JSON.stringify({ error: 'Missing required parameters' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const config: ExchangeConfig = {
        exchange,
        apiKey,
        apiSecret,
        startDate,
        endDate,
        forceRefetch: forceRefetch === true,
    };

    // Create a TransformStream for streaming responses
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Log callback function
    const sendLog = async (message: string, type: 'info' | 'success' | 'error' | 'warning' | 'progress' = 'info', progress?: number) => {
        const data = JSON.stringify({ message, type, progress, timestamp: Date.now() });
        await writer.write(encoder.encode(`data: ${data}\n\n`));
    };

    // Start the export in background
    (async () => {
        try {
            let result;
            
            if (exchange === 'binance') {
                result = await exportBinanceDataWithProgress(config, sendLog);
            } else if (exchange === 'bitmex') {
                result = await exportBitmexDataWithProgress(config, sendLog);
            } else {
                await sendLog(`Unsupported exchange: ${exchange}`, 'error');
                await writer.close();
                return;
            }

            // Send final result
            await sendLog(JSON.stringify({ done: true, result }), 'success');
            await writer.close();
        } catch (error: any) {
            await sendLog(`Export failed: ${error.message}`, 'error');
            await writer.close();
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}


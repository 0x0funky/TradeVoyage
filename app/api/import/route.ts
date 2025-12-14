import { NextRequest, NextResponse } from 'next/server';
import { ExchangeConfig, ExchangeType, ImportResult } from '@/lib/exchange_types';
import { exportBitmexData, testBitmexConnection } from '@/lib/bitmex_exporter';
import { exportBinanceData, testBinanceConnection } from '@/lib/binance_exporter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test connection to exchange
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const exchange = searchParams.get('exchange') as ExchangeType;
    const apiKey = searchParams.get('apiKey');
    const apiSecret = searchParams.get('apiSecret');

    if (!exchange || !apiKey || !apiSecret) {
        return NextResponse.json(
            { success: false, message: 'Missing required parameters: exchange, apiKey, apiSecret' },
            { status: 400 }
        );
    }

    try {
        let result: { success: boolean; message: string };

        switch (exchange) {
            case 'bitmex':
                result = await testBitmexConnection(apiKey, apiSecret);
                break;
            case 'binance':
                result = await testBinanceConnection(apiKey, apiSecret);
                break;
            default:
                return NextResponse.json(
                    { success: false, message: `Unsupported exchange: ${exchange}` },
                    { status: 400 }
                );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}

// Import data from exchange
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { exchange, apiKey, apiSecret, startDate, endDate, forceRefetch } = body;

        if (!exchange || !apiKey || !apiSecret || !startDate || !endDate) {
            return NextResponse.json(
                { success: false, message: 'Missing required parameters' },
                { status: 400 }
            );
        }

        const config: ExchangeConfig = {
            exchange,
            apiKey,
            apiSecret,
            startDate,
            endDate,
            forceRefetch: forceRefetch === true, // Explicitly convert to boolean
        };
        
        console.log(`[Import] Exchange: ${exchange}, Force Refetch: ${config.forceRefetch}`);

        let result: ImportResult;

        switch (exchange) {
            case 'bitmex':
                result = await exportBitmexData(config);
                break;
            case 'binance':
                result = await exportBinanceData(config);
                break;
            default:
                return NextResponse.json(
                    { success: false, message: `Unsupported exchange: ${exchange}` },
                    { status: 400 }
                );
        }

        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json(result, { status: 500 });
        }
    } catch (error: any) {
        console.error('Import error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}



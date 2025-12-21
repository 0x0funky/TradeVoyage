import { NextResponse } from 'next/server';
import { hasExchangeData } from '@/lib/data_loader';
import { ExchangeType, EXCHANGES } from '@/lib/exchange_types';

export async function GET() {
    try {
        // Check which exchanges have data available
        const availableExchanges: ExchangeType[] = [];

        for (const exchange of EXCHANGES) {
            if (hasExchangeData(exchange)) {
                availableExchanges.push(exchange);
            }
        }

        return NextResponse.json({
            availableExchanges,
            hasData: availableExchanges.length > 0,
        });
    } catch (error) {
        console.error('Error checking available exchanges:', error);
        return NextResponse.json({
            availableExchanges: [],
            hasData: false,
            error: 'Failed to check available exchanges',
        }, { status: 500 });
    }
}

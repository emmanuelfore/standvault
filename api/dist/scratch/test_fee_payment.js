"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ledger_services_1 = require("../services/ledger.services");
const db_1 = require("../db");
async function test() {
    try {
        const feeId = 'c4707963-b016-4e87-9619-92ea6a96d54b';
        const fee = await db_1.prisma.ledger_entries.findUnique({ where: { id: feeId } });
        if (!fee) {
            console.log('Fee not found');
            return;
        }
        console.log(`Testing payment for fee: ${feeId}, buyer: ${fee.buyer_id}`);
        const result = await ledger_services_1.LedgerService.addPayment(fee.buyer_id, {
            amount: 1.00,
            description: 'Test fee payment',
            effective_date: new Date().toISOString(),
            allocation_type: 'FEE',
            allocation_target_id: feeId
        }, undefined);
        console.log('Payment successful:', JSON.stringify(result, null, 2));
    }
    catch (err) {
        console.error('Payment failed:', err);
    }
    finally {
        await db_1.prisma.$disconnect();
    }
}
test();

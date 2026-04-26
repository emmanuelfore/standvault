"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
async function check() {
    try {
        const entry = await db_1.prisma.ledger_entries.findFirst({
            take: 1
        });
        console.log('Sample entry:', JSON.stringify(entry, null, 2));
        // Test creation with new fields
        console.log('Testing creation with allocation fields...');
        // We won't actually create, just check if the fields exist in the client
        const fields = Object.keys(db_1.prisma.ledger_entries.fields || {});
        console.log('Available fields:', fields);
    }
    catch (err) {
        console.error('Check failed:', err);
    }
    finally {
        await db_1.prisma.$disconnect();
    }
}
check();

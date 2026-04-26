"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function migrate() {
    console.log('Migrating CHARGE to FEE in ledger_entries...');
    const result = await prisma.ledger_entries.updateMany({
        where: { entry_type: 'CHARGE' },
        data: { entry_type: 'FEE' }
    });
    console.log(`Updated ${result.count} entries.`);
    await prisma.$disconnect();
}
migrate().catch(err => {
    console.error(err);
    process.exit(1);
});

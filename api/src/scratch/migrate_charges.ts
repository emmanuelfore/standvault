import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Migrating CHARGE to FEE in ledger_entries...');
  const result = await (prisma as any).ledger_entries.updateMany({
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

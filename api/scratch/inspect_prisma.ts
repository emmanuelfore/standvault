
import { PrismaClient } from '@prisma/client';

async function check() {
  const prisma = new PrismaClient();
  console.log('Fields for ledger_entries:');
  // This is a hack to see what keys Prisma expects
  // @ts-ignore
  console.log(Object.keys(prisma.ledger_entries.fields || {}));
}

check();

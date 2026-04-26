import { LedgerService } from '../services/ledger.services';
import { prisma } from '../db';

async function test() {
  try {
    const buyer = await prisma.buyers.findFirst();
    if (!buyer) {
      console.log('No buyers found');
      return;
    }
    
    console.log(`Testing payment for buyer: ${buyer.id}`);
    const schedule = await prisma.instalment_schedules.findFirst({
        where: { buyer_id: buyer.id, status: 'ACTIVE' },
        include: { _count: { select: { periods: true } } }
    });
    console.log(`Active schedule ID: ${schedule?.id}, Period count: ${schedule?._count.periods}`);
    
    const result = await LedgerService.addPayment(buyer.id, {
      amount: 50.50,
      description: 'Test manual payment',
      effective_date: new Date().toISOString(),
      allocation_type: 'STAND'
    }, undefined);
    
    console.log('Payment successful:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Payment failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();

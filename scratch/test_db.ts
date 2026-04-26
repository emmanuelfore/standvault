import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

async function test() {
  try {
    const users = await prisma.users.findMany()
    console.log('Success!', users.length, 'users found')
  } catch (err) {
    console.error('Failure:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()

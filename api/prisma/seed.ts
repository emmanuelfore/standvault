import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcrypt'

const pool = new pg.Pool({ 
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT),
  ssl: {
    rejectUnauthorized: false
  }
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = 'admin@standvault.com'
  const adminPassword = 'adminpassword'
  
  const existingAdmin = await prisma.users.findUnique({
    where: { email: adminEmail }
  })

  if (!existingAdmin) {
    const password_hash = await bcrypt.hash(adminPassword, 12)
    await prisma.users.create({
      data: {
        email: adminEmail,
        password_hash,
        role: 'SYSTEM_ADMIN'
      }
    })
    console.log('✅ Default admin user created')
    console.log(`Email: ${adminEmail}`)
    console.log(`Password: ${adminPassword}`)
  } else {
    console.log('ℹ️ Admin user already exists')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })

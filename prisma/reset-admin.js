
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function resetAdmin() {
    console.log("Resetting admin password...")
    const hashedPassword = await bcrypt.hash("admin123", 10)

    await prisma.user.update({
        where: { username: "admin" },
        data: { password: hashedPassword }
    })

    console.log("Admin password reset to 'admin123'")
}

resetAdmin()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

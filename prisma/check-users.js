
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkUsers() {
    const users = await prisma.user.findMany({
        select: { username: true, role: true, name: true }
    })
    console.log("Users found:", users)
}

checkUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

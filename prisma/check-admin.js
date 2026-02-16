
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkAdmin() {
    const admin = await prisma.user.findUnique({
        where: { username: 'admin' }
    })

    if (admin) {
        console.log("Admin user found:", admin.username, admin.role)
    } else {
        console.log("Admin user NOT found!")
        // Let's create it if missing, as that's likely the login issue
        // But wait, I need bcrypt. 
    }

    const allUsers = await prisma.user.findMany()
    console.log("Total users:", allUsers.length)
    console.log("Usernames:", allUsers.map(u => u.username))
}

checkAdmin()
    .catch(console.error)
    .finally(() => prisma.$disconnect())

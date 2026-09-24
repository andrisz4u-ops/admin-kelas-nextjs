require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    console.log("Starting Nilai backfill...");
    const allNilai = await prisma.nilai.findMany({
        include: {
            siswa: {
                select: { kelas: true }
            }
        }
    });

    console.log(`Found ${allNilai.length} nilai records to verify/backfill.`);
    let updatedCount = 0;

    for (const n of allNilai) {
        const correctKelas = n.siswa.kelas || 1;
        if (n.kelas !== correctKelas) {
            await prisma.nilai.update({
                where: { id: n.id },
                data: {
                    kelas: correctKelas,
                    tahunAjaran: "2025/2026"
                }
            });
            updatedCount++;
        }
    }

    console.log(`Backfill complete. Updated ${updatedCount} records to match their student's class.`);
}

backfill()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

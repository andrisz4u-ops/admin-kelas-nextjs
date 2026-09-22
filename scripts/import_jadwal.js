const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DAYS_MAP = { 2: 'Senin', 3: 'Selasa', 4: 'Rabu', 5: 'Kamis', 6: 'Jumat' };

const WALI_KELAS = {
  1: 'Ade Setiawati, S.Pd',
  2: 'Kurnia Ningsih, S.Pd',
  3: 'Sarah Salsabila, S.Pd',
  4: 'Nur Atun, S.Pd',
  5: 'Andris Hadiansyah, S.Pd',
  6: 'Niken Fatmawati, S.Pd.SD'
};

const MAPEL_DISPLAY = {
  'B.Indonesia': 'Bahasa Indonesia',
  'MTK': 'Matematika',
  'IPAS': 'IPAS',
  'Pend.Pancasila': 'Pendidikan Pancasila',
  'PJOK': 'PJOK',
  'Seni': 'Seni',
  'B.Sunda': 'Bahasa Sunda',
  'TdBA': 'TdBA',
  'B.Inggris': 'Bahasa Inggris',
  'Koding KA': 'Koding & KA',
  'PAIBP': 'PAIBP',
  'Kokurikuler': 'Kokurikuler',
  'Upacara': 'Upacara',
  'Literasi': 'Literasi',
  'Kaulinan': 'Kaulinan',
  'Senam': 'Senam',
  'Nyucikeun diri': 'Nyucikeun diri'
};

async function importJadwal() {
  const filePath = 'C:/Users/Andris PC/Downloads/Jadwal Pelajaran SDN 2 Nangerang 2026_2027.xlsx';
  console.log('Reading Excel file from:', filePath);
  const wb = XLSX.readFile(filePath);
  let count = 0;

  for (const sheetName of wb.SheetNames) {
    const m = sheetName.match(/Kelas\s*(\d+)/i);
    if (!m) continue;
    const kelas = parseInt(m[1]);
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (const row of data) {
      if (!row || row.length < 3) continue;
      const jamVal = row[0];
      const waktuVal = row[1];
      if (typeof waktuVal !== 'string' || !waktuVal.includes('-')) continue;
      if (row.some(c => typeof c === 'string' && c.toLowerCase().includes('istirahat'))) continue;

      let jamKe = null;
      if (jamVal !== undefined && jamVal !== null && !isNaN(parseInt(jamVal))) {
        jamKe = parseInt(jamVal);
      } else if (waktuVal.includes('06.25')) {
        jamKe = 0;
      }
      if (jamKe === null) continue;

      let cleanWaktu = waktuVal.trim();
      if (jamKe === 3 && cleanWaktu.includes('09.45')) {
        cleanWaktu = '08.10 - 08.45';
      }

      for (let c = 2; c <= 6; c++) {
        const rawMapel = row[c];
        const hari = DAYS_MAP[c];
        if (!rawMapel || String(rawMapel).trim() === '' || String(rawMapel).trim() === '-') continue;

        const mapelClean = String(rawMapel).trim();
        const mapel = MAPEL_DISPLAY[mapelClean] || mapelClean;

        let guru = WALI_KELAS[kelas] || null;
        if (mapel.toUpperCase().includes('PAI')) {
          guru = 'Kuraesin, S.Pd.I';
        }

        await prisma.jadwalPelajaran.upsert({
          where: {
            kelas_hari_jamKe: {
              kelas,
              hari,
              jamKe
            }
          },
          update: {
            waktu: cleanWaktu,
            mapel,
            guru
          },
          create: {
            kelas,
            hari,
            jamKe,
            waktu: cleanWaktu,
            mapel,
            guru
          }
        });
        count++;
      }
    }
  }

  console.log(`Successfully imported and synchronized ${count} schedule entries across Kelas 1 to 6!`);
}

importJadwal()
  .catch(err => {
    console.error('Error importing jadwal:', err);
    process.exit(1);
  })
  .then(() => {
    prisma.$disconnect();
  });

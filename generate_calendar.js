const fs = require('fs');

const data = JSON.parse(fs.readFileSync('kaldik.json', 'utf-8'));

// Month mappings
const ganjilMonths = [
  { name: 'JULI', index: 6, year: 2026 },
  { name: 'AGUSTUS', index: 7, year: 2026 },
  { name: 'SEPTEMBER', index: 8, year: 2026 },
  { name: 'OKTOBER', index: 9, year: 2026 },
  { name: 'NOVEMBER', index: 10, year: 2026 },
  { name: 'DESEMBER', index: 11, year: 2026 }
];

const genapMonths = [
  { name: 'JANUARI', index: 0, year: 2027 },
  { name: 'FEBRUARI', index: 1, year: 2027 },
  { name: 'MARET', index: 2, year: 2027 },
  { name: 'APRIL', index: 3, year: 2027 },
  { name: 'MEI', index: 4, year: 2027 },
  { name: 'JUNI', index: 5, year: 2027 }
];

let holidays = [];
let specialEvents = [];

// Helper to format date
const formatDate = (year, month, day) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Process rows
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (!row || !row[0]) continue;
  
  const monthName = row[0].toString().trim().toUpperCase();
  let monthInfo = ganjilMonths.find(m => m.name === monthName) || genapMonths.find(m => m.name === monthName);
  
  if (monthInfo) {
    // Process days 1 to 31
    for (let day = 1; day <= 31; day++) {
      const code = row[day];
      if (code && typeof code === 'string') {
        const c = code.trim();
        const dateStr = formatDate(monthInfo.year, monthInfo.index, day);
        
        if (c === 'X') {
          // Weekend, ignore for holidays array unless we want to track it
        } else if (['LN', 'PHBI', 'LAS', 'LAR', 'L.IDUL FITRI', 'LAT'].includes(c)) {
          holidays.push(`"${dateStr}", // ${c}`);
        } else if (c) {
          specialEvents.push(`// ${dateStr}: ${c}`);
        }
      }
    }
  }
}

let out = `
export const SCHOOL_CALENDAR_2026_2027 = {
    academicYear: "2026/2027",
    semester1: {
        start: new Date(2026, 6, 13), // Assuming July 13th start based on MPLS
        end: new Date(2026, 11, 23), // Assuming end before SAS
    },
    semester2: {
        start: new Date(2027, 0, 11), // Assuming Jan 11 start
        end: new Date(2027, 5, 25), // Assuming late June end
    },
    holidays: [
        ${holidays.join('\n        ')}
    ],
    specialDays: [
        ${specialEvents.join('\n        ')}
    ]
};
`;

fs.writeFileSync('kaldik_export.ts', out);
console.log("Written to kaldik_export.ts");

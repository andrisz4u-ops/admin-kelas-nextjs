const xlsx = require('xlsx');
const fs = require('fs');

try {
    const workbook = xlsx.readFile('C:\\Users\\Andris PC\\Downloads\\KALDIK SDN 2 Nangerang.xlsm');
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    fs.writeFileSync('kaldik.json', JSON.stringify(data, null, 2));
    console.log("Written to kaldik.json");
} catch (e) {
    console.error("Error reading file:", e);
}

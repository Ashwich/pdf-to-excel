const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pdf_extracts.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database\n');
});

// Get all records
db.all(`SELECT * FROM pdf_extracts ORDER BY created_at DESC`, [], (err, rows) => {
  if (err) {
    console.error('Error fetching data:', err.message);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('No records found in the database.');
    db.close();
    return;
  }

  console.log(`Found ${rows.length} record(s):\n`);
  console.log('='.repeat(80));

  rows.forEach((row, index) => {
    console.log(`\nRecord #${index + 1}`);
    console.log('-'.repeat(80));
    console.log(`ID: ${row.id}`);
    console.log(`Original Filename: ${row.original_filename}`);
    console.log(`Stored Filename: ${row.filename}`);
    console.log(`Created At: ${row.created_at}`);
    console.log(`Text Length: ${row.extracted_text ? row.extracted_text.length : 0} characters`);
    console.log(`Excel Data Length: ${row.excel_data ? row.excel_data.length : 0} characters`);
    
    // Show preview of extracted text
    if (row.extracted_text) {
      const preview = row.extracted_text.substring(0, 200);
      console.log(`\nExtracted Text Preview (first 200 chars):`);
      console.log(preview + (row.extracted_text.length > 200 ? '...' : ''));
    }

    // Show preview of Excel data
    if (row.excel_data) {
      try {
        const excelData = JSON.parse(row.excel_data);
        console.log(`\nExcel Data Preview:`);
        console.log(`  - Number of rows: ${excelData.length}`);
        if (excelData.length > 0) {
          console.log(`  - Columns: ${Object.keys(excelData[0]).join(', ')}`);
          console.log(`  - First row sample:`);
          console.log(`    ${JSON.stringify(excelData[0], null, 2)}`);
        }
      } catch (e) {
        console.log(`  - Could not parse Excel data`);
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  db.close();
});


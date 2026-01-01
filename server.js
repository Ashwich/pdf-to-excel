const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize SQLite database
const db = new sqlite3.Database('pdf_extracts.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS pdf_extracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      extracted_text TEXT,
      excel_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Helper function to parse blood report text
function parseBloodReport(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const data = [];
  
  // Common blood test patterns
  const testPatterns = [
    /([A-Z][A-Za-z\s]+?)\s*:?\s*([\d.]+)\s*([a-zA-Z\/%]+)?/g,
    /([A-Z][A-Za-z\s]+?)\s+([\d.]+)\s*([a-zA-Z\/%]+)?/g
  ];
  
  lines.forEach((line, index) => {
    // Try to extract test name and value
    for (const pattern of testPatterns) {
      const matches = [...line.matchAll(pattern)];
      if (matches.length > 0) {
        matches.forEach(match => {
          const testName = match[1].trim();
          const value = match[2].trim();
          const unit = match[3] ? match[3].trim() : '';
          
          // Filter out common non-test words
          if (testName.length > 2 && !testName.match(/^(Patient|Name|Date|Age|Gender|Report|Test|Result|Reference|Normal|Range)$/i)) {
            data.push({
              'Test Name': testName,
              'Value': value,
              'Unit': unit,
              'Row Number': index + 1
            });
          }
        });
      }
    }
    
    // If no pattern matched, try to extract if line contains numbers
    if (data.length === 0 || !line.match(/\d/)) {
      // Check if it's a header or test name
      if (line.length > 3 && line.length < 50) {
        const nextLine = lines[index + 1];
        if (nextLine && nextLine.match(/[\d.]+/)) {
          const valueMatch = nextLine.match(/([\d.]+)\s*([a-zA-Z\/%]+)?/);
          if (valueMatch) {
            data.push({
              'Test Name': line,
              'Value': valueMatch[1],
              'Unit': valueMatch[2] || '',
              'Row Number': index + 1
            });
          }
        }
      }
    }
  });
  
  // If no structured data found, return raw lines
  if (data.length === 0) {
    lines.forEach((line, index) => {
      if (line.length > 0) {
        data.push({
          'Line Number': index + 1,
          'Content': line
        });
      }
    });
  }
  
  return data;
}

// Route: Upload and extract PDF
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Extract text from PDF
    const pdfData = await pdfParse(fileBuffer);
    const extractedText = pdfData.text;

    // Parse the extracted text
    const parsedData = parseBloodReport(extractedText);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Blood Report Data');
    
    // Add headers
    if (parsedData.length > 0) {
      const headers = Object.keys(parsedData[0]);
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: 30
      }));
      
      // Add data rows
      parsedData.forEach(row => {
        worksheet.addRow(row);
      });
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    } else {
      // If no structured data, add raw text
      worksheet.addRow(['Extracted Text']);
      worksheet.addRow([extractedText]);
    }

    // Save Excel to buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Save to database
    const excelDataJson = JSON.stringify(parsedData);
    
    db.run(
      `INSERT INTO pdf_extracts (filename, original_filename, extracted_text, excel_data) 
       VALUES (?, ?, ?, ?)`,
      [req.file.filename, req.file.originalname, extractedText, excelDataJson],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to save to database' });
        }

        // Delete the uploaded PDF file after processing
        fs.unlinkSync(filePath);

        res.json({
          success: true,
          message: 'PDF processed successfully',
          id: this.lastID,
          filename: req.file.originalname,
          extractedText: extractedText.substring(0, 500) + '...', // Preview
          rowCount: parsedData.length
        });
      }
    );
  } catch (error) {
    console.error('Error processing PDF:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
  }
});

// Route: Get all extracts
app.get('/api/extracts', (req, res) => {
  db.all(
    `SELECT id, original_filename, filename, created_at, 
     LENGTH(extracted_text) as text_length,
     LENGTH(excel_data) as data_length
     FROM pdf_extracts 
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch extracts' });
      }
      res.json(rows);
    }
  );
});

// Route: Get extract by ID
app.get('/api/extracts/:id', (req, res) => {
  const id = req.params.id;
  
  db.get(
    `SELECT * FROM pdf_extracts WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch extract' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Extract not found' });
      }
      res.json(row);
    }
  );
});

// Route: Get database stats and preview
app.get('/api/database-info', (req, res) => {
  db.all(
    `SELECT 
      id, 
      original_filename, 
      filename, 
      created_at,
      LENGTH(extracted_text) as text_length,
      LENGTH(excel_data) as data_length,
      SUBSTR(extracted_text, 1, 500) as text_preview,
      excel_data
     FROM pdf_extracts 
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch database info' });
      }
      
      // Parse Excel data for each row
      const processedRows = rows.map(row => {
        let excelDataPreview = null;
        if (row.excel_data) {
          try {
            const parsed = JSON.parse(row.excel_data);
            excelDataPreview = {
              rowCount: parsed.length,
              columns: parsed.length > 0 ? Object.keys(parsed[0]) : [],
              firstRow: parsed.length > 0 ? parsed[0] : null
            };
          } catch (e) {
            excelDataPreview = { error: 'Could not parse' };
          }
        }
        
        return {
          ...row,
          excelDataPreview
        };
      });
      
      res.json({
        totalRecords: rows.length,
        records: processedRows
      });
    }
  );
});

// Route: Download Excel file
app.get('/api/download/:id', (req, res) => {
  const id = req.params.id;
  
  db.get(
    `SELECT * FROM pdf_extracts WHERE id = ?`,
    [id],
    async (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to fetch extract' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Extract not found' });
      }

      try {
        // Create Excel workbook from stored data
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Blood Report Data');
        
        const parsedData = JSON.parse(row.excel_data);
        
        if (parsedData.length > 0) {
          const headers = Object.keys(parsedData[0]);
          worksheet.columns = headers.map(header => ({
            header: header,
            key: header,
            width: 30
          }));
          
          parsedData.forEach(dataRow => {
            worksheet.addRow(dataRow);
          });
          
          // Style the header row
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        } else {
          // Fallback to raw text
          worksheet.addRow(['Extracted Text']);
          worksheet.addRow([row.extracted_text]);
        }

        // Set response headers
        const filename = row.original_filename.replace('.pdf', '.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write Excel to response
        await workbook.xlsx.write(res);
        res.end();
      } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
      }
    }
  );
});

// Route: Delete extract
app.delete('/api/extracts/:id', (req, res) => {
  const id = req.params.id;
  
  db.run(
    `DELETE FROM pdf_extracts WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete extract' });
      }
      res.json({ success: true, message: 'Extract deleted successfully' });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});


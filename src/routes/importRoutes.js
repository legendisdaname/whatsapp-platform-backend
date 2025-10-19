const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(csv|xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, XLS, and XLSX files are allowed'));
    }
  }
});

/**
 * @swagger
 * /api/import/contacts:
 *   post:
 *     summary: Import contacts from CSV or Excel file
 *     tags: [Import]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               session_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import results
 */
router.post('/contacts', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'session_id is required'
      });
    }
    
    const fileType = req.file.mimetype;
    const fileName = req.file.originalname;
    let contacts = [];
    
    // Parse based on file type
    if (fileName.endsWith('.csv') || fileType === 'text/csv') {
      contacts = await parseCSV(req.file.buffer);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      contacts = await parseExcel(req.file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported file format'
      });
    }
    
    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid contacts found in file'
      });
    }
    
    // Import contacts into database
    const results = await importContacts(contacts, session_id);
    
    res.json({
      success: true,
      imported: results.success,
      failed: results.failed,
      total: contacts.length,
      errors: results.errors
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import contacts',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/import/template/download:
 *   get:
 *     summary: Download contact import template
 *     tags: [Import]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx]
 */
router.get('/template/download', (req, res) => {
  const format = req.query.format || 'csv';
  
  if (format === 'csv') {
    const csv = 'phone_number,name,email,notes\n1234567890,John Doe,john@example.com,VIP customer\n9876543210,Jane Smith,jane@example.com,Newsletter subscriber';
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts_template.csv');
    res.send(csv);
  } else if (format === 'xlsx') {
    const workbook = xlsx.utils.book_new();
    const data = [
      ['phone_number', 'name', 'email', 'notes'],
      ['1234567890', 'John Doe', 'john@example.com', 'VIP customer'],
      ['9876543210', 'Jane Smith', 'jane@example.com', 'Newsletter subscriber']
    ];
    
    const worksheet = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts_template.xlsx');
    res.send(buffer);
  } else {
    res.status(400).json({ error: 'Invalid format' });
  }
});

// Helper: Parse CSV
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const contacts = [];
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csvParser())
      .on('data', (row) => {
        if (row.phone_number) {
          contacts.push({
            phone_number: row.phone_number.replace(/[^0-9]/g, ''),
            name: row.name || '',
            email: row.email || '',
            notes: row.notes || ''
          });
        }
      })
      .on('end', () => resolve(contacts))
      .on('error', (error) => reject(error));
  });
}

// Helper: Parse Excel
async function parseExcel(buffer) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    return data.map(row => ({
      phone_number: (row.phone_number || row.phone || '').toString().replace(/[^0-9]/g, ''),
      name: row.name || '',
      email: row.email || '',
      notes: row.notes || ''
    })).filter(contact => contact.phone_number);
  } catch (error) {
    throw new Error('Failed to parse Excel file: ' + error.message);
  }
}

// Helper: Import contacts to database
async function importContacts(contacts, sessionId) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (const contact of contacts) {
    try {
      // Validate phone number
      if (!contact.phone_number || contact.phone_number.length < 7) {
        results.failed++;
        results.errors.push({
          contact: contact,
          error: 'Invalid phone number'
        });
        continue;
      }
      
      // Insert contact
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .insert([{
          session_id: sessionId,
          phone_number: contact.phone_number,
          name: contact.name,
          email: contact.email,
          notes: contact.notes
        }])
        .select()
        .single();
      
      if (error) {
        // Check if duplicate
        if (error.code === '23505') {
          results.errors.push({
            contact: contact,
            error: 'Duplicate phone number'
          });
        } else {
          results.errors.push({
            contact: contact,
            error: error.message
          });
        }
        results.failed++;
      } else {
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        contact: contact,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * @swagger
 * /api/import/contacts-to-group:
 *   post:
 *     summary: Import contacts directly into a group
 *     tags: [Import]
 */
router.post('/contacts-to-group', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const { session_id, group_id } = req.body;
    
    if (!session_id || !group_id) {
      return res.status(400).json({
        success: false,
        error: 'session_id and group_id are required'
      });
    }
    
    const fileName = req.file.originalname;
    let contacts = [];
    
    // Parse file
    if (fileName.endsWith('.csv')) {
      contacts = await parseCSV(req.file.buffer);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      contacts = await parseExcel(req.file.buffer);
    }
    
    // Import and add to group
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const contact of contacts) {
      try {
        // Insert contact
        const { data: newContact, error: contactError } = await supabaseAdmin
          .from('contacts')
          .insert([{
            session_id: session_id,
            phone_number: contact.phone_number,
            name: contact.name,
            email: contact.email,
            notes: contact.notes
          }])
          .select()
          .single();
        
        if (contactError && contactError.code !== '23505') {
          results.failed++;
          continue;
        }
        
        // Get contact ID (either newly created or existing)
        let contactId = newContact?.id;
        
        if (!contactId) {
          // Contact already exists, get it
          const { data: existing } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('session_id', session_id)
            .eq('phone_number', contact.phone_number)
            .single();
          
          contactId = existing?.id;
        }
        
        if (contactId) {
          // Add to group
          await supabaseAdmin
            .from('contact_group_members')
            .insert([{
              group_id: group_id,
              contact_id: contactId
            }]);
          
          results.success++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          contact: contact,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      imported: results.success,
      failed: results.failed,
      total: contacts.length,
      errors: results.errors
    });
    
  } catch (error) {
    console.error('Import to group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import contacts',
      message: error.message
    });
  }
});

module.exports = router;


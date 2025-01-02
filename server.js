const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3000;

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Add file filter to explicitly handle text files
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'text/plain' || 
        file.originalname.toLowerCase().endsWith('.txt')) {
        cb(null, true);
    } else {
        cb(null, true); // Allow other existing file types
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter
});

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// File upload endpoint with error handling
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        res.json({ 
            message: 'File uploaded successfully',
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'File upload failed' });
    }
});

// Serve index.html for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

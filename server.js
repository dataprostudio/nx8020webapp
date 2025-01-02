import express from 'express';
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer with file size and type restrictions
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only CSV, TXT, and Excel files are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Initialize Llama model with error handling
let model, context, session;

async function initializeLLM() {
    try {
        const modelPath = join(__dirname, 'models', 'Llama-3.2-3B.Q4_K_M.gguf');
        
        if (!fs.existsSync(modelPath)) {
            console.warn('LLM model not found at:', modelPath);
            return false;
        }

        model = new LlamaModel({
            modelPath: modelPath,
            contextSize: 256,     // Reduced from 512
            threads: 1,           // Reduced from 2
            batchSize: 128,       // Reduced from 256
            gpuLayers: 0,
            embedding: false,     // Disable embedding to reduce memory usage
            f16KV: true,         // Enable f16 key/value cache
            logitsAll: false      // Disable all logits computation
        });
        
        context = new LlamaContext({ 
            model,
            threads: 1,          // Match model threads
            batchSize: 128,      // Match model batch size
            contextSize: 256     // Match model context size
        });

        session = new LlamaChatSession({
            context,
            maxTokens: 64,       // Reduced from 128
            temperature: 0.7,    // Add temperature for more focused responses
            topK: 20,           // Limit token selection
            topP: 0.9           // Further limit token selection
        });
        
        console.log('LLM initialized successfully with reduced parameters');
        return true;
    } catch (error) {
        console.error('Error initializing LLM:', error);
        return false;
    }
}

// Start server with fallback for missing LLM
const startServer = async () => {
    const llmInitialized = await initializeLLM();

    // Enhanced file upload endpoint
    app.post('/upload', (req, res) => {
        upload.single('file')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ 
                        error: 'File too large. Maximum size is 5MB.' 
                    });
                }
                return res.status(400).json({ error: err.message });
            } else if (err) {
                return res.status(400).json({ error: err.message });
            }
            
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded.' });
            }

            // Return success response with file details
            res.json({ 
                message: 'File uploaded successfully',
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
        });
    });

    // LLM analysis endpoint with fallback
    app.post('/api/llm/analyze', async (req, res) => {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Expires': '-1',
            'Pragma': 'no-cache'
        });

        try {
            if (!llmInitialized) {
                return res.json({ 
                    analysis: "LLM not available - running in fallback mode",
                    fallback: true
                });
            }

            const { text } = req.body;
            if (!text) {
                throw new Error('No text provided');
            }

            const processData = JSON.parse(text);
            
            // Limit input size
            const truncatedData = {
                nodeCount: Math.min(processData.nodeCount, 50),
                edgeCount: Math.min(processData.edgeCount, 100),
                connections: (processData.connections || []).slice(0, 3)
            };

            const prompt = `Brief process analysis (max 50 words):
                Steps: ${truncatedData.nodeCount}
                Connections: ${truncatedData.edgeCount}
                Sample: ${truncatedData.connections.join(', ')}`;

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('LLM timeout')), 5000) // Reduced from 10000
            );

            const analysisPromise = session.prompt(prompt);
            
            const response = await Promise.race([analysisPromise, timeoutPromise])
                .catch(error => {
                    console.warn('LLM processing warning:', error);
                    return null;
                });

            if (!response) {
                return res.json({
                    analysis: "Analysis timeout - using fallback mode",
                    fallback: true
                });
            }

            res.json({ 
                analysis: response.slice(0, 200), // Limit response size
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('LLM analysis error:', error);
            res.json({
                analysis: "Analysis error - using fallback mode",
                fallback: true,
                error: error.message
            });
        }
    });

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'ok', 
            llmAvailable: !!model && !!context && !!session,
            timestamp: Date.now(),
            mode: model ? 'full' : 'fallback'
        });
    });

    // Serve index.html
    app.get('*', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log('LLM Status:', llmInitialized ? 'Available' : 'Running in fallback mode');
    });
};

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

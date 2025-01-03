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

        // Check for GPU support with graceful fallback
        const [hasNvidia, hasCuda] = await Promise.all([
            checkNvidiaGPU().catch(() => false),
            checkCudaSupport().catch(() => false)
        ]);

        const gpuMode = hasNvidia && hasCuda;
        console.log('GPU Mode:', gpuMode ? 'Enabled' : 'Disabled (using CPU)');

        model = new LlamaModel({
            modelPath: modelPath,
            contextSize: 2048,
            threads: 4,
            batchSize: 512,
            gpuLayers: gpuMode ? 32 : 0,  // Only use GPU layers if GPU is available
            embedding: false,
            f16KV: gpuMode,               // Only use f16 with GPU
            logitsAll: false,
            vocabOnly: false,
            useMlock: true,
            useMLock: true
        });
        
        context = new LlamaContext({ 
            model,
            threads: 4,
            batchSize: 512,
            contextSize: 2048
        });

        session = new LlamaChatSession({
            context,
            maxTokens: 2048,
            temperature: 0.7,
            topK: 20,
            topP: 0.9
        });
        
        console.log('LLM initialized successfully with GPU support');
        return true;
    } catch (error) {
        console.error('Error initializing LLM:', error);
        return false;
    }
}

// Update GPU detection function to be platform-aware
async function checkNvidiaGPU() {
    try {
        const { exec } = await import('child_process');
        const platform = process.platform;
        
        // Different commands for different platforms
        const command = platform === 'win32' ? 
            'nvidia-smi' : 
            'command -v nvidia-smi && nvidia-smi';

        return new Promise((resolve) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.log(`GPU check failed on ${platform}:`, error.message);
                    resolve(false);
                    return;
                }
                if (stderr) {
                    console.log('GPU check stderr:', stderr);
                    resolve(false);
                    return;
                }
                const gpuInfo = stdout.toString().trim();
                const hasGPU = gpuInfo.includes('NVIDIA');
                console.log(`GPU check (${platform}):`, hasGPU ? 'NVIDIA GPU detected' : 'No NVIDIA GPU found');
                resolve(hasGPU);
            });
        });
    } catch (error) {
        console.error('GPU detection error:', error);
        return false;
    }
}

// Add this function after checkNvidiaGPU()
async function checkCudaSupport() {
    try {
        // Check if node-llama-cpp was compiled with CUDA
        const cudaInfo = await LlamaModel.getBackendInfo();
        const hasCuda = cudaInfo.includes('cuda');
        console.log('CUDA support:', hasCuda ? 'Available' : 'Not available');
        console.log('Backend info:', cudaInfo);
        return hasCuda;
    } catch (error) {
        console.error('Error checking CUDA support:', error);
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

    // Diagnostic endpoint
    app.get('/api/llm/status', async (req, res) => {
        try {
            const cudaInfo = {
                available: process.env.CUDA_VISIBLE_DEVICES !== undefined,
                version: process.env.CUDA_VERSION,
                devices: process.env.CUDA_VISIBLE_DEVICES,
                gpuLayers: model ? model.gpuLayers : 0
            };

            res.json({
                status: 'ok',                cuda: cudaInfo,                model: {                    loaded: !!model,                    type: model ? model.modelPath : null
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message,
                cuda: {
                    available: false,
                    error: error.message
                }
            });
        }
    });

    // Add diagnostic endpoint for GPU/LLM status
    app.get('/api/system/status', async (req, res) => {
        try {
            const [hasGPU, hasCuda] = await Promise.all([
                checkNvidiaGPU(),
                checkCudaSupport()
            ]);
            
            const modelStatus = model ? 'loaded' : 'not loaded';
            const gpuStatus = hasGPU ? 'available' : 'not available';
            
            res.json({
                gpu: gpuStatus,
                cuda: {
                    available: hasCuda,
                    backend: await LlamaModel.getBackendInfo()
                },
                model: modelStatus,
                context: context ? 'initialized' : 'not initialized',
                session: session ? 'active' : 'inactive',
                modelConfig: model ? {
                    contextSize: model.contextSize,
                    gpuLayers: model.gpuLayers,
                    threads: model.threads
                } : null
            });
        } catch (error) {
            res.status(500).json({
                error: 'Error checking system status',
                details: error.message
            });
        }
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

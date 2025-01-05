import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import multer from 'multer';
import fs from 'fs';
import https from 'https';
import { createWriteStream } from 'fs';
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import dotenv from 'dotenv';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MODEL_PATH = './models/llama-3.2-1b-instruct-q4_k_m.gguf';

// Initialize Express app once at the top level
const app = express();

// Core middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer
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

// Initialize global variables for LLM
let model, context, session;

// Helper Functions
async function checkLlamaCppCudaBuild() {
    try {
        const llamaModule = await import('node-llama-cpp').catch(err => {
            console.warn('Failed to import node-llama-cpp:', err.message);
            return null;
        });

        if (!llamaModule) {
            console.warn('node-llama-cpp module not available');
            return false;
        }

        // Check if the module has the expected interface
        if (!llamaModule.LlamaModel) {
            console.warn('LlamaModel not found in module');
            return false;
        }

        return true;
    } catch (error) {
        console.warn('CUDA build check failed:', error.message);
        return false;
    }
}

async function checkNvidiaGPU() {
    try {
        const { exec } = await import('child_process');
        
        if (process.platform === 'win32') {
            // Array of possible nvidia-smi paths on Windows
            const possiblePaths = [
                'C:\\Windows\\System32\\DriverStore\\FileRepository\\nvdmui.inf_amd64_fe0e7a1a3acec41f\\nvidia-smi.exe',  // Add this specific path first
                'nvidia-smi', // Keep as fallback
                'C:\\Windows\\System32\\nvidia-smi.exe',
                'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe'
            ];

            // Try each path until one works
            for (const path of possiblePaths) {
                try {
                    const result = await new Promise((resolve, reject) => {
                        exec(`"${path}"`, { shell: true }, (error, stdout, stderr) => {
                            if (error) {
                                reject(error);
                                return;
                            }
                            resolve(stdout);
                        });
                    });

                    const hasNvidia = result.toLowerCase().includes('nvidia');
                    console.log('NVIDIA GPU Detection Result:', hasNvidia);
                    return hasNvidia;
                } catch (pathError) {
                    console.log(`Failed to execute nvidia-smi at path: ${path}`);
                    continue; // Try next path
                }
            }

            // Fallback to WMI query if nvidia-smi not found
            return new Promise((resolve) => {
                exec('wmic path win32_videocontroller get name', { shell: true }, (error, stdout) => {
                    if (error) {
                        console.error('WMI GPU detection error:', error);
                        resolve(false);
                        return;
                    }
                    
                    const hasNvidia = stdout.toLowerCase().includes('nvidia');
                    console.log('WMI GPU Detection Result:', hasNvidia);
                    resolve(hasNvidia);
                });
            });
        }

        // For non-Windows systems, keep the existing check
        return new Promise((resolve) => {
            exec('command -v nvidia-smi && nvidia-smi', (error, stdout) => {
                const hasGPU = !error && stdout.includes('NVIDIA');
                console.log('NVIDIA GPU Detection (Unix):', hasGPU ? 'Available' : 'Not Found');
                resolve(hasGPU);
            });
        });
    } catch (error) {
        console.error('GPU detection error:', error);
        return false;
    }
}

async function tryLoadLlamaModule() {
    try {
        const module = await import('node-llama-cpp');
        if (!module || !module.LlamaModel) {
            throw new Error('Invalid llama module structure');
        }
        return module;
    } catch (error) {
        console.error('Failed to load node-llama-cpp:', error);
        return null;
    }
}

async function downloadModel(url, modelPath) {
    console.log('Downloading model from:', url);
    const modelsDir = dirname(modelPath);
    
    try {
        await fs.promises.mkdir(modelsDir, { recursive: true });
        
        // Load environment variables
        const env = await import('dotenv').then(module => module.config());
        const HF_TOKEN = process.env.HUGGING_FACE_TOKEN;
        
        if (!HF_TOKEN) {
            throw new Error('Hugging Face token not found in environment variables');
        }
        
        const tempPath = `${modelPath}.downloading`;
        const file = createWriteStream(tempPath);
        
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            const request = https.get(url, options, response => {
                if (response.statusCode === 401) {
                    reject(new Error('Unauthorized: Invalid Hugging Face token'));
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);

                file.on('finish', async () => {
                    file.close();
                    try {
                        // Verify the downloaded file before renaming
                        const isValid = await verifyModelIntegrity(tempPath);
                        if (!isValid) {
                            await fs.promises.unlink(tempPath);
                            reject(new Error('Downloaded file verification failed'));
                            return;
                        }

                        await fs.promises.rename(tempPath, modelPath);
                        console.log('Download completed and verified');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            request.on('error', err => {
                fs.unlink(tempPath, () => {});
                reject(err);
            });

            // Add timeout
            request.setTimeout(600000, () => { // 10 minutes
                request.destroy();
                fs.unlink(tempPath, () => {});
                reject(new Error('Download timed out'));
            });
        });
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

async function ensureModelExists(modelPath) {
    try {
        console.log('Checking model path:', modelPath);
        
        // First, ensure the models directory exists
        const modelsDir = dirname(modelPath);
        if (!fs.existsSync(modelsDir)) {
            console.log('Creating models directory...');
            await fs.promises.mkdir(modelsDir, { recursive: true });
        }

        // Check if model file exists and is accessible
        if (fs.existsSync(modelPath)) {
            const stats = await fs.promises.stat(modelPath);
            console.log('Model file stats:', {
                size: stats.size,
                exists: true,
                path: modelPath
            });

            if (stats.size < 1024) { // Basic size check
                console.error('Model file exists but appears to be empty or corrupt');
                return false;
            }

            const isValid = await verifyModelIntegrity(modelPath);
            if (!isValid) {
                console.error('Model file failed integrity check');
                return false;
            }

            console.log('Existing model file verified successfully');
            return true;
        }

        console.error('Model file not found at path:', modelPath);
        return false;

    } catch (error) {
        console.error('Error checking model file:', error);
        return false;
    }
}

async function verifyModelIntegrity(modelPath) {
    try {
        // First check file permissions
        try {
            await fs.promises.access(modelPath, fs.constants.R_OK);
            console.log('File is readable by Node.js process');
        } catch (permError) {
            console.error('Permission error:', {
                path: modelPath,
                error: permError.message,
                uid: process.getuid?.() || 'N/A',
                gid: process.getgid?.() || 'N/A'
            });
            return false;
        }

        // Get detailed file stats
        const stats = await fs.promises.stat(modelPath);
        console.log('File permissions:', {
            mode: stats.mode.toString(8),
            uid: stats.uid,
            gid: stats.gid,
            size: stats.size
        });

        if (stats.size < 1024) {
            console.error('Model file too small');
            return false;
        }

        // Attempt to open and read from the file
        const fd = await fs.promises.open(modelPath, 'r');
        const buffer = Buffer.alloc(4);
        
        try {
            await fd.read(buffer, 0, 4, 0);
        } finally {
            await fd.close();
        }

        // GGUF magic number check
        const expectedMagic = Buffer.from([0x47, 0x47, 0x55, 0x46]);
        if (!buffer.equals(expectedMagic)) {
            console.error('Invalid GGUF magic bytes:', buffer);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Model verification error:', {
            error: error.message,
            path: modelPath,
            stack: error.stack
        });
        return false;
    }
}

async function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(findAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
        
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => {
                resolve(port);
            });
        });
    });
}

// LLM Initialization
async function initializeLLM() {
    try {
        const { LlamaModel, LlamaContext, LlamaChatSession } = await import('node-llama-cpp')
            .catch(err => {
                console.error('Failed to import node-llama-cpp:', err);
                return { LlamaModel: null, LlamaContext: null, LlamaChatSession: null };
            });

        if (!LlamaModel) {
            throw new Error('LlamaModel module not available');
        }

        // Use the MODEL_PATH declared at the top of the file
        const modelPath = resolve(__dirname, MODEL_PATH);
        
        // Check if CUDA is available first
        const hasGPU = await checkNvidiaGPU();
        const hasCudaBuild = await checkLlamaCppCudaBuild();
        
        console.log('GPU Detection:', {
            gpuAvailable: hasGPU,
            cudaBuildAvailable: hasCudaBuild
        });

        if (!hasGPU || !hasCudaBuild) {
            console.warn('GPU acceleration not available - falling back to CPU mode');
        }

        // Enhanced model configuration with explicit GPU settings
        const config = {
            modelPath: modelPath,
            enableLogging: true,
            threads: 4,
            contextSize: 2048,
            batch: 512,
            gpuLayers: hasGPU && hasCudaBuild ? 35 : 0, // Explicitly set number of GPU layers
            mainGpu: 0,
            embeddings: true,
            tensorSplit: hasGPU ? '99:1' : undefined, // Adjust tensor split ratio
            useMlock: true,
            useMemorymap: !hasGPU, // Disable memory mapping when using GPU
            seed: 42,
            gpu: hasGPU && hasCudaBuild, // Explicitly enable GPU
            f16KV: true, // Enable half-precision for key/value cache
            vocabOnly: false,
            logitsAll: false
        };

        console.log('Creating model with config:', config);
        const model = new LlamaModel(config);

        if (!model) {
            throw new Error('Model initialization failed - null model instance');
        }

        // Verify GPU usage
        const gpuLayers = model.gpuLayers || 0;
        console.log('GPU Configuration:', {
            gpuLayers: gpuLayers,
            hasGPU: hasGPU,
            hasCudaBuild: hasCudaBuild,
            tensorSplit: config.tensorSplit,
            modelPath: modelPath
        });

        // More detailed GPU verification
        if (hasGPU && hasCudaBuild && gpuLayers === 0) {
            console.warn('GPU initialization failed - check CUDA installation and model compatibility');
            throw new Error('GPU initialization failed');
        }

        console.log('Model loaded successfully in ' + (gpuLayers > 0 ? 'GPU' : 'CPU') + ' mode');
        const context = new LlamaContext({ model });
        const session = new LlamaChatSession({ context });

        // Store references globally
        global.llamaModel = model;
        global.llamaContext = context;
        global.llamaSession = session;

        return true;

    } catch (error) {
        console.error('LLM initialization error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return false;
    }
}

// API Routes
app.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ 
                error: err.message || 'File upload failed'
            });
        }

        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded'
            });
        }

        console.log('File uploaded successfully:', req.file.filename);

        res.json({ 
            message: 'File uploaded successfully',
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    });
});

app.post('/api/llm/analyze', async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Expires': '-1',
        'Pragma': 'no-cache'
    });

    try {
        if (!model || !context || !session) {
            return res.json({
                analysis: "Running in fallback mode - LLM not available",
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

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        llmAvailable: !!model && !!context && !!session,
        timestamp: Date.now(),
        mode: model ? 'full' : 'fallback'
    });
});

app.get('/api/llm/status', (req, res) => {
    res.json({
        available: !!(model && context && session),
        mode: model?.gpuLayers > 0 ? 'GPU' : 'CPU',
        gpuLayers: model?.gpuLayers || 0,
        contextSize: model?.contextSize || 0
    });
});

app.get('/api/system/status', async (req, res) => {
    try {
        const [hasGPU, hasCuda] = await Promise.all([
            checkNvidiaGPU(),
            checkCudaSupport()
        ]);
        
        const modelStatus = model ? 'loaded' : 'not loaded';
        const gpuStatus = hasGPU ? 'available' : 'not available';
        
        // Use dynamic import for getting backend info
        const backendInfo = await LlamaModel.getBackendInfo().catch(() => 'unavailable');
        
        res.json({
            gpu: gpuStatus,
            cuda: {
                available: hasCuda,
                backend: backendInfo
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

app.get('/api/llm/build-info', async (req, res) => {
    try {
        const hasCudaBuild = await checkLlamaCppCudaBuild();
        const gpuAvailable = await checkNvidiaGPU();
        
        res.json({
            cudaBuildAvailable: hasCudaBuild,
            gpuAvailable: gpuAvailable,
            currentMode: hasCudaBuild && gpuAvailable ? 'GPU' : 'CPU',
            buildInfo: await LlamaModel.getBackendInfo?.() || 'Not available'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to check build info',
            details: error.message
        });
    }
});

app.get('/api/model/status', async (req, res) => {
    try {
        const modelPath = resolve(__dirname, 'models', 'llama-3.2-1b-instruct-q4_k_m.gguf');
        const exists = fs.existsSync(modelPath);
        const stats = exists ? await fs.promises.stat(modelPath) : null;
        
        res.json({
            modelPath: modelPath,
            exists: exists,
            fileSize: stats ? stats.size : null,
            modelLoaded: !!model,
            contextInitialized: !!context,
            sessionActive: !!session
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error checking model status',
            details: error.message
        });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Start server
const startServer = async () => {
    try {
        const port = await findAvailablePort(3000);
        
        // Initialize LLM
        let llmInitialized = false;
        try {
            llmInitialized = await initializeLLM();
        } catch (error) {
            console.error('Failed to initialize LLM:', error.message);
        }

        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            console.log(`LLM Status: ${llmInitialized ? 'Available' : 'Running in fallback mode'}`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
};

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

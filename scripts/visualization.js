// Canvas setup for workflow visualization
const canvas = document.getElementById('workflowCanvas');
if (!canvas) {
    console.error('Canvas element not found!');
    throw new Error('Canvas element not found');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
    console.error('Could not get canvas context!');
    throw new Error('Could not get canvas context');
}
let scale = 1;

let nodes = [];
let edges = [];
let isDragging = false;
let selectedNode = null;
let offset = { x: 0, y: 0 };

// Add these variables at the top with other declarations
let isDrawingRequested = false;
let lastDrawTime = 0;
const FRAME_RATE = 60;
const FRAME_INTERVAL = 1000 / FRAME_RATE;

// Set canvas size
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container ? container.clientWidth : window.innerWidth;
    canvas.height = container ? container.clientHeight : 400; // Set a default height
    console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
    drawWorkflow(); // Redraw after resize
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Make zoom functions globally accessible
window.zoomIn = function() {
    scale *= 1.2;
    drawWorkflow();
};

window.zoomOut = function() {
    scale *= 0.8;
    drawWorkflow();
};

window.resetView = function() {
    scale = 1;
    drawWorkflow();
};

// Add default data
const defaultData = {
    nodes: ['Start', 'Process', 'End'],
    edges: [
        { source: 'Start', target: 'Process' },
        { source: 'Process', target: 'End' }
    ]
};

// Make updateVisualization globally accessible
window.updateVisualization = function(data) {
    console.log('Updating visualization with data:', data);
    try {
        // Validate input data
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            throw new Error('Invalid data format');
        }

        // Store the data globally to prevent reset
        window.currentVisualizationData = data;

        // Reset canvas state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Reset existing data
        nodes = [];
        edges = [];
        
        // Add safety checks and limit data size
        const maxNodes = 500;
        if (data.nodes.length > maxNodes) {
            console.warn(`Large dataset detected. Limiting to ${maxNodes} nodes.`);
            data.nodes = data.nodes.slice(0, maxNodes);
            data.edges = data.edges.filter(edge => 
                data.nodes.includes(edge.source) && data.nodes.includes(edge.target)
            );
        }

        // Create nodes with improved positioning
        const spacing = Math.min(
            canvas.width / (2 * Math.sqrt(data.nodes.length)),
            canvas.height / (2 * Math.sqrt(data.nodes.length))
        );
        
        const columns = Math.ceil(Math.sqrt(data.nodes.length));
        nodes = data.nodes.map((node, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            return {
                id: String(node),
                x: (col * spacing * 2) + spacing,
                y: (row * spacing * 2) + spacing,
                radius: Math.max(20, Math.min(30, 200 / Math.sqrt(data.nodes.length)))
            };
        });
        
        edges = data.edges;
        
        // Reset view and scale to fit
        scale = Math.min(
            canvas.width / ((columns + 1) * spacing * 2),
            canvas.height / ((Math.ceil(nodes.length / columns) + 1) * spacing * 2)
        );
        
        drawWorkflow();
        
        console.log('Visualization updated successfully');
    } catch (error) {
        console.error('Visualization update error:', error);
    }
};

// Update canvas setup with better error handling
function initCanvas() {
    const canvas = document.getElementById('workflowCanvas');
    if (!canvas) {
        console.error('Canvas element not found, deferring initialization');
        return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get canvas context');
        return null;
    }

    // Ensure proper dimensions
    const container = canvas.parentElement;
    if (container) {
        canvas.width = container.clientWidth;
        canvas.height = Math.max(400, container.clientHeight);
    }

    return { canvas, ctx };
}

// Update the window.initializeVisualization function
window.initializeVisualization = function() {
    try {
        const setup = initCanvas();
        if (!setup) {
            console.log('Deferring visualization initialization');
            return;
        }

        // Only initialize with default data if no current data exists
        if (!window.currentVisualizationData && document.querySelector('.page.active#visualization')) {
            updateVisualization(defaultData);
        } else if (window.currentVisualizationData) {
            updateVisualization(window.currentVisualizationData);
        }
    } catch (error) {
        console.error('Visualization initialization error:', error);
    }
};

// Replace the drawWorkflow function
function drawWorkflow() {
    if (isDrawingRequested) return;
    
    isDrawingRequested = true;
    requestAnimationFrame(() => {
        const now = performance.now();
        if (now - lastDrawTime < FRAME_INTERVAL) {
            isDrawingRequested = false;
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(scale, scale);

        // Draw edges with optimization
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        edges.forEach(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode) {
                ctx.moveTo(sourceNode.x, sourceNode.y);
                ctx.lineTo(targetNode.x, targetNode.y);
            }
        });
        ctx.stroke();

        // Draw nodes with batch processing
        nodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = selectedNode === node ? '#e74c3c' : '#3498db';
            ctx.fill();
        });

        // Draw node labels in a separate pass
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        nodes.forEach(node => {
            ctx.fillText(node.id, node.x, node.y);
        });

        ctx.restore();
        lastDrawTime = now;
        isDrawingRequested = false;
    });
}

// Optimize node detection
function findNodeUnderCursor(x, y) {
    // Reverse loop for top-most node detection
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < node.radius * node.radius) {
            return node;
        }
    }
    return null;
}

// Update mouse event handlers
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const node = findNodeUnderCursor(x, y);
    if (node) {
        selectedNode = node;
        isDragging = true;
        offset.x = x - node.x;
        offset.y = y - node.y;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging && selectedNode) {
        const rect = canvas.getBoundingClientRect();
        selectedNode.x = (e.clientX - rect.left) / scale - offset.x;
        selectedNode.y = (e.clientY - rect.top) / scale - offset.y;
        drawWorkflow();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    selectedNode = null;
});

// Add canvas styling
canvas.style.border = '1px solid #ccc';
canvas.style.background = '#ffffff';

// Initial draw
drawWorkflow();

// Remove the load event listener and direct initialization
window.addEventListener('load', () => {
    if (document.querySelector('.page.active#visualization')) {
        window.initializeVisualization();
    }
});
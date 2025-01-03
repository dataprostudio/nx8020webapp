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

// Add new node type tracking
const nodeTypes = {
    MAIN: 'main',
    SUB: 'sub'
};

// Add node state tracking
let expandedNodes = new Set();

// Add GPU detection and optimization
const gpuInfo = {
    supported: 'gpu' in navigator,
    preferCanvas: false
};

// Add process visibility thresholds
const visibilityConfig = {
    maxVisibleNodes: 30,
    maxVisibleEdges: 50,
    minNodeSize: 20,
    maxNodeSize: 40
};

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

        // Identify main processes and subprocesses
        const mainProcesses = data.nodes.filter(node => 
            data.edges.some(edge => edge.source === node || edge.target === node)
        );

        nodes = mainProcesses.map(process => {
            const node = createNode(process, nodeTypes.MAIN);
            
            // Find subprocesses connected only to this main process
            const subprocesses = data.nodes.filter(subProc => 
                !mainProcesses.includes(subProc) &&
                data.edges.some(edge => 
                    (edge.source === process && edge.target === subProc) ||
                    (edge.source === subProc && edge.target === process)
                )
            );
            
            node.subprocesses = subprocesses.map(sub => ({
                ...createNode(sub, nodeTypes.SUB),
                parentId: node.id
            }));

            return node;
        });

        // Update edges to include only visible connections
        edges = data.edges.filter(edge => 
            nodes.some(n => n.id === edge.source || n.id === edge.target)
        );

        // Reset view and scale to fit
        const spacing = Math.min(
            canvas.width / (2 * Math.sqrt(nodes.length)),
            canvas.height / (2 * Math.sqrt(nodes.length))
        );
        
        const columns = Math.ceil(Math.sqrt(nodes.length));
        nodes.forEach((node, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            node.x = (col * spacing * 2) + spacing;
            node.y = (row * spacing * 2) + spacing;
        });
        
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

// Update canvas setup with better error handling and GPU optimization
function initCanvas() {
    const canvas = document.getElementById('workflowCanvas');
    if (!canvas) {
        console.error('Canvas element not found, deferring initialization');
        return null;
    }

    let ctx;
    if (gpuInfo.supported && !gpuInfo.preferCanvas) {
        ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false
        });
    } else {
        ctx = canvas.getContext('2d');
    }

    if (!ctx) {
        console.error('Could not get canvas context');
        return null;
    }

    // Enable hardware acceleration hints
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
        ctx.imageSmoothingQuality = 'low';
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

        // Update visibility before drawing
        updateNodeVisibility();

        // Draw edges with visibility check
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        edges.forEach(edge => {
            if (!edge.visible) return;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode && 
                (sourceNode.type === nodeTypes.MAIN || expandedNodes.has(sourceNode.id)) &&
                (targetNode.type === nodeTypes.MAIN || expandedNodes.has(targetNode.id))) {
                ctx.moveTo(sourceNode.x, sourceNode.y);
                ctx.lineTo(targetNode.x, targetNode.y);
            }
        });
        ctx.stroke();

        // Draw nodes with type-specific styling
        nodes.forEach(node => {
            if (!node.visible) return;
            if (node.type === nodeTypes.MAIN || expandedNodes.has(node.parentId)) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                
                // Style based on node type
                if (node.type === nodeTypes.MAIN) {
                    ctx.fillStyle = selectedNode === node ? '#e74c3c' : '#3498db';
                } else {
                    ctx.fillStyle = selectedNode === node ? '#e67e22' : '#95a5a6';
                }
                
                ctx.fill();

                // Add expansion indicator for main processes with subprocesses
                if (node.type === nodeTypes.MAIN && node.subprocesses.length > 0) {
                    const isExpanded = expandedNodes.has(node.id);
                    drawExpandIndicator(node, isExpanded);
                }
            }
        });

        // Draw node labels in a separate pass
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        nodes.forEach(node => {
            if (!node.visible) return;
            ctx.fillText(node.id, node.x, node.y);
        });

        ctx.restore();
        lastDrawTime = now;
        isDrawingRequested = false;
    });
}

// Add expansion indicator drawing
function drawExpandIndicator(node, isExpanded) {
    ctx.save();
    ctx.translate(node.x + node.radius - 10, node.y - node.radius + 10);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (isExpanded) {
        ctx.moveTo(-4, -2);
        ctx.lineTo(4, -2);
        ctx.lineTo(0, 2);
    } else {
        ctx.moveTo(-2, -4);
        ctx.lineTo(-2, 4);
        ctx.lineTo(2, 0);
    }
    ctx.fill();
    ctx.restore();
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

// Update node click handling
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const node = findNodeUnderCursor(x, y);
    if (node && node.type === nodeTypes.MAIN && node.subprocesses.length > 0) {
        if (expandedNodes.has(node.id)) {
            expandedNodes.delete(node.id);
        } else {
            expandedNodes.add(node.id);
        }
        drawWorkflow();
    }
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

// Modify node creation to include type and collapsed state with visibility rules
function createNode(id, type = nodeTypes.MAIN) {
    return {
        id: String(id),
        type: type,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: type === nodeTypes.MAIN ? 
            visibilityConfig.maxNodeSize : 
            visibilityConfig.minNodeSize,
        isCollapsed: true,
        subprocesses: [],
        visible: true
    };
}

// Add visibility management
function updateNodeVisibility() {
    if (!nodes || nodes.length === 0) return;

    // Sort nodes by importance (e.g., number of connections)
    const nodeConnections = nodes.map(node => ({
        node,
        connections: edges.filter(e => 
            e.source === node.id || e.target === node.id
        ).length
    })).sort((a, b) => b.connections - a.connections);

    // Show only the most important nodes
    nodeConnections.forEach((item, index) => {
        item.node.visible = index < visibilityConfig.maxVisibleNodes;
    });

    // Update edges visibility based on visible nodes
    edges.forEach(edge => {
        edge.visible = nodes.find(n => n.id === edge.source)?.visible &&
                      nodes.find(n => n.id === edge.target)?.visible;
    });
}
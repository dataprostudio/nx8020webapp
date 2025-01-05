const defaultData = {
    nodes: [
        'Start', 'Process A', 'Process B', 'Process C', 'End'
    ].map(id => ({ id })),
    edges: [
        { source: 'Start', target: 'Process A' },
        { source: 'Process A', target: 'Process B' },
        { source: 'Process B', target: 'Process C' },
        { source: 'Process C', target: 'End' }
    ]
};

class WorkflowVisualizer {
    constructor(canvasId) {
        console.log('Initializing WorkflowVisualizer');
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found!');
            throw new Error('Canvas element not found');
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Could not get canvas context!');
            throw new Error('Could not get canvas context');
        }

        this.scale = 1;
        this.nodes = [];
        this.edges = [];
        this.isDragging = false;
        this.selectedNode = null;
        this.offset = { x: 0, y: 0 };
        this.isDrawingRequested = false;
        this.lastDrawTime = 0;
        this.FRAME_RATE = 60;
        this.FRAME_INTERVAL = 1000 / this.FRAME_RATE;
        this.nodeTypes = {
            MAIN: 'main',
            SUB: 'sub'
        };
        this.expandedNodes = new Set();
        this.gpuInfo = {
            supported: 'gpu' in navigator,
            preferCanvas: false
        };
        this.visibilityConfig = {
            maxVisibleNodes: 30,
            maxVisibleEdges: 50,
            minNodeSize: 20,
            maxNodeSize: 40
        };

        // Remove multiple initialization calls
        this.setupCanvas();
        this.bindEvents();
        
        // Single initialization point
        console.log('Setting up initial visualization');
        this.resizeCanvas(true);
        this.updateVisualization(defaultData);

        // Debug logging
        console.log('Canvas dimensions:', {
            width: this.canvas.width,
            height: this.canvas.height,
            style: {
                width: this.canvas.style.width,
                height: this.canvas.style.height
            }
        });

        this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
        this.resizeObserver.observe(this.canvas.parentElement);
    }

    // Add new method
    initWithDefaultData() {
        const defaultData = {
            nodes: [
                { id: 'Start', type: 'main', x: 100, y: 200 },
                { id: 'Process A', type: 'main', x: 300, y: 200 },
                { id: 'Process B', type: 'main', x: 500, y: 200 },
                { id: 'Process C', type: 'main', x: 700, y: 200 },
                { id: 'End', type: 'main', x: 900, y: 200 }
            ],
            edges: [
                { source: 'Start', target: 'Process A' },
                { source: 'Process A', target: 'Process B' },
                { source: 'Process B', target: 'Process C' },
                { source: 'Process C', target: 'End' }
            ]
        };
        this.updateVisualization(defaultData);
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas(force = false) {
        const container = this.canvas.parentElement;
        if (!container) {
            console.warn('No container found for canvas');
            return;
        }

        const rect = container.getBoundingClientRect();
        const newWidth = Math.floor(rect.width);
        const newHeight = Math.floor(rect.height);

        console.log('Resizing canvas:', { newWidth, newHeight });

        if (force || this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            
            // Ensure style dimensions match
            this.canvas.style.width = `${newWidth}px`;
            this.canvas.style.height = `${newHeight}px`;
            
            console.log('Canvas resized:', {
                width: this.canvas.width,
                height: this.canvas.height
            });

            this.draw();
        }
    }

    bindEvents() {
        document.getElementById('zoomInButton')?.addEventListener('click', () => this.zoom(1.1));
        document.getElementById('zoomOutButton')?.addEventListener('click', () => this.zoom(0.9));
        document.getElementById('resetButton')?.addEventListener('click', () => this.reset());

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;

            const node = this.findNodeUnderCursor(x, y);
            if (node) {
                this.selectedNode = node;
                this.isDragging = true;
                this.offset.x = x - node.x;
                this.offset.y = y - node.y;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.selectedNode) {
                const rect = this.canvas.getBoundingClientRect();
                this.selectedNode.x = (e.clientX - rect.left) / this.scale - this.offset.x;
                this.selectedNode.y = (e.clientY - rect.top) / this.scale - this.offset.y;
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.selectedNode = null;
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;

            const node = this.findNodeUnderCursor(x, y);
            if (node && node.type === this.nodeTypes.MAIN && node.subprocesses.length > 0) {
                if (this.expandedNodes.has(node.id)) {
                    this.expandedNodes.delete(node.id);
                } else {
                    this.expandedNodes.add(node.id);
                }
                this.draw();
            }
        });
    }

    zoom(factor) {
        this.scale *= factor;
        this.draw();
    }

    reset() {
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.draw();
    }

    draw() {
        if (!this.ctx || !this.canvas) {
            console.error('Canvas context not available');
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);

        console.log('Drawing:', {
            nodes: this.nodes.length,
            edges: this.edges.length,
            scale: this.scale
        });

        // Draw edges
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#666';
        this.ctx.lineWidth = 2;
        this.edges.forEach(edge => {
            const source = this.nodes.find(n => n.id === edge.source);
            const target = this.nodes.find(n => n.id === edge.target);
            if (source && target) {
                this.ctx.moveTo(source.x, source.y);
                this.ctx.lineTo(target.x, target.y);
            }
        });
        this.ctx.stroke();

        // Draw nodes
        this.nodes.forEach(node => {
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
            this.ctx.fillStyle = node === this.selectedNode ? '#e74c3c' : '#3498db';
            this.ctx.fill();

            // Draw node labels
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(node.id, node.x, node.y);
        });

        this.ctx.restore();
    }

    drawExpandIndicator(node, isExpanded) {
        this.ctx.save();
        this.ctx.translate(node.x + node.radius - 10, node.y - node.radius + 10);
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        if (isExpanded) {
            this.ctx.moveTo(-4, -2);
            this.ctx.lineTo(4, -2);
            this.ctx.lineTo(0, 2);
        } else {
            this.ctx.moveTo(-2, -4);
            this.ctx.lineTo(-2, 4);
            this.ctx.lineTo(2, 0);
        }
        this.ctx.fill();
        this.ctx.restore();
    }

    findNodeUnderCursor(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy < node.radius * node.radius) {
                return node;
            }
        }
        return null;
    }

    createNode(id, type = this.nodeTypes.MAIN) {
        return {
            id: String(id),
            type: type,
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            radius: type === this.nodeTypes.MAIN ?
                this.visibilityConfig.maxNodeSize :
                this.visibilityConfig.minNodeSize,
            isCollapsed: true,
            subprocesses: [],
            visible: true
        };
    }

    updateNodeVisibility() {
        if (!this.nodes || this.nodes.length === 0) return;

        const nodeConnections = this.nodes.map(node => ({
            node,
            connections: this.edges.filter(e =>
                e.source === node.id || e.target === node.id
            ).length
        })).sort((a, b) => b.connections - a.connections);

        nodeConnections.forEach((item, index) => {
            item.node.visible = index < this.visibilityConfig.maxVisibleNodes;
        });

        this.edges.forEach(edge => {
            edge.visible = this.nodes.find(n => n.id === edge.source)?.visible &&
                this.nodes.find(n => n.id === edge.target)?.visible;
        });
    }

    initCanvas() {
        if (!this.canvas || !this.ctx) {
            console.error('Canvas initialization failed');
            return false;
        }

        // Initialize with default data if no data is present
        if (!window.currentVisualizationData) {
            this.updateVisualization(defaultData);
        }

        return true;
    }

    updateVisualization(data) {
        console.log('Updating visualization with data:', data);
        
        if (!data || !data.nodes || !data.edges) {
            console.warn('Invalid data, using default');
            data = defaultData;
        }

        this.nodes = data.nodes.map(node => ({
            ...this.createNode(node.id || node, node.type || 'main'),
            x: node.x || Math.random() * this.canvas.width * 0.8 + this.canvas.width * 0.1,
            y: node.y || Math.random() * this.canvas.height * 0.8 + this.canvas.height * 0.1
        }));

        this.edges = data.edges;
        
        console.log('Nodes positioned:', this.nodes);
        
        requestAnimationFrame(() => this.draw());
    }
}

// Move initialization to immediate execution
console.log('Setting up visualization initialization');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualizer);
} else {
    initVisualizer();
}

function initVisualizer() {
    console.log('Initializing visualizer');
    const canvas = document.getElementById('workflowCanvas');
    if (!canvas) {
        console.error('Workflow canvas not found');
        return;
    }

    try {
        const visualizer = new WorkflowVisualizer('workflowCanvas');
        window.workflowVisualizer = visualizer;

        // Force initial render
        visualizer.updateVisualization(defaultData);
        
        // Handle tab visibility
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active') && 
                    mutation.target.id === 'visualization') {
                    visualizer.resizeCanvas(true);
                }
            });
        });

        const visualizationPage = document.getElementById('visualization');
        if (visualizationPage) {
            observer.observe(visualizationPage, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    } catch (error) {
        console.error('Failed to initialize visualizer:', error);
    }
}
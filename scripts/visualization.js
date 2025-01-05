const defaultData = {
    nodes: [
        { id: 'Start', metrics: { duration: 0.5, cost: 100 } },
        { id: 'Process A', metrics: { duration: 2.5, cost: 1200 } },
        { id: 'Process B', metrics: { duration: 1.5, cost: 800 } },
        { id: 'Process C', metrics: { duration: 3.0, cost: 1500 } },
        { id: 'End', metrics: { duration: 0.3, cost: 50 } }
    ].map(node => ({ ...node, type: 'main' })),
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

        // Add subprocess tracking
        this.subprocesses = new Map();
        this.activeNode = null;
        this.showingSubprocesses = false;
        
        // Initialize with centered positions
        this.centerNodes();

        // Add resize observer for the canvas container
        const container = this.canvas.parentElement;
        if (container) {
            this.resizeObserver = new ResizeObserver(() => {
                this.resizeCanvas(true);
                this.draw();
            });
            this.resizeObserver.observe(container);
        }

        // Initialize with default data
        this.initWithDefaultData();
        
        // Initialize with default data immediately
        this.setDefaultData();
        this.resizeCanvas(true);
        this.centerNodes();
        requestAnimationFrame(() => this.draw());

        // Add pan state
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.panOffset = { x: 0, y: 0 };

        // Initialize with spread-out default positions
        this.defaultData = {
            nodes: [
                { id: 'Start', x: 100, y: 200 },
                { id: 'Process A', x: 300, y: 200 },
                { id: 'Process B', x: 500, y: 200 },
                { id: 'Process C', x: 700, y: 200 },
                { id: 'End', x: 900, y: 200 }
            ],
            edges: [
                { source: 'Start', target: 'Process A' },
                { source: 'Process A', target: 'Process B' },
                { source: 'Process B', target: 'Process C' },
                { source: 'Process C', target: 'End' }
            ]
        };

        // Add predefined nodes with specific positions
        this.defaultData = {
            nodes: [
                { id: 'Start', type: 'main', x: 100, y: 200 },
                { id: 'Document Review', type: 'main', x: 300, y: 200 },
                { id: 'Approval', type: 'main', x: 500, y: 200 },
                { id: 'Data Validation', type: 'main', x: 500, y: 400 },
                { id: 'Quality Check', type: 'main', x: 700, y: 200 },
                { id: 'End', type: 'main', x: 900, y: 200 }
            ],
            edges: [
                { source: 'Start', target: 'Document Review' },
                { source: 'Document Review', target: 'Approval' },
                { source: 'Approval', target: 'Quality Check' },
                { source: 'Approval', target: 'Data Validation' },
                { source: 'Data Validation', target: 'Quality Check' },
                { source: 'Quality Check', target: 'End' }
            ]
        };

        // Set initial data immediately
        this.updateVisualization(this.defaultData);
        
        // Force initial render after a short delay to ensure canvas is ready
        setTimeout(() => {
            this.resizeCanvas(true);
            this.centerNodes();
            this.draw();
        }, 100);

        // Add bottleneck threshold configurations
        this.bottleneckConfig = {
            durationThreshold: 2.0, // days
            costThreshold: 1000,    // arbitrary cost unit
            highlightColor: '#e74c3c'
        };

        // Initialize with fixed sample nodes for testing
        this.defaultData = {
            nodes: [
                { 
                    id: 'Start', 
                    type: 'main',
                    x: 100,
                    y: 200,
                    metrics: { duration: 0.5, cost: 100 }
                },
                { 
                    id: 'Document Review', 
                    type: 'main',
                    x: 300,
                    y: 200,
                    metrics: { duration: 2.5, cost: 1200 }
                },
                { 
                    id: 'Approval', 
                    type: 'main',
                    x: 500,
                    y: 200,
                    metrics: { duration: 3.0, cost: 1500 }
                },
                { 
                    id: 'Data Validation', 
                    type: 'main',
                    x: 500,
                    y: 400,
                    metrics: { duration: 1.8, cost: 900 }
                },
                { 
                    id: 'Quality Check', 
                    type: 'main',
                    x: 700,
                    y: 200,
                    metrics: { duration: 2.2, cost: 1100 }
                },
                { 
                    id: 'End', 
                    type: 'main',
                    x: 900,
                    y: 200,
                    metrics: { duration: 0.3, cost: 50 }
                }
            ],
            edges: [
                { source: 'Start', target: 'Document Review' },
                { source: 'Document Review', target: 'Approval' },
                { source: 'Approval', target: 'Quality Check' },
                { source: 'Approval', target: 'Data Validation' },
                { source: 'Data Validation', target: 'Quality Check' },
                { source: 'Quality Check', target: 'End' }
            ]
        };

        // Initialize immediately with default data
        this.updateVisualization(this.defaultData);
        
        // Force initial render
        requestAnimationFrame(() => {
            this.resizeCanvas(true);
            this.centerNodes();
            this.draw();
        });

        // Add this debug log
        console.log('Constructor - canvas dimensions:', {
            width: this.canvas.width,
            height: this.canvas.height
        });

        // Initialize with sample data immediately in constructor
        this.sampleData = {
            nodes: [
                { 
                    id: 'Start',
                    type: 'main',
                    x: 100,
                    y: 200,
                    metrics: { duration: 0.5, cost: 100 }
                },
                { 
                    id: 'Document Review',
                    type: 'main',
                    x: 300,
                    y: 200,
                    metrics: { duration: 2.5, cost: 1200 }
                },
                { 
                    id: 'Approval',
                    type: 'main',
                    x: 500,
                    y: 200,
                    metrics: { duration: 1.5, cost: 800 }
                },
                { 
                    id: 'End',
                    type: 'main',
                    x: 700,
                    y: 200,
                    metrics: { duration: 0.3, cost: 50 }
                }
            ],
            edges: [
                { source: 'Start', target: 'Document Review' },
                { source: 'Document Review', target: 'Approval' },
                { source: 'Approval', target: 'End' }
            ]
        };

        // Initialize with sample data immediately
        this.updateVisualization(this.sampleData);
        
        // Force initial render
        requestAnimationFrame(() => {
            this.resizeCanvas(true);
            this.centerNodes();
            this.draw();
        });
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

    setDefaultData() {
        console.log('Setting default data');
        // Create default nodes with specific positions
        const defaultNodes = [
            { id: 'Start', type: 'main', x: 100, y: 200 },
            { id: 'Process A', type: 'main', x: 300, y: 200 },
            { id: 'Process B', type: 'main', x: 500, y: 200 },
            { id: 'Process C', type: 'main', x: 700, y: 200 },
            { id: 'End', type: 'main', x: 900, y: 200 }
        ];

        console.log('Default nodes:', defaultNodes);

        const defaultEdges = [
            { source: 'Start', target: 'Process A' },
            { source: 'Process A', target: 'Process B' },
            { source: 'Process B', target: 'Process C' },
            { source: 'Process C', target: 'End' }
        ];

        // Initialize nodes with proper properties
        this.nodes = defaultNodes.map(node => ({
            ...node,
            radius: node.type === 'main' ? 30 : 20,
            visible: true,
            isCollapsed: true,
            subprocesses: []
        }));

        // Initialize edges
        this.edges = defaultEdges;

        // Add sample subprocesses
        this.subprocesses = new Map();
        this.nodes.forEach(node => {
            if (node.type === 'main') {
                const subs = [
                    { id: `${node.id} Sub 1`, parentId: node.id },
                    { id: `${node.id} Sub 2`, parentId: node.id }
                ];
                this.subprocesses.set(node.id, subs);
            }
        });

        // Center the visualization
        this.centerNodes();
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const node = this.findNodeUnderCursor(x, y);
            
            if (node) {
                this.selectedNode = node;
                this.isDragging = true;
                // Calculate offset in scaled coordinates
                this.offset.x = (x - this.panOffset.x) / this.scale - node.x;
                this.offset.y = (y - this.panOffset.y) / this.scale - node.y;
            } else {
                // Start panning
                this.isPanning = true;
                this.panStart = {
                    x: e.clientX - this.panOffset.x,
                    y: e.clientY - this.panOffset.y
                };
                this.canvas.style.cursor = 'grabbing';
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging && this.selectedNode) {
                const rect = this.canvas.getBoundingClientRect();
                // Update node position accounting for scale and pan
                this.selectedNode.x = ((e.clientX - rect.left - this.panOffset.x) / this.scale) - this.offset.x;
                this.selectedNode.y = ((e.clientY - rect.top - this.panOffset.y) / this.scale) - this.offset.y;
                this.draw();
            } else if (this.isPanning) {
                this.panOffset = {
                    x: e.clientX - this.panStart.x,
                    y: e.clientY - this.panStart.y
                };
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isPanning = false;
            this.selectedNode = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.isPanning = false;
            this.selectedNode = null;
            this.canvas.style.cursor = 'default';
        });

        // Add mouse wheel zoom handling
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Determine zoom direction and factor
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

            // Zoom centered on mouse position
            this.zoom(zoomFactor, mouseX, mouseY);
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.scale;
            const y = (e.clientY - rect.top) / this.scale;

            const clickedNode = this.findNodeUnderCursor(x, y);
            
            if (clickedNode && clickedNode.type === 'main') {
                if (this.activeNode === clickedNode) {
                    // Toggle subprocesses
                    this.showingSubprocesses = !this.showingSubprocesses;
                } else {
                    // Select new node
                    this.activeNode = clickedNode;
                    this.showingSubprocesses = true;
                }
                this.draw();
            } else if (!clickedNode) {
                // Click outside - reset view
                this.activeNode = null;
                this.showingSubprocesses = false;
                this.draw();
            }
        });
    }

    zoom(factor, centerX = null, centerY = null) {
        const oldScale = this.scale;
        const newScale = this.scale * factor;

        // Limit zoom level between 0.1 and 5
        if (newScale < 0.1 || newScale > 5) return;

        // If no center point provided, use canvas center
        const cx = centerX ?? this.canvas.width / 2;
        const cy = centerY ?? this.canvas.height / 2;

        // Calculate how coordinates will change based on zoom
        const dx = (cx - this.panOffset.x) / oldScale;
        const dy = (cy - this.panOffset.y) / oldScale;

        // Adjust pan offset to maintain zoom center point
        this.panOffset.x = cx - dx * newScale;
        this.panOffset.y = cy - dy * newScale;
        
        // Update scale
        this.scale = newScale;
        
        this.draw();
    }

    reset() {
        this.scale = 1;
        this.panOffset = { x: 0, y: 0 };
        this.draw();
    }

    draw() {
        if (!this.ctx || !this.canvas) {
            console.error('Canvas context not available');
            return;
        }

        console.log('Drawing nodes:', this.nodes);
        console.log('Drawing with scale:', this.scale);
        console.log('Canvas dimensions:', {
            width: this.canvas.width,
            height: this.canvas.height
        });

        // Clear the entire canvas using actual canvas dimensions
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save the context state
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.scale, this.scale);

        // Draw edges first
        this.edges.forEach(edge => {
            const source = this.nodes.find(n => n.id === edge.source);
            const target = this.nodes.find(n => n.id === edge.target);
            if (source && target) {
                this.drawEdge(source, target);
            }
        });

        // Draw nodes
        this.nodes.forEach(node => {
            this.drawNode(node);
        });

        // Draw subprocesses if needed
        if (this.showingSubprocesses && this.activeNode) {
            const subprocesses = this.subprocesses.get(this.activeNode.id) || [];
            subprocesses.forEach(subprocess => {
                this.drawSubprocess(subprocess);
            });
        }

        // Restore the context state
        this.ctx.restore();
    }

    drawNode(node) {
        const radius = node.type === 'main' ? 30 : 20;
        
        // Draw bottleneck indicator if applicable
        if (node.metrics && (
            node.metrics.duration > this.bottleneckConfig.durationThreshold ||
            node.metrics.cost > this.bottleneckConfig.costThreshold
        )) {
            // Draw outer glow for bottleneck
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
            this.ctx.fill();
            
            // Draw outer ring
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius + 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = this.bottleneckConfig.highlightColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Draw node circle
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = node === this.activeNode ? '#e74c3c' : 
                            node.type === 'main' ? '#3498db' : '#95a5a6';
        this.ctx.fill();

        // Draw node label
        this.ctx.fillStyle = 'white';
        this.ctx.font = `${node.type === 'main' ? '14px' : '12px'} Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id, node.x, node.y);

        // Draw subprocess indicator if node has subprocesses
        if (node.type === 'main' && this.subprocesses.get(node.id)?.length > 0) {
            this.ctx.beginPath();
            this.ctx.arc(node.x + radius - 8, node.y - radius + 8, 8, 0, Math.PI * 2);
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.fill();
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText('+', node.x + radius - 8, node.y - radius + 8);
        }
    }

    drawSubprocess(subprocess) {
        const parent = this.nodes.find(n => n.id === subprocess.parentId);
        if (!parent) return;

        // Position subprocess below the parent node
        const angle = Math.PI / 2; // Point downward
        const distance = 80; // Reduced distance
        const x = parent.x;
        const y = parent.y + distance;

        // Draw connection line
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.setLineDash([5, 5]);
        this.ctx.moveTo(parent.x, parent.y + parent.radius);
        this.ctx.lineTo(x, y - 20); // Connect to top of subprocess
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw subprocess node
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fillStyle = '#95a5a6';
        this.ctx.fill();

        // Draw label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(subprocess.id, x, y);
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
        // Convert screen coordinates to world coordinates
        const worldX = (x - this.panOffset.x) / this.scale;
        const worldY = (y - this.panOffset.y) / this.scale;

        return this.nodes.find(node => {
            const dx = worldX - node.x;
            const dy = worldY - node.y;
            return (dx * dx + dy * dy) < (node.radius * node.radius);
        });
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
        console.log('Updating visualization with data:', data);  // Debug log
        
        if (!data || !data.nodes || !data.edges) {
            console.warn('Invalid data provided, using default data');
            data = this.defaultData;
        }

        // Initialize nodes with all required properties
        this.nodes = data.nodes.map(node => ({
            id: node.id,
            type: node.type || 'main',
            x: node.x || Math.random() * this.canvas.width * 0.8 + this.canvas.width * 0.1,
            y: node.y || Math.random() * this.canvas.height * 0.8 + this.canvas.height * 0.1,
            radius: node.type === 'main' ? 30 : 20,
            visible: true,
            isCollapsed: true,
            subprocesses: node.subprocesses || [],
            metrics: {
                duration: node.metrics?.duration || 0,
                cost: node.metrics?.cost || 0
            }
        }));

        console.log('Initialized nodes:', this.nodes);  // Debug log

        // Initialize edges
        this.edges = data.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            visible: true
        }));

        console.log('Initialized edges:', this.edges);

        // Center the visualization
        this.centerNodes();
        
        // Force immediate draw
        this.draw();
    }

    centerNodes() {
        if (!this.nodes.length) return;
        
        // Calculate bounds with padding
        const padding = 50;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x - node.radius);
            maxX = Math.max(maxX, node.x + node.radius);
            minY = Math.min(minY, node.y - node.radius);
            maxY = Math.max(maxY, node.y + node.radius);
        });

        // Calculate content dimensions with padding
        const contentWidth = maxX - minX + (padding * 2);
        const contentHeight = maxY - minY + (padding * 2);

        // Calculate scale to fit content
        const scaleX = this.canvas.width / contentWidth;
        const scaleY = this.canvas.height / contentHeight;
        this.scale = Math.min(scaleX, scaleY, 1);

        // Calculate center offsets
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Set pan offset to center the content
        this.panOffset.x = (this.canvas.width / 2) - (centerX * this.scale);
        this.panOffset.y = (this.canvas.height / 2) - (centerY * this.scale);

        this.draw();
    }
    
    drawEdge(source, target) {
        if (!source || !target) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(source.x, source.y);
        this.ctx.lineTo(target.x, target.y);
        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw arrow
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6;

        const arrowX = target.x - target.radius * Math.cos(angle);
        const arrowY = target.y - target.radius * Math.sin(angle);

        this.ctx.beginPath();
        this.ctx.moveTo(
            arrowX - arrowLength * Math.cos(angle - arrowAngle),
            arrowY - arrowLength * Math.sin(angle - arrowAngle)
        );
        this.ctx.lineTo(arrowX, arrowY);
        this.ctx.lineTo(
            arrowX - arrowLength * Math.cos(angle + arrowAngle),
            arrowY - arrowLength * Math.sin(angle + arrowAngle)
        );
        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.stroke();
    }

    // Add method to add a new node
    addNode(id, type = 'main', x = null, y = null) {
        const newNode = {
            id: id,
            type: type,
            x: x || Math.random() * this.canvas.width * 0.8 + this.canvas.width * 0.1,
            y: y || Math.random() * this.canvas.height * 0.8 + this.canvas.height * 0.1,
            radius: type === 'main' ? 30 : 20,
            visible: true,
            isCollapsed: true,
            subprocesses: []
        };

        this.nodes.push(newNode);
        return newNode;
    }

    // Add method to connect nodes
    addEdge(sourceId, targetId) {
        const edge = {
            source: sourceId,
            target: targetId,
            visible: true
        };
        this.edges.push(edge);
        return edge;
    }
}

// Update the initialization function
function initVisualizer() {
    console.log('Initializing visualizer');
    try {
        const canvas = document.getElementById('workflowCanvas');
        if (!canvas) {
            console.error('Canvas element not found, retrying in 100ms');
            setTimeout(initVisualizer, 100);
            return;
        }

        // Ensure canvas has proper dimensions from its container
        const container = canvas.parentElement;
        if (container) {
            canvas.width = container.clientWidth || 800;  // Fallback width
            canvas.height = container.clientHeight || 600;  // Fallback height
            
            console.log('Canvas dimensions set:', {
                width: canvas.width,
                height: canvas.height,
                containerWidth: container.clientWidth,
                containerHeight: container.clientHeight
            });
        }

        // Only create new instance if one doesn't exist
        if (!window.workflowVisualizer) {
            window.workflowVisualizer = new WorkflowVisualizer('workflowCanvas');
            console.log('Visualizer instance created');
            
            // Force initial render
            window.workflowVisualizer.setDefaultData();
            window.workflowVisualizer.centerNodes();
            requestAnimationFrame(() => window.workflowVisualizer.draw());
        }
    } catch (error) {
        console.error('Visualizer initialization error:', error);
    }
}

// Ensure visualizer is initialized when switching to visualization tab
function ensureVisualizerInitialized() {
    if (!window.workflowVisualizer) {
        initVisualizer();
    } else {
        window.workflowVisualizer.resizeCanvas(true);
        window.workflowVisualizer.draw();
    }
}

// Export for use in main.js
window.ensureVisualizerInitialized = ensureVisualizerInitialized;

// Update the initialization timing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initVisualizer, 100));
} else {
    setTimeout(initVisualizer, 100);
}
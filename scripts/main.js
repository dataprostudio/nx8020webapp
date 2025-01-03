// Initialize immediately and add better error handling
(function() {
    try {
        // Navigation handling
        const initNavigation = () => {
            const navLinks = document.querySelectorAll('.nav-links a');
            const pages = document.querySelectorAll('.page');
            
            if (!navLinks.length || !pages.length) {
                throw new Error('Navigation elements not found');
            }

            function showPage(pageId) {
                console.log('Showing page:', pageId);
                
                pages.forEach(p => p.classList.remove('active'));
                navLinks.forEach(l => l.classList.remove('active'));

                const activePage = document.getElementById(pageId);
                const activeLink = document.querySelector(`[data-page="${pageId}"]`);

                if (!activePage || !activeLink) {
                    console.error('Page or link not found:', pageId);
                    return;
                }

                activePage.classList.add('active');
                activeLink.classList.add('active');

                // Initialize page-specific content
                if (pageId === 'visualization' && window.initializeVisualization) {
                    window.initializeVisualization();
                } else if (pageId === 'analysis') {
                    initializeAnalysis();
                }
            }

            // Handle navigation clicks
            navLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const pageId = this.getAttribute('data-page');
                    window.location.hash = pageId;
                    showPage(pageId);
                });
            });

            // Handle initial page and hash changes
            window.addEventListener('hashchange', () => {
                const pageId = window.location.hash.slice(1) || 'upload';
                showPage(pageId);
            });

            // Show initial page
            const initialPageId = window.location.hash.slice(1) || 'upload';
            showPage(initialPageId);
        };

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initNavigation);
        } else {
            initNavigation();
        }

    } catch (error) {
        console.error('Initialization error:', error);
        throw error; // Let the global handler catch it
    }
})();

// File upload handling with more debugging
const uploadButton = document.getElementById('uploadButton');
const fileInput = document.getElementById('fileInput');

if (uploadButton && fileInput) {
    console.log('Upload elements found');
    
    uploadButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent any default button behavior
        console.log('Upload button clicked');
        if (fileInput.files.length > 0) {
            console.log('File selected:', fileInput.files[0].name);
            handleFileUpload();
        } else {
            console.log('No file selected');
            alert('Please select a file first');
        }
    });

    fileInput.addEventListener('change', function(e) {
        console.log('File input changed:', this.files[0]?.name);
    });
} else {
    console.error('Upload elements not found:', {
        uploadButton: !!uploadButton,
        fileInput: !!fileInput
    });
}

// API Integration handling
const apiForm = document.getElementById('apiForm');
if (apiForm) {
    apiForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const systemType = document.getElementById('systemType').value;
        const apiKey = document.getElementById('apiKey').value;

        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        connectToSystem(systemType, apiKey);
    });
}

// Visualization controls
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
const resetButton = document.getElementById('resetButton');

if (zoomInButton) zoomInButton.addEventListener('click', () => window.zoomIn());
if (zoomOutButton) zoomOutButton.addEventListener('click', () => window.zoomOut());
if (resetButton) resetButton.addEventListener('click', () => window.resetView());

// Process Analysis initialization
const analysisPage = document.getElementById('analysis');
if (analysisPage) {
    analysisPage.addEventListener('shown', initializeAnalysis);
}

// Add tooltip handlers
const infoIcons = document.querySelectorAll('.info-icon');
const tooltips = document.querySelectorAll('.tooltip');

// Hide all tooltips when clicking anywhere on the document
document.addEventListener('click', (e) => {
    if (!e.target.classList.contains('info-icon')) {
        tooltips.forEach(tooltip => tooltip.classList.remove('show'));
    }
});

// Show tooltip on info icon click
infoIcons.forEach(icon => {
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const tooltip = e.target.nextElementSibling;
        
        // Hide all other tooltips
        tooltips.forEach(t => {
            if (t !== tooltip) t.classList.remove('show');
        });
        
        // Toggle current tooltip
        tooltip.classList.toggle('show');
    });
});

function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    // Check file size
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        return;
    }

    // Check file type
    const allowedTypes = [
        'text/csv',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a CSV, TXT, or Excel file.');
        return;
    }

    // Create FormData
    const formData = new FormData();
    formData.append('file', file);

    // Update button state
    if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
    }

    // Send request
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Upload failed');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Upload successful:', data);
        alert('File uploaded successfully!');
        
        // Process the uploaded file
        if (file.type === 'text/csv' || file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = (e) => processFileData(file);
            reader.readAsText(file);
        } else {
            handleExcelFile(file);
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
    })
    .finally(() => {
        // Reset button state
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Upload File';
        }
    });
}

async function processFileData(file) {
    try {
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function(e) {
                try {
                    const parsedData = parseTextData(e.target.result);
                    
                    // Update visualization first
                    if (window.updateVisualization) {
                        window.updateVisualization(parsedData);
                    }
                    
                    // Calculate metrics immediately
                    const cycleTime = calculateCycleTime(parsedData);
                    const variants = calculateVariants(parsedData);
                    const bottlenecks = identifyBottlenecks(parsedData);
                    
                    // Update metrics with actual values
                    const metrics = {
                        cycletime: {
                            value: parseFloat(cycleTime),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Cycle Time',
                                value: cycleTime,
                                details: `Based on ${parsedData.nodes.length} nodes and ${parsedData.edges.length} connections`
                            }]
                        },
                        variants: {
                            value: parseInt(variants),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Variants',
                                value: variants,
                                details: `Found ${findAllPaths(parsedData).length} unique process paths`
                            }]
                        },
                        bottlenecks: {
                            value: parseInt(bottlenecks),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Bottlenecks',
                                value: bottlenecks,
                                details: `Identified ${bottlenecks} potential bottlenecks`
                            }]
                        }
                    };

                    // Update the display
                    updateMetrics(metrics);
                    
                    // Then run analysis
                    const analysis = await analyzewithLLM(parsedData);
                    console.log('Analysis result:', analysis);
                    
                    resolve(parsedData);
                } catch (error) {
                    console.error('Error processing file data:', error);
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsText(file);
        });
    } catch (error) {
        console.error('Error processing file:', error);
        throw error;
    }
}

function parseTextData(data) {
    console.log('Parsing text data');
    try {
        const lines = data.split('\n').filter(line => line.trim());
        const nodes = new Set();
        const edges = [];
        
        // Process in smaller chunks for large files
        const chunkSize = 1000;
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, i + chunkSize);
            chunk.forEach(line => {
                const parts = line.trim().split(/[\s,\t]+/);
                if (parts.length >= 2) {
                    const [source, target] = parts;
                    if (source && target) {
                        nodes.add(source);
                        nodes.add(target);
                        edges.push({ source, target });
                    }
                }
            });
        }
        
        if (nodes.size === 0 || edges.length === 0) {
            throw new Error('No valid connections found in file');
        }
        
        return {
            nodes: Array.from(nodes),
            edges: edges
        };
    } catch (error) {
        console.error('Error parsing text data:', error);
        throw new Error('Failed to parse file: ' + error.message);
    }
}

function parseCSVData(data) {
    try {
        const lines = data.split(/\r?\n/).filter(line => line.trim()); // Handle different line endings and empty lines
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        const nodes = new Set();
        const edges = [];
        
        // Process all lines (including header) as potential node connections
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Handle quoted CSV values properly
            let parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
            
            // Ensure we have at least source and target
            if (parts.length >= 2) {
                const source = parts[0];
                const target = parts[1];
                
                if (source && target) {
                    nodes.add(source);
                    nodes.add(target);
                    edges.push({ source, target });
                }
            }
        }

        if (nodes.size === 0 || edges.length === 0) {
            throw new Error('No valid data found in CSV');
        }

        return {
            nodes: Array.from(nodes),
            edges: edges
        };
    } catch (error) {
        console.error('CSV parsing error:', error);
        throw new Error('Failed to parse CSV: ' + error.message);
    }
}

function processCSVData(csvData) {
    try {
        const rows = csvData.split('\n');
        const headers = rows[0].split(',');
        const data = rows.slice(1).map(row => {
            const values = row.split(',');
            const rowData = {};
            headers.forEach((header, index) => {
                rowData[header.trim()] = values[index]?.trim();
            });
            return rowData;
        });

        console.log('Processed CSV data:', data);
        // Store the data or update the visualization
    } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV file. Please check the file format.');
    }
}

function handleExcelFile(file) {
    alert('Excel file support requires additional libraries. Please use CSV format for now.');
}

function connectToSystem(systemType, apiKey) {
    console.log(`Connecting to ${systemType} with key ${apiKey}`);
    alert(`Attempting to connect to ${systemType}...`);
}

function initializeAnalysis() {
    console.log('Initializing analysis page');
    
    // Initialize with non-zero default metrics
    const defaultMetrics = {
        cycletime: { 
            value: '0.0',
            breakdowns: [
                {
                    process: 'Awaiting Data',
                    subprocess: 'No process data',
                    value: '0.0',
                    details: 'Upload data to calculate cycle time'
                }
            ]
        },
        variants: { 
            value: '0',
            breakdowns: [
                {
                    process: 'Awaiting Data',
                    subprocess: 'No process data',
                    value: '0',
                    details: 'Upload data to analyze variants'
                }
            ]
        },
        bottlenecks: { 
            value: '0',
            breakdowns: [
                {
                    process: 'Awaiting Data',
                    subprocess: 'No process data',
                    value: '0',
                    details: 'Upload data to identify bottlenecks'
                }
            ]
        }
    };

    // Update metrics display immediately
    updateMetrics(defaultMetrics);

    // Initialize click handlers for detailed view
    initializeMetricClickHandlers(defaultMetrics);
}

function initializeMetricClickHandlers(metrics) {
    const modal = document.getElementById('metricModal');
    const modalClose = document.querySelector('.modal-close');
    const modalTitle = document.getElementById('modalTitle');
    const breakdownList = document.getElementById('breakdownList');

    document.querySelectorAll('.metric-value').forEach(metric => {
        metric.addEventListener('click', async function() {
            const metricType = this.id;
            modalTitle.textContent = getMetricTitle(metricType);
            modal.style.display = 'block';

            try {
                const data = window.currentVisualizationData || { nodes: [], edges: [] };
                let content = '';

                switch(metricType) {
                    case 'cycletime':
                        content = generateCycleTimeAnalysis(data);
                        break;
                    case 'variants':
                        content = generateVariantAnalysis(data);
                        break;
                    case 'bottlenecks':
                        content = generateBottleneckAnalysis(data);
                        break;
                    default:
                        content = 'No analysis available for this metric.';
                }

                breakdownList.innerHTML = `
                    <li class="breakdown-item">
                        <div class="breakdown-details">${content}</div>
                    </li>`;
            } catch (error) {
                console.error('Error displaying metric details:', error);
                breakdownList.innerHTML = '<li class="breakdown-item">Error analyzing metric data.</li>';
            }
        });
    });

    modalClose.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function getMetricTitle(metricType) {
    switch(metricType) {
        case 'cycletime':
            return 'Cycle Time Analysis';
        case 'variants':
            return 'Process Variants Analysis';
        case 'bottlenecks':
            return 'Bottleneck Analysis';
        default:
            return 'Process Analysis';
    }
}

function generateCycleTimeAnalysis(data) {
    const cycleTime = calculateCycleTime(data);
    const paths = findAllPaths(data);
    const minPath = Math.min(...paths.map(p => p.length));
    const maxPath = Math.max(...paths.map(p => p.length));
    
    return `
        <strong>Average Cycle Time: ${cycleTime}</strong><br><br>
        Shortest Path: ${minPath} steps<br>
        Longest Path: ${maxPath} steps<br>
        Total Paths Analyzed: ${paths.length}<br><br>
        This metric indicates the average number of steps required to complete the process.
    `;
}

function generateVariantAnalysis(data) {
    const paths = findAllPaths(data);
    const variantCount = paths.length;
    const commonPaths = paths.slice(0, 3);
    
    return `
        <strong>Total Variants: ${variantCount}</strong><br><br>
        Most Common Paths:<br>
        ${commonPaths.map((path, i) => `${i + 1}. ${path.join(' → ')}`).join('<br>')}<br><br>
        ${variantCount > 3 ? `And ${variantCount - 3} more variants...` : ''}
    `;
}

function generateBottleneckAnalysis(data) {
    const incomingEdges = {};
    const processTypes = {};
    
    // Analyze each edge to categorize nodes and count connections
    data.edges.forEach(edge => {
        incomingEdges[edge.target] = (incomingEdges[edge.target] || 0) + 1;
        
        // Categorize process type based on naming conventions and connections
        if (edge.target.startsWith('=')) {
            processTypes[edge.target] = 'Merge Point';
        } else if (/^[A-Z]/.test(edge.target)) {
            processTypes[edge.target] = 'Main Process';
        } else {
            processTypes[edge.target] = 'Subprocess';
        }
    });

    const bottlenecks = Object.entries(incomingEdges)
        .filter(([_, count]) => count > 1)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 5);

    return `
        <strong>Identified Bottlenecks: ${bottlenecks.length}</strong><br><br>
        Top Bottleneck Points:<br>
        ${bottlenecks.map(([node, count]) => `
            • ${node} (${processTypes[node]})<br>
            &nbsp;&nbsp;${count} incoming connections<br>
            &nbsp;&nbsp;Impact: ${getBottleneckImpact(node, count, processTypes[node])}
        `).join('<br>')}<br><br>
        These points require attention as they represent convergence of multiple process flows.
    `;
}

function getBottleneckImpact(node, count, type) {
    if (type === 'Merge Point') {
        return 'Data consolidation point that may cause processing delays';
    } else if (count > 10) {
        return 'Critical congestion point requiring immediate review';
    } else if (count > 5) {
        return 'Moderate bottleneck with potential for queue formation';
    } else {
        return 'Minor convergence point to monitor';
    }
}

// Update metrics with better error handling
function updateMetrics(data) {
    if (!data) {
        console.error('No metric data provided');
        return;
    }

    Object.entries(data).forEach(([id, metricData]) => {
        const element = document.getElementById(id);
        if (element) {
            // Format the value appropriately
            let displayValue;
            if (typeof metricData.value === 'number') {
                displayValue = id === 'cycletime' ? 
                    metricData.value.toFixed(1) : 
                    Math.round(metricData.value).toString();
            } else {
                displayValue = metricData.value;
            }

            // Update the display immediately
            element.textContent = displayValue;
            element.style.opacity = '1'; // Ensure visibility
            
            // Store the full data for modal display
            element.setAttribute('data-metric', id);
            element.setAttribute('data-breakdowns', JSON.stringify(metricData.breakdowns));
        } else {
            console.warn(`Metric element not found: ${id}`);
        }
    });
}

// Update analyzewithLLM with better error handling and optimization
async function analyzewithLLM(data) {
    try {
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            return generateFallbackAnalysis({ nodes: [], edges: [] });
        }

        // Check server capabilities first
        try {
            const capabilitiesResponse = await fetch('/api/llm/capabilities', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            const capabilities = await capabilitiesResponse.json();
            
            if (!capabilities.gpuAvailable) {
                console.warn('Server running in CPU-only mode - using simplified analysis');
                return generateFallbackAnalysis(data);
            }
        } catch (error) {
            console.warn('Failed to check LLM capabilities:', error);
            return generateFallbackAnalysis(data);
        }

        // Limit data size more aggressively
        const truncatedData = {
            nodes: data.nodes.slice(0, 100), // Reduced from 1000
            edges: data.edges.slice(0, 200)  // Reduced from 2000
        };

        // Use debouncing to prevent multiple simultaneous requests
        if (window.analysisInProgress) {
            console.log('Analysis already in progress, using cached result');
            return window.lastAnalysisResult || generateFallbackAnalysis(truncatedData);
        }

        window.analysisInProgress = true;

        try {
            const response = await fetch('/api/llm/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({ 
                    text: JSON.stringify({
                        nodeCount: truncatedData.nodes.length,
                        edgeCount: truncatedData.edges.length,
                        connections: truncatedData.edges
                            .slice(0, 20) // Reduced from 50
                            .map(e => `${e.source}->${e.target}`)
                    })
                }),
                signal: AbortSignal.timeout(10000) // 10s timeout
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result = await response.json();
            window.lastAnalysisResult = result;
            return result;

        } catch (error) {
            console.warn('LLM analysis failed, using fallback:', error);
            return generateFallbackAnalysis(truncatedData);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        return generateFallbackAnalysis({
            nodes: [],
            edges: []
        });
    } finally {
        window.analysisInProgress = false;
    }
}

function findAllPaths(data) {
    try {
        if (!data || !data.nodes || !data.edges) return [];

        // Limit path finding to prevent excessive computation
        const maxNodes = 100;
        const truncatedData = {
            nodes: data.nodes.slice(0, maxNodes),
            edges: data.edges.filter(edge => 
                data.nodes.slice(0, maxNodes).includes(edge.source) &&
                data.nodes.slice(0, maxNodes).includes(edge.target)
            )
        };

        const startNodes = truncatedData.nodes.filter(node => 
            !truncatedData.edges.some(edge => edge.target === node)
        );
        const endNodes = truncatedData.nodes.filter(node => 
            !truncatedData.edges.some(edge => edge.source === node)
        );
        
        const paths = [];
        const maxPaths = 50;
        
        for (const start of startNodes) {
            if (paths.length >= maxPaths) break;
            
            for (const end of endNodes) {
                if (paths.length >= maxPaths) break;
                
                const path = findPath(start, end, truncatedData.edges, new Set());
                if (path) paths.push(path);
            }
        }
        
        return paths;

    } catch (error) {
        console.error('Error in findAllPaths:', error);
        return [];
    }
}

function generateFallbackAnalysis(data) {
    try {
        // Enhanced fallback analysis for CPU-only mode
        const metrics = {
            processSize: data.nodes.length,
            connectionCount: data.edges.length,
            uniqueSources: new Set(data.edges.map(e => e.source)).size,
            uniqueTargets: new Set(data.edges.map(e => e.target)).size,
            avgConnectionsPerNode: data.edges.length / (data.nodes.length || 1),
            parallelPaths: data.nodes.filter(node => 
                data.edges.filter(e => e.source === node).length > 1
            ).length
        };

        const paths = findAllPaths(data);
        const maxDepth = paths.length ? Math.max(...paths.map(p => p.length)) : 0;
        
        return `CPU Mode Analysis Results:\n` +
               `- Process Steps: ${metrics.processSize}\n` +
               `- Connections: ${metrics.connectionCount}\n` +
               `- Entry Points: ${metrics.uniqueSources}\n` +
               `- Exit Points: ${metrics.uniqueTargets}\n` +
               `- Parallel Branches: ${metrics.parallelPaths}\n` +
               `- Maximum Path Length: ${maxDepth}\n` +
               `- Average Connections per Step: ${metrics.avgConnectionsPerNode.toFixed(2)}`;
    } catch (error) {
        console.error('Error in fallback analysis:', error);
        return 'Basic Process Analysis: Unable to analyze structure. Please check input data.';
    }
}

// Add these helper functions to calculate basic metrics
function calculateCycleTime(data) {
    const paths = findAllPaths(data);
    const avgLength = paths.length > 0 ? 
        paths.reduce((sum, path) => sum + path.length, 0) / paths.length : 
        0;
    return avgLength;
}

function calculateVariants(data) {
    const paths = findAllPaths(data);
    return paths.length;
}

function identifyBottlenecks(data) {
    const incomingEdges = {};
    data.edges.forEach(edge => {
        incomingEdges[edge.target] = (incomingEdges[edge.target] || 0) + 1;
    });
    return Object.values(incomingEdges).filter(count => count > 1).length;
}

function findPath(start, end, edges, visited) {
    if (start === end) return [start];
    if (visited.has(start)) return null;
    
    visited.add(start);
    const nextEdges = edges.filter(edge => edge.source === start);
    
    for (const edge of nextEdges) {
        const path = findPath(edge.target, end, edges, new Set(visited));
        if (path) return [start, ...path];
    }
    
    return null;
}
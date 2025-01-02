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
                    
                    // Then run analysis
                    const analysis = await analyzewithLLM(parsedData);
                    
                    // Update metrics with real data
                    const metrics = {
                        cycleTime: {
                            value: calculateCycleTime(parsedData),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Cycle Time',
                                value: calculateCycleTime(parsedData),
                                details: `Based on ${parsedData.nodes.length} nodes and ${parsedData.edges.length} connections`
                            }]
                        },
                        variants: {
                            value: calculateVariants(parsedData),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Variants',
                                value: calculateVariants(parsedData),
                                details: `Found ${findAllPaths(parsedData).length} unique process paths`
                            }]
                        },
                        bottlenecks: {
                            value: identifyBottlenecks(parsedData),
                            breakdowns: [{
                                process: 'Process Analysis',
                                subprocess: 'Bottlenecks',
                                value: identifyBottlenecks(parsedData),
                                details: `Identified ${identifyBottlenecks(parsedData)} potential bottlenecks`
                            }]
                        }
                    };

                    updateMetrics(metrics);
                    
                    // Show analysis result in a less intrusive way
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
    
    // Initialize with meaningful default metrics
    const defaultMetrics = {
        cycleTime: { 
            value: '0.0',
            breakdowns: [
                {
                    process: 'Default',
                    subprocess: 'No data',
                    value: '0.0',
                    details: 'No process data available yet'
                }
            ]
        },
        variants: { 
            value: '0',
            breakdowns: [
                {
                    process: 'Default',
                    subprocess: 'No data',
                    value: '0',
                    details: 'Upload data to see process variants'
                }
            ]
        },
        bottlenecks: { 
            value: '0',
            breakdowns: [
                {
                    process: 'Default',
                    subprocess: 'No data',
                    value: '0',
                    details: 'Upload data to identify bottlenecks'
                }
            ]
        }
    };

    // Ensure metric elements exist before updating
    const metricElements = {
        cycleTime: document.getElementById('cycletime'),
        variants: document.getElementById('variants'),
        bottlenecks: document.getElementById('bottlenecks')
    };

    // Update metrics display
    Object.entries(defaultMetrics).forEach(([key, data]) => {
        const element = metricElements[key];
        if (element) {
            element.textContent = data.value;
            element.setAttribute('data-metric', key);
            element.setAttribute('data-breakdowns', JSON.stringify(data.breakdowns));
            // Make it clear it's clickable
            element.style.cursor = 'pointer';
        }
    });

    // Initialize click handlers for metrics
    initializeMetricClickHandlers(defaultMetrics);
}

function initializeMetricClickHandlers(metrics) {
    const modal = document.getElementById('metricModal');
    const modalClose = document.querySelector('.modal-close');
    const modalTitle = document.getElementById('modalTitle');
    const breakdownList = document.getElementById('breakdownList');

    if (!modal || !modalClose || !modalTitle || !breakdownList) {
        console.error('Required modal elements not found');
        return;
    }

    // Add click handlers to each metric value element
    document.querySelectorAll('.metric-value').forEach(metric => {
        metric.addEventListener('click', async function() {
            try {
                modalTitle.textContent = 'Loading analysis...';
                modal.style.display = 'block';
                breakdownList.innerHTML = '<li class="breakdown-item">Analyzing process data...</li>';

                const result = await analyzewithLLM({
                    nodes: window.currentVisualizationData?.nodes || [],
                    edges: window.currentVisualizationData?.edges || []
                });

                modalTitle.textContent = `Process Analysis Details`;
                
                if (result.fallback) {
                    // Show static analysis if LLM fails
                    const staticAnalysis = generateFallbackAnalysis(window.currentVisualizationData || { nodes: [], edges: [] });
                    breakdownList.innerHTML = `
                        <li class="breakdown-item">
                            <div class="breakdown-header">
                                <span>Static Analysis</span>
                            </div>
                            <div class="breakdown-details">${staticAnalysis.replace(/\n/g, '<br>')}</div>
                        </li>`;
                } else {
                    breakdownList.innerHTML = `
                        <li class="breakdown-item">
                            <div class="breakdown-header">
                                <span>Dynamic Analysis</span>
                            </div>
                            <div class="breakdown-details">${result.analysis}</div>
                        </li>`;
                }
            } catch (error) {
                console.error('Error displaying metric details:', error);
                modalTitle.textContent = 'Analysis Error';
                breakdownList.innerHTML = `
                    <li class="breakdown-item">
                        <div class="breakdown-details">
                            Unable to analyze process data. Using static analysis.
                            <br><br>
                            ${generateFallbackAnalysis(window.currentVisualizationData || { nodes: [], edges: [] }).replace(/\n/g, '<br>')}
                        </div>
                    </li>`;
            }
        });
    });

    // Close modal handlers
    modalClose.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
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
            element.textContent = metricData.value;
            element.setAttribute('data-metric', id);
            element.setAttribute('data-breakdowns', JSON.stringify(metricData.breakdowns));
        } else {
            console.warn(`Metric element not found: ${id}`);
        }
    });
}

async function analyzewithLLM(data) {
    try {
        // Validate input data
        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            console.warn('Invalid data structure for analysis');
            return generateFallbackAnalysis({
                nodes: [],
                edges: []
            });
        }

        // Limit data size to prevent crashes
        const truncatedData = {
            nodes: data.nodes.slice(0, 1000),
            edges: data.edges.slice(0, 2000)
        };

        // Generate basic metrics with safeguards
        const basicMetrics = {
            cycleTime: { 
                value: calculateCycleTime(truncatedData) || '0.0',
                breakdowns: []
            },
            variants: { 
                value: calculateVariants(truncatedData) || '0',
                breakdowns: []
            },
            bottlenecks: { 
                value: identifyBottlenecks(truncatedData) || '0',
                breakdowns: []
            }
        };

        // Safe update of UI metrics
        try {
            updateMetrics(basicMetrics);
        } catch (uiError) {
            console.error('Error updating metrics UI:', uiError);
        }

        // LLM analysis with timeout and error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
                            .slice(0, 50)
                            .map(e => `${e.source}->${e.target}`),
                        timestamp: Date.now()
                    })
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result.fallback ? 
                generateFallbackAnalysis(truncatedData) : 
                result.analysis;

        } catch (fetchError) {
            console.error('LLM analysis error:', fetchError);
            return generateFallbackAnalysis(truncatedData);
        }

    } catch (error) {
        console.error('Analysis error:', error);
        return generateFallbackAnalysis({
            nodes: [],
            edges: []
        });
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
    // Calculate actual process metrics
    const uniqueSources = new Set(data.edges.map(e => e.source));
    const uniqueTargets = new Set(data.edges.map(e => e.target));
    const avgConnectionsPerNode = data.edges.length / data.nodes.length;
    const hasFeedbackLoops = data.edges.some(edge => 
        data.edges.some(e2 => e2.source === edge.target && e2.target === edge.source)
    );

    return `Real-time Analysis:\n` +
           `- Process contains ${data.nodes.length} unique steps\n` +
           `- Found ${data.edges.length} distinct connections\n` +  // Fixed missing closing brace
           `- Process type: ${hasFeedbackLoops ? 'Cyclic' : 'Linear'}\n` +
           `- Start points: ${uniqueSources.size}\n` +
           `- End points: ${uniqueTargets.size}\n` +
           `- Average connections per step: ${avgConnectionsPerNode.toFixed(2)}\n` +
           `- Process complexity score: ${Math.min(10, (avgConnectionsPerNode * 2).toFixed(1))}/10`;
}

// Add these helper functions to calculate basic metrics
function calculateCycleTime(data) {
    // Simple calculation: average path length
    const paths = findAllPaths(data);
    const avgLength = paths.reduce((sum, path) => sum + path.length, 0) / paths.length;
    return avgLength.toFixed(1);
}

function calculateVariants(data) {
    // Count unique paths
    const paths = findAllPaths(data);
    return paths.length.toString();
}

function identifyBottlenecks(data) {
    // Count nodes with multiple incoming edges
    const incomingEdges = {};
    data.edges.forEach(edge => {
        incomingEdges[edge.target] = (incomingEdges[edge.target] || 0) + 1;
    });
    const bottlenecks = Object.values(incomingEdges).filter(count => count > 1).length;
    return bottlenecks.toString();
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
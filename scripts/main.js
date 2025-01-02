// Navigation handling
document.addEventListener('DOMContentLoaded', function() {
    // Set up navigation links with more debugging
    const navLinks = document.querySelectorAll('.nav-links a');
    console.log('Navigation links found:', navLinks.length);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Nav link clicked:', this.getAttribute('data-page'));
            
            // Remove active class from all links and pages
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
                console.log('Removing active from:', page.id);
            });
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show corresponding page
            const pageId = this.getAttribute('data-page');
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');
                console.log('Activated page:', pageId);
                
                // Initialize visualization when switching to visualization tab
                if (pageId === 'visualization' && window.initializeVisualization) {
                    window.initializeVisualization();
                }
                // Initialize analysis when switching to analysis tab
                if (pageId === 'analysis') {
                    initializeAnalysis();
                }
            } else {
                console.error('Could not find page:', pageId);
            }
        });
    });

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
});

function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    // Add loading indication
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Processing...';
    }

    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
        try {
            console.log('Uploading file:', file.name, 'Type:', file.type);
            processFileData(file);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file: ' + error.message);
        } finally {
            // Reset button state
            if (uploadButton) {
                uploadButton.disabled = false;
                uploadButton.textContent = 'Upload File';
            }
        }
    }, 100);
}

function processFileData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                console.log('File read completed');
                const data = e.target.result;
                let parsedData;
                
                if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
                    parsedData = parseCSVData(data);
                } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
                    parsedData = parseTextData(data);
                } else {
                    throw new Error('Unsupported file type');
                }
                
                if (!parsedData || !parsedData.nodes || !parsedData.edges) {
                    throw new Error('Invalid data format');
                }

                console.log('Parsed data:', parsedData);
                
                // Update visualization
                if (window.updateVisualization) {
                    window.updateVisualization(parsedData);
                    alert('File processed successfully');
                } else {
                    throw new Error('Visualization component not ready');
                }
                
                resolve(parsedData);
            } catch (error) {
                console.error('Error processing file:', error);
                reject(error);
            }
        };

        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            reject(new Error('Error reading file'));
        };

        reader.readAsText(file);
    });
}

function parseTextData(data) {
    console.log('Parsing text data');
    const lines = data.split('\n');
    const nodes = new Set();
    const edges = [];
    
    // Process in chunks for large files
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
    
    return {
        nodes: Array.from(nodes),
        edges: edges
    };
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
    
    // Sample data - in production, this would come from your data processing
    const metrics = {
        cycleTime: {
            value: '2.5 days',
            breakdowns: [
                {
                    process: 'Order Processing',
                    subprocess: 'Credit Check',
                    value: '0.8 days',
                    details: 'Significant delay in credit verification'
                },
                {
                    process: 'Fulfillment',
                    subprocess: 'Picking',
                    value: '1.2 days',
                    details: 'Resource constraints during peak hours'
                },
                {
                    process: 'Shipping',
                    subprocess: 'Documentation',
                    value: '0.5 days',
                    details: 'Manual processing bottleneck'
                }
            ]
        },
        variants: {
            value: '8',
            breakdowns: [
                {
                    process: 'Order Entry',
                    subprocess: 'Channel Selection',
                    value: '3 variants',
                    details: 'Multiple entry points causing process variation'
                },
                {
                    process: 'Payment Processing',
                    subprocess: 'Payment Method',
                    value: '5 variants',
                    details: 'Different payment methods leading to varied paths'
                }
            ]
        },
        bottlenecks: {
            value: '3',
            breakdowns: [
                {
                    process: 'Quality Control',
                    subprocess: 'Initial Check',
                    value: 'High Impact',
                    details: 'Limited QC staff during afternoon shift'
                },
                {
                    process: 'Packaging',
                    subprocess: 'Material Selection',
                    value: 'Medium Impact',
                    details: 'Manual decision making causing delays'
                },
                {
                    process: 'Shipping',
                    subprocess: 'Label Generation',
                    value: 'Low Impact',
                    details: 'System performance issues'
                }
            ]
        }
    };

    // Update metrics display
    updateMetrics(metrics);

    // Initialize click handlers for metric values
    initializeMetricClickHandlers(metrics);
}

function initializeMetricClickHandlers(metrics) {
    const metricValues = document.querySelectorAll('.metric-value');
    const modal = document.getElementById('metricModal');
    const modalClose = document.querySelector('.modal-close');
    const modalTitle = document.getElementById('modalTitle');
    const breakdownList = document.getElementById('breakdownList');

    metricValues.forEach(metric => {
        metric.addEventListener('click', () => {
            const metricType = metric.getAttribute('data-metric');
            if (!metrics[metricType]) return;

            modalTitle.textContent = `${toTitleCase(metricType)} Breakdown`;
            
            breakdownList.innerHTML = metrics[metricType].breakdowns.map(item => `
                <li class="breakdown-item">
                    <div class="breakdown-header">
                        <span>${item.process} > ${item.subprocess}</span>
                        <span>${item.value}</span>
                    </div>
                    <div class="breakdown-details">${item.details}</div>
                </li>
            `).join('');

            modal.style.display = 'block';
        });
    });

    // Close modal handlers
    modalClose.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function toTitleCase(str) {
    return str.replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
}

function updateMetrics(data) {
    Object.entries({
        cycletime: data.cycleTime.value,
        variants: data.variants.value,
        bottlenecks: data.bottlenecks.value
    }).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.setAttribute('data-metric', id);
        }
    });
}
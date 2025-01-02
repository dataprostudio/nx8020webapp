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
});

function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    console.log('Uploading file:', file.name, 'Type:', file.type);

    // Process file directly without server upload
    processFileData(file);
}

function processFileData(file) {
    console.log('Processing file:', file.name);
    const reader = new FileReader();
    
    reader.onload = function(e) {
        console.log('File read completed');
        const data = e.target.result;
        let parsedData;
        
        try {
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
            
            // Update visualization with slight delay to allow UI to update
            setTimeout(() => {
                if (window.updateVisualization) {
                    window.updateVisualization(parsedData);
                    alert('File processed successfully');
                } else {
                    throw new Error('Visualization component not ready');
                }
            }, 100);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file: ' + error.message);
        }
    };

    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        alert('Error reading file');
    };

    reader.readAsText(file);
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
    const lines = data.split('\n');
    const nodes = new Set();
    const edges = [];
    
    // Skip header and process in chunks
    const chunkSize = 1000;
    for (let i = 1; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, Math.min(i + chunkSize, lines.length));
        chunk.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const source = parts[0].trim();
                const target = parts[1].trim();
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
        cycleTime: '2.5 days',
        variants: '8',
        bottlenecks: '3'
    };

    // Update the metric values
    const elements = {
        cycletime: document.getElementById('cycletime'),
        variants: document.getElementById('variants'),
        bottlenecks: document.getElementById('bottlenecks')
    };

    Object.entries(elements).forEach(([key, element]) => {
        if (element && metrics[key]) {
            element.textContent = metrics[key];
            console.log(`Updated ${key} to ${metrics[key]}`);
        } else {
            console.error(`Could not update ${key} metric`);
        }
    });

    // Initialize the analysis chart if needed
    const chartCanvas = document.getElementById('analysisChart');
    if (chartCanvas) {
        // Add your chart initialization here
        console.log('Chart canvas found, ready for visualization');
    }
}

function updateMetrics(data) {
    const cycleTimeElement = document.getElementById('cycletime');
    const variantsElement = document.getElementById('variants');
    const bottlenecksElement = document.getElementById('bottlenecks');

    if (cycleTimeElement) cycleTimeElement.textContent = data.cycleTime;
    if (variantsElement) variantsElement.textContent = data.variants;
    if (bottlenecksElement) bottlenecksElement.textContent = data.bottlenecks;
}
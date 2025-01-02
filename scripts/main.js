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

    if (zoomInButton) zoomInButton.addEventListener('click', zoomIn);
    if (zoomOutButton) zoomOutButton.addEventListener('click', zoomOut);
    if (resetButton) resetButton.addEventListener('click', resetView);
});

function handleFileUpload() {
    console.log('handleFileUpload function called');
    const fileInput = document.getElementById('fileInput');
    console.log('fileInput element:', fileInput);
    console.log('files:', fileInput?.files);
    
    const file = fileInput?.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    console.log('Processing file:', file.name);

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('File read successfully');
            const fileData = e.target.result;
            processCSVData(fileData);
        };
        reader.onerror = function(e) {
            console.error('Error reading file:', e);
            alert('Error reading file');
        };
        console.log('Starting to read file...');
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
        handleExcelFile(file);
    } else {
        alert('Unsupported file type. Please upload a CSV, TXT, or XLSX file.');
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

function zoomIn() {
    console.log('Zoom in');
}

function zoomOut() {
    console.log('Zoom out');
}

function resetView() {
    console.log('Reset view');
}
// Navigation handling
document.addEventListener('DOMContentLoaded', function() {
    // Set up navigation links
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and pages
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show corresponding page
            const pageId = this.getAttribute('data-page');
            document.getElementById(pageId).classList.add('active');
        });
    });

    // Add file upload event listeners
    const uploadButton = document.querySelector('.file-upload button');
    if (uploadButton) {
        uploadButton.addEventListener('click', handleFileUpload);
    }

    // Add direct file input change listener
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            console.log('File selected:', e.target.files[0]?.name);
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

            // Handle API connection
            connectToSystem(systemType, apiKey);
        });
    }
});

// File upload handling
function handleFileUpload() {
    console.log('handleFileUpload function called');
    const fileInput = document.getElementById('fileInput');
    console.log('fileInput element:', fileInput);
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first');
        return;
    }

    // Handle different file types
    if (file.name.endsWith('.csv')) {
        // Handle CSV file
        const reader = new FileReader();
        reader.onload = function(e) {
            const csvData = e.target.result;
            processCSVData(csvData);
        };
        reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx')) {
        // Handle Excel file
        handleExcelFile(file);
    } else {
        alert('Unsupported file type. Please upload a CSV or XLSX file.');
    }
}

function processCSVData(csvData) {
    try {
        // Split the CSV data into rows
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
        // You can add your data processing logic here
    } catch (error) {
        console.error('Error processing CSV:', error);
        alert('Error processing CSV file. Please check the file format.');
    }
}

function handleExcelFile(file) {
    alert('Excel file support requires additional libraries. Please use CSV format for now.');
    // If you want to add Excel support, you can use libraries like SheetJS
    // Example implementation with SheetJS would go here
}

// API Integration handling
function connectToSystem(systemType, apiKey) {
    console.log(`Connecting to ${systemType} with key ${apiKey}`);
    // Add your API connection logic here
    // This is where you would make API calls to your backend
    alert(`Attempting to connect to ${systemType}...`);
}

// Visualization controls
function zoomIn() {
    // Add zoom in logic for the workflow visualization
    console.log('Zoom in');
}

function zoomOut() {
    // Add zoom out logic for the workflow visualization
    console.log('Zoom out');
}

function resetView() {
    // Add reset view logic for the workflow visualization
    console.log('Reset view');
}
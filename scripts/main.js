// Navigation handling
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all links and pages
        document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
        
        // Add active class to clicked link
        link.classList.add('active');
        
        // Show corresponding page
        const pageId = link.getAttribute('data-page');
        document.getElementById(pageId).classList.add('active');
    });
});

// File upload handling
function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Send to backend
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            alert('File uploaded successfully');
            // Handle the response data
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error uploading file');
        });
    }
}

// API integration form handling
document.getElementById('apiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const systemType = document.getElementById('systemType').value;
    const apiKey = document.getElementById('apiKey').value;
    
    // Send to backend
    fetch('/api/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ systemType, apiKey })
    })
    .then(response => response.json())
    .then(data => {
        alert('Successfully connected to ' + systemType);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Connection failed');
    });
});
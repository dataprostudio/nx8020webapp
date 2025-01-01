// Canvas setup for workflow visualization
const canvas = document.getElementById('workflowCanvas');
const ctx = canvas.getContext('2d');
let scale = 1;

// Set canvas size
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Zoom controls
function zoomIn() {
    scale *= 1.2;
    drawWorkflow();
}

function zoomOut() {
    scale *= 0.8;
    drawWorkflow();
}

function resetView() {
    scale = 1;
    drawWorkflow();
}

// Example workflow drawing function
function drawWorkflow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    
    // This is where you'll implement the actual workflow visualization
    // Example: Drawing a simple node
    ctx.beginPath();
    ctx.arc(100, 100, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#3498db';
    ctx.fill();
    
    ctx.restore();
}

// Initial draw
drawWorkflow();
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    function showPage(pageId) {
        // Hide all pages and remove active class
        pages.forEach(page => {
            page.style.display = 'none';
            page.classList.remove('active');
        });
        navLinks.forEach(link => link.classList.remove('active'));

        // Show selected page and activate link
        const selectedPage = document.getElementById(pageId);
        const selectedLink = document.querySelector(`[data-page="${pageId}"]`);

        if (selectedPage) {
            selectedPage.style.display = 'block';
            selectedPage.classList.add('active');
        }
        if (selectedLink) {
            selectedLink.classList.add('active');
        }

        // Handle visualization tab specifically
        if (pageId === 'visualization' && window.workflowVisualizer) {
            requestAnimationFrame(() => {
                window.workflowVisualizer.resizeCanvas(true);
                window.workflowVisualizer.draw();
            });
        }

        // Special handling for visualization tab
        if (pageId === 'visualization') {
            console.log('Switching to visualization tab');
            setTimeout(() => {
                const canvas = document.getElementById('workflowCanvas');
                if (canvas) {
                    // Ensure canvas is visible and has dimensions
                    canvas.style.display = 'block';
                    const container = canvas.parentElement;
                    if (container) {
                        canvas.width = container.clientWidth;
                        canvas.height = container.clientHeight;
                    }
                    
                    // Initialize or refresh visualizer
                    if (typeof window.ensureVisualizerInitialized === 'function') {
                        window.ensureVisualizerInitialized();
                    } else {
                        console.error('Visualizer initialization function not found');
                    }
                } else {
                    console.error('Canvas element not found');
                }
            }, 100);
        }
    }

    // Handle navigation clicks
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            showPage(pageId);
            window.location.hash = pageId;
        });
    });

    // Handle file upload
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const uploadStatus = document.getElementById('uploadStatus');

    if (fileInput && uploadButton) {
        uploadButton.addEventListener('click', async (e) => {
            e.preventDefault();

            const file = fileInput.files[0];
            if (!file) {
                alert('Please select a file first');
                return;
            }

            // Create FormData
            const formData = new FormData();
            formData.append('file', file);

            // Update button state
            uploadButton.disabled = true;
            uploadButton.textContent = 'Uploading...';

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Upload failed');
                }
                
                // Update status
                if (uploadStatus) {
                    uploadStatus.textContent = 'File uploaded successfully!';
                    uploadStatus.style.color = 'green';
                }

                // Switch to visualization tab
                showPage('visualization');

            } catch (error) {
                console.error('Upload error:', error);
                if (uploadStatus) {
                    uploadStatus.textContent = 'Upload failed: ' + error.message;
                    uploadStatus.style.color = 'red';
                }
            } finally {
                // Reset button state
                uploadButton.disabled = false;
                uploadButton.textContent = 'Upload';
            }
        });

        // Update button text when file is selected
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            const systemIndicator = document.getElementById('systemIndicator');
            
            if (file) {
                uploadButton.textContent = `Upload ${file.name}`;
                
                // Detect system based on file content/name
                let systemType = 'System';
                
                if (file.name.toLowerCase().includes('sap')) {
                    systemType = 'SAP';
                } else if (file.name.toLowerCase().includes('oracle')) {
                    systemType = 'Oracle';
                } else if (file.name.toLowerCase().includes('salesforce') || file.name.toLowerCase().includes('sfdc')) {
                    systemType = 'Salesforce';
                } else {
                    systemType = 'ERP/CRM data';
                }
                
                systemIndicator.textContent = systemType;
            }
        });
    }

    // Initialize Analysis Metrics
    const metrics = {
        cycletime: {
            value: '3.5 days',
            breakdowns: [
                { process: 'Document Review', time: '1.5 days', percentage: '43%' },
                { process: 'Approval Process', time: '1.2 days', percentage: '34%' },
                { process: 'Final Processing', time: '0.8 days', percentage: '23%' }
            ]
        },
        variants: {
            value: '12',
            breakdowns: [
                { process: 'Standard Path', count: '8', percentage: '67%' },
                { process: 'Exception Path', count: '3', percentage: '25%' },
                { process: 'Emergency Path', count: '1', percentage: '8%' }
            ]
        },
        bottlenecks: {
            value: '3',
            breakdowns: [
                { process: 'Manager Approval', impact: 'High', delay: '2.1 days' },
                { process: 'Data Validation', impact: 'Medium', delay: '1.3 days' },
                { process: 'Quality Check', impact: 'Low', delay: '0.8 days' }
            ]
        }
    };

    // Update metric values and click handlers
    Object.entries(metrics).forEach(([id, data]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = data.value;
        }
    });

    // Add click handlers for metric cards
    document.querySelectorAll('.metric-card').forEach(card => {
        const tooltip = card.querySelector('.tooltip');
        const infoIcon = card.querySelector('.info-icon');

        if (infoIcon && tooltip) {
            infoIcon.addEventListener('mouseenter', () => {
                tooltip.classList.add('show');
            });

            infoIcon.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
            });
        }

        card.querySelector('.metric-value')?.addEventListener('click', () => {
            const modal = document.getElementById('metricModal');
            const modalTitle = document.getElementById('modalTitle');
            const breakdownList = document.getElementById('breakdownList');
            
            if (modal && modalTitle && breakdownList) {
                const metricId = card.querySelector('.metric-value').id;
                const metricData = metrics[metricId];
                
                // Fix: Remove info icon 'i' from heading text consistently
                const headingText = card.querySelector('h4').childNodes[0].textContent.trim();
                modalTitle.textContent = headingText;
                
                breakdownList.innerHTML = metricData.breakdowns.map(item => {
                    if (metricId === 'cycletime') {
                        return `
                            <li class="breakdown-item">
                                <div class="breakdown-header">
                                    <span>${item.process}</span>
                                    <span>${item.time}</span>
                                </div>
                                <div class="breakdown-details">${item.percentage} of total time</div>
                            </li>
                        `;
                    } else if (metricId === 'variants') {
                        return `
                            <li class="breakdown-item">
                                <div class="breakdown-header">
                                    <span>${item.process}</span>
                                    <span>${item.count} variants</span>
                                </div>
                                <div class="breakdown-details">${item.percentage} of total variants</div>
                            </li>
                        `;
                    } else {
                        return `
                            <li class="breakdown-item">
                                <div class="breakdown-header">
                                    <span>${item.process}</span>
                                    <span>${item.impact} Impact</span>
                                </div>
                                <div class="breakdown-details">Average delay: ${item.delay}</div>
                            </li>
                        `;
                    }
                }).join('');
                
                modal.style.display = 'block';
            }
        });
    });

    // Close modal functionality
    document.querySelector('.modal-close')?.addEventListener('click', () => {
        document.getElementById('metricModal').style.display = 'none';
    });

    window.onclick = (event) => {
        const modal = document.getElementById('metricModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Show initial page based on hash or default to upload
    const initialPageId = window.location.hash.slice(1) || 'upload';
    showPage(initialPageId);
});
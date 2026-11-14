document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const convertBtn = document.getElementById('convert-btn');
    const modal = document.getElementById('conversion-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const progressBar = document.getElementById('conversion-progress');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const pageSizeSelect = document.getElementById('page-size');
    const pageOrientationSelect = document.getElementById('page-orientation');
    
    // File handling
    let filesToConvert = [];
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileInput.click());

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Handle selected files
    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            handleFiles(this.files);
            this.value = ''; // Reset to allow selecting same files again
        }
    });

    // Process files - only accepts JPG
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isJPG = file.type === 'image/jpeg';
            if (!isJPG) {
                showToast(`Skipped ${file.name}: Only JPG files are supported`);
            }
            return isJPG;
        });
        
        if (filesToConvert.length > 0) {
            updateDropAreaText();
            updateFileList();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only JPG files');
        }
    }

    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} JPG file(s) to PDF: ${truncateText(fileNames, 50)}`;
    }

    function updateFileList() {
        fileList.innerHTML = '<h3>Selected JPG Files</h3>';
        
        filesToConvert.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-file-image file-icon"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <i class="fas fa-times remove-file" data-index="${index}" title="Remove file"></i>
            `;
            
            fileList.appendChild(fileItem);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                filesToConvert.splice(index, 1);
                
                if (filesToConvert.length > 0) {
                    updateDropAreaText();
                    updateFileList();
                } else {
                    resetDropArea();
                }
            });
        });
    }

    function resetDropArea() {
        dropArea.querySelector('p').textContent = 'Drag & drop your JPG files here or click to browse';
        dropArea.classList.remove('has-files');
        fileList.innerHTML = '';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Conversion functionality - converts to PDF
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one JPG file to convert');
            return;
        }

        try {
            await startConversion();
        } catch (error) {
            console.error('Conversion failed:', error);
            showToast('Conversion failed: ' + error.message, 'error');
            closeModal();
        }
    });

    async function startConversion() {
        modal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';
        
        if (filesToConvert.length === 1) {
            await convertSingleFile(filesToConvert[0]);
        } else {
            await convertMultipleFiles();
        }
    }

    async function convertSingleFile(file) {
        updateStatus('Processing JPG file...');
        
        try {
            const image = await loadImage(file);
            
            updateProgress(30, 'Generating PDF...');
            
            // Create PDF file
            const pdfBlob = await imageToPDF(image, file.name);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(pdfBlob, file.name.replace(/\.jpe?g$/i, '.pdf'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }

    async function convertMultipleFiles() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const image = await loadImage(file);
                
                if (processedCount > 0) {
                    pdf.addPage();
                }
                
                await addImageToPDF(pdf, image, file.name);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateStatus('Finalizing PDF document...');
        updateProgress(90);
        
        const pdfBlob = pdf.output('blob');
        
        updateProgress(100, 'All files converted to PDF!');
        createDownloadLink(pdfBlob, 'converted_images.pdf', 'Download All as PDF');
    }

    // Helper functions
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }
    
    async function imageToPDF(image, filename) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        await addImageToPDF(pdf, image, filename);
        
        return pdf.output('blob');
    }
    
    function addImageToPDF(pdf, image, filename) {
        return new Promise((resolve) => {
            const pageSize = pageSizeSelect.value;
            const orientation = pageOrientationSelect.value;
            
            let width, height;
            
            if (pageSize === 'fit') {
                // Fit to image dimensions (in mm)
                width = (image.width * 0.264583); // Convert pixels to mm
                height = (image.height * 0.264583);
                
                // Create a custom page size
                pdf.addPage([width, height], orientation);
                pdf.addImage(image, 'JPEG', 0, 0, width, height);
            } else {
                // Standard page sizes
                const pageDimensions = getPageDimensions(pageSize, orientation);
                const pageWidth = pageDimensions.width;
                const pageHeight = pageDimensions.height;
                
                // Calculate dimensions to fit image on page while maintaining aspect ratio
                const imgRatio = image.width / image.height;
                let imgWidth = pageWidth;
                let imgHeight = pageHeight;
                
                if (imgRatio > 1) {
                    // Landscape image
                    imgHeight = pageWidth / imgRatio;
                } else {
                    // Portrait image
                    imgWidth = pageHeight * imgRatio;
                }
                
                // Center the image on the page
                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;
                
                pdf.addImage(image, 'JPEG', x, y, imgWidth, imgHeight);
            }
            
            resolve();
        });
    }
    
    function getPageDimensions(size, orientation) {
        // Dimensions in mm
        const sizes = {
            a4: { width: 210, height: 297 },
            letter: { width: 216, height: 279 },
            legal: { width: 216, height: 356 }
        };
        
        const dimensions = sizes[size] || sizes.a4;
        
        return orientation === 'landscape' 
            ? { width: dimensions.height, height: dimensions.width }
            : dimensions;
    }

    function updateProgress(percent, message) {
        const progress = Math.min(100, Math.max(0, percent));
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        if (message) updateStatus(message);
    }

    function updateStatus(message) {
        const statusMessage = document.querySelector('.status-message') || 
            document.createElement('p');
        statusMessage.className = 'status-message';
        statusMessage.textContent = message;
        if (!statusMessage.parentNode) {
            modal.querySelector('.modal-content').appendChild(statusMessage);
        }
    }

    function createDownloadLink(blob, fileName, btnText = `Download ${fileName}`) {
        const downloadUrl = URL.createObjectURL(blob);
        
        const downloadBtn = document.createElement('a');
        downloadBtn.className = 'btn primary download-btn';
        downloadBtn.innerHTML = `<i class="fas fa-download"></i> ${btnText}`;
        downloadBtn.href = downloadUrl;
        downloadBtn.download = fileName;
        
        downloadSection.appendChild(downloadBtn);
        
        // Add PDF info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = 'PDF is a portable document format that preserves layout';
        downloadSection.appendChild(info);
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 10);
    }

    // Modal controls
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    function closeModal() {
        modal.style.display = 'none';
    }
});

// Add toast notification styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 10000;
}
.toast.show {
    opacity: 1;
}
.toast.error {
    background: #f72585;
}
.toast.warning {
    background: #f8961e;
}
.toast.success {
    background: #4cc9f0;
}
`;
document.head.appendChild(toastStyles);

// Load jsPDF library dynamically
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
script.onload = function() {
    window.jspdf = window.jspdf.jsPDF;
};
document.head.appendChild(script);
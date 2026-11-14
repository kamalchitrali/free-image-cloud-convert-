document.addEventListener('DOMContentLoaded', function() {
    // Check if jsPDF is properly loaded
    if (!window.jspdf) {
        console.error('jsPDF library not loaded');
        showToast('PDF conversion library failed to load. Please refresh the page.', 'error');
        document.getElementById('convert-btn').disabled = true;
        return;
    }

    // Initialize jsPDF
    const { jsPDF } = window.jspdf;

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
    const orientationSelect = document.getElementById('orientation');
    const marginInput = document.getElementById('margin');
    
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
  
    // Process files - only accepts BMP
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isBMP = file.type === 'image/bmp' || file.name.toLowerCase().endsWith('.bmp');
            if (!isBMP) {
                showToast(`Skipped ${file.name}: Only BMP files are supported`);
            }
            return isBMP;
        });
        
        if (filesToConvert.length > 0) {
            updateDropAreaText();
            updateFileList();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only BMP files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} BMP file(s) to PDF: ${truncateText(fileNames, 50)}`;
    }
  
    function updateFileList() {
        fileList.innerHTML = '<h3>Selected BMP Files</h3>';
        
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
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
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
        dropArea.querySelector('p').textContent = 'Drag & drop your BMP files here or click to browse';
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
            showToast('Please select at least one BMP file to convert');
            return;
        }
  
        const pageSize = pageSizeSelect.value;
        const orientation = orientationSelect.value;
        const margin = parseInt(marginInput.value);
        
        try {
            await startConversion(pageSize, orientation, margin);
        } catch (error) {
            console.error('Conversion failed:', error);
            showToast('Conversion failed: ' + error.message, 'error');
            closeModal();
        }
    });
  
    async function startConversion(pageSize, orientation, margin) {
        modal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';
        
        if (filesToConvert.length === 1) {
            await convertSingleFile(filesToConvert[0], pageSize, orientation, margin);
        } else {
            await convertMultipleFiles(pageSize, orientation, margin);
        }
    }
  
    async function convertSingleFile(file, pageSize, orientation, margin) {
        updateStatus('Processing BMP file...');
        
        try {
            const image = await loadImage(file);
            updateProgress(30, 'Creating PDF...');
            
            // Create PDF
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: pageSize === 'fit' ? [image.width * 0.264583, image.height * 0.264583] : pageSize
            });
            
            await addImageToPDF(pdf, image, pageSize, orientation, margin);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(pdf.output('blob'), file.name.replace(/\.bmp$/i, '.pdf'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles(pageSize, orientation, margin) {
        const pdf = new jsPDF();
        let isFirstPage = true;
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const image = await loadImage(file);
                
                if (!isFirstPage) {
                    pdf.addPage(pageSize, orientation);
                }
                
                await addImageToPDF(pdf, image, pageSize, orientation, margin);
                isFirstPage = false;
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showToast(`Failed to convert ${file.name}`, 'error');
            }
        }
        
        updateProgress(90, 'Finalizing PDF...');
        updateStatus('Creating final PDF document...');
        
        updateProgress(100, 'All files converted to PDF!');
        createDownloadLink(pdf.output('blob'), 'converted_images.pdf', 'Download All as PDF');
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
    
    async function addImageToPDF(pdf, image, pageSize, orientation, margin) {
        return new Promise((resolve) => {
            const imgWidth = image.width;
            const imgHeight = image.height;
            
            // Convert pixels to mm (1 inch = 25.4mm, 1 inch = 96px)
            const imgWidthMM = imgWidth * 0.264583;
            const imgHeightMM = imgHeight * 0.264583;
            
            // Get PDF page dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate available space after margins
            const availableWidth = pageWidth - (margin * 2);
            const availableHeight = pageHeight - (margin * 2);
            
            // Calculate scaling to fit image within page
            let scale = 1;
            if (pageSize !== 'fit') {
                scale = Math.min(availableWidth / imgWidthMM, availableHeight / imgHeightMM);
                scale = Math.min(scale, 1); // Don't scale up
            }
            
            // Calculate position to center image
            const x = (pageWidth - (imgWidthMM * scale)) / 2;
            const y = (pageHeight - (imgHeightMM * scale)) / 2;
            
            // Create canvas to handle the image
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            // Convert canvas to data URL
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Add image to PDF
            pdf.addImage(imgData, 'JPEG', x, y, imgWidthMM * scale, imgHeightMM * scale);
            resolve();
        });
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
        info.textContent = 'PDF is a universal document format';
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

// Add CSS for toast notifications if not already present
if (!document.querySelector('style[data-toast-styles]')) {
    const toastStyles = document.createElement('style');
    toastStyles.setAttribute('data-toast-styles', 'true');
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
}
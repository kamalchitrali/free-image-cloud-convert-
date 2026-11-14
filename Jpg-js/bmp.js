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
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    
    // File handling
    let filesToConvert = [];
    
    // Update quality value display
    qualitySlider.addEventListener('input', function() {
        qualityValue.textContent = `${this.value}%`;
    });

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
            const isJPG = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
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
            `Ready to convert ${filesToConvert.length} JPG file(s) to BMP: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality - converts to BMP
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
            updateProgress(30, 'Converting to BMP...');
            
            // Create BMP file
            const bmpBlob = await canvasToBMP(image);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(bmpBlob, file.name.replace(/\.jpe?g$/i, '.bmp'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles() {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_bmp");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const image = await loadImage(file);
                const bmpBlob = await canvasToBMP(image);
                
                const newName = file.name.replace(/\.jpe?g$/i, '.bmp');
                imgFolder.file(newName, bmpBlob);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateStatus('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(80 + (metadata.percent * 0.2)); // Last 20% for ZIP creation
        });
        
        updateProgress(100, 'All files converted to BMP!');
        createDownloadLink(zipBlob, 'converted_bmp.zip', 'Download All as BMP');
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
    
    // Convert canvas to BMP
    function canvasToBMP(image) {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // BMP file structure
            const fileSize = 54 + (imageData.width * imageData.height * 3);
            const fileBuffer = new ArrayBuffer(fileSize);
            const view = new DataView(fileBuffer);
            
            // BMP header
            view.setUint8(0, 0x42); // 'B'
            view.setUint8(1, 0x4D); // 'M'
            view.setUint32(2, fileSize, true); // File size
            view.setUint32(6, 0, true); // Reserved
            view.setUint32(10, 54, true); // Pixel data offset
            
            // DIB header
            view.setUint32(14, 40, true); // DIB header size
            view.setInt32(18, imageData.width, true); // Width
            view.setInt32(22, imageData.height, true); // Height
            view.setUint16(26, 1, true); // Color planes
            view.setUint16(28, 24, true); // Bits per pixel (24-bit)
            view.setUint32(30, 0, true); // Compression method
            view.setUint32(34, 0, true); // Image size (can be 0 for uncompressed)
            view.setInt32(38, 2835, true); // Horizontal resolution (pixels per meter)
            view.setInt32(42, 2835, true); // Vertical resolution
            view.setUint32(46, 0, true); // Colors in palette
            view.setUint32(50, 0, true); // Important colors
            
            // Pixel data (BGR format)
            let offset = 54;
            const rowSize = Math.floor((24 * imageData.width + 31) / 32) * 4;
            const padding = rowSize - (imageData.width * 3);
            
            for (let y = imageData.height - 1; y >= 0; y--) {
                for (let x = 0; x < imageData.width; x++) {
                    const i = (y * imageData.width + x) * 4;
                    view.setUint8(offset++, data[i + 2]); // B
                    view.setUint8(offset++, data[i + 1]); // G
                    view.setUint8(offset++, data[i]);     // R
                }
                // Add padding
                for (let p = 0; p < padding; p++) {
                    view.setUint8(offset++, 0);
                }
            }
            
            const blob = new Blob([fileBuffer], {type: 'image/bmp'});
            resolve(blob);
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
        
        // Add BMP info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = 'BMP is a standard bitmap image format';
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
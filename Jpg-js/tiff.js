document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const compressionSelect = document.getElementById('compression');
    const convertBtn = document.getElementById('convert-btn');
    const modal = document.getElementById('conversion-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const progressBar = document.getElementById('conversion-progress');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    
    let filesToConvert = [];

    // Check for UTIF library
    if (typeof UTIF === 'undefined') {
        console.error('UTIF.js not loaded!');
        showToast('Error: TIFF conversion library not loaded', 'error');
        convertBtn.disabled = true;
    }

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

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

    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileInput.click());

    function handleDrop(e) {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    }

    fileInput.addEventListener('change', function() {
        if (this.files.length) {
            handleFiles(this.files);
        }
    });

    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isJPG = file.type === 'image/jpeg' || 
                         /\.jpe?g$/i.test(file.name);
            if (!isJPG) {
                showToast(`Skipped ${file.name}: Not a JPG file`, 'warning');
            }
            return isJPG;
        });
        
        updateFileList();
    }

    function updateFileList() {
        fileList.innerHTML = '';
        
        if (filesToConvert.length === 0) {
            fileList.innerHTML = '<p>No files selected</p>';
            return;
        }

        const listHeader = document.createElement('h3');
        listHeader.textContent = 'Selected Files:';
        fileList.appendChild(listHeader);

        filesToConvert.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                <button class="remove-btn" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            fileList.appendChild(fileItem);
        });

        // Add remove button handlers
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                filesToConvert.splice(index, 1);
                updateFileList();
            });
        });
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }

    // Main conversion function
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select JPG files first', 'warning');
            return;
        }

        if (typeof UTIF === 'undefined') {
            showToast('TIFF conversion library not available', 'error');
            return;
        }

        modal.style.display = 'block';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';

        const compression = compressionSelect.value;

        try {
            if (filesToConvert.length === 1) {
                await convertSingleFile(filesToConvert[0], compression);
            } else {
                await convertMultipleFiles(compression);
            }
        } catch (error) {
            console.error('Conversion error:', error);
            showToast('Conversion failed: ' + error.message, 'error');
        }
    });

    async function convertSingleFile(file, compression) {
        updateStatus(`Converting ${file.name}...`);
        
        try {
            // Step 1: Load the image
            const img = await loadImage(file);
            updateProgress(25, 'Image loaded');
            
            // Step 2: Draw to canvas
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            updateProgress(50, 'Image drawn to canvas');
            
            // Step 3: Convert to TIFF
            const tiffBlob = await convertCanvasToTIFF(canvas, compression);
            updateProgress(75, 'TIFF conversion complete');
            
            // Step 4: Create download link
            const outputName = file.name.replace(/\.jpe?g$/i, '.tiff');
            createDownloadLink(tiffBlob, outputName);
            updateProgress(100, 'Conversion complete!');
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }

    async function convertMultipleFiles(compression) {
        const zip = new JSZip();
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing file ${processedCount + 1} of ${filesToConvert.length}`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const img = await loadImage(file);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const tiffBlob = await convertCanvasToTIFF(canvas, compression);
                const outputName = file.name.replace(/\.jpe?g$/i, '.tiff');
                zip.file(outputName, tiffBlob);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file
                processedCount++;
            }
        }
        
        updateStatus('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(80 + (metadata.percent * 0.2));
        });
        
        createDownloadLink(zipBlob, 'converted_files.zip', 'Download All as ZIP');
        updateProgress(100, 'All files converted!');
    }

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

    function convertCanvasToTIFF(canvas, compression) {
        return new Promise((resolve, reject) => {
            try {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Compression mapping
                const compressionMap = {
                    'none': 1,
                    'lzw': 5,
                    'deflate': 8,
                    'packbits': 32773
                };
                
                const compressionCode = compressionMap[compression] || 1;
                const tiffData = UTIF.encodeImageData(imageData, compressionCode);
                const blob = new Blob([tiffData], {type: 'image/tiff'});
                
                resolve(blob);
            } catch (error) {
                reject(error);
            }
        });
    }

    function updateProgress(percent, message) {
        const rounded = Math.round(percent);
        progressBar.style.width = `${rounded}%`;
        progressText.textContent = `${rounded}%`;
        if (message) updateStatus(message);
    }

    function updateStatus(message) {
        const statusElement = modal.querySelector('.status-message');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    function createDownloadLink(blob, fileName, linkText) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = fileName;
        link.className = 'download-btn';
        link.textContent = linkText || `Download ${fileName}`;
        
        downloadSection.appendChild(link);
        
        // Clean up when modal is closed
        link.addEventListener('click', () => {
            setTimeout(() => URL.revokeObjectURL(url), 100);
        });
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }, 10);
    }

    // Modal controls
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
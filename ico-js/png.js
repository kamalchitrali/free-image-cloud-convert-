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
    const pngSizeSelect = document.getElementById('png-size');
    const preserveTransparency = document.getElementById('preserve-transparency');
    
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
  
    // Process files - only accepts ICO
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isICO = file.type === 'image/x-icon' || file.name.toLowerCase().endsWith('.ico');
            if (!isICO) {
                showToast(`Skipped ${file.name}: Only ICO files are supported`);
            }
            return isICO;
        });
        
        if (filesToConvert.length > 0) {
            updateDropAreaText();
            updateFileList();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only ICO files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} ICO file(s) to PNG: ${truncateText(fileNames, 50)}`;
    }
  
    function updateFileList() {
        fileList.innerHTML = '<h3>Selected ICO Files</h3>';
        
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
        dropArea.querySelector('p').textContent = 'Drag & drop your ICO files here or click to browse';
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
  
    // Conversion functionality - converts to PNG
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one ICO file to convert');
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
        updateStatus('Processing ICO file...');
        
        try {
            const image = await loadImage(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size based on selected option
            const size = pngSizeSelect.value === 'original' ? null : parseInt(pngSizeSelect.value);
            
            if (size) {
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(image, 0, 0, size, size);
            } else {
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);
            }
            
            updateProgress(50, 'Converting to PNG...');
            
            // Convert canvas to PNG
            const pngBlob = await canvasToPNG(canvas, preserveTransparency.checked);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(pngBlob, file.name.replace(/\.ico$/i, '.png'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles() {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_pngs");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const image = await loadImage(file);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size based on selected option
                const size = pngSizeSelect.value === 'original' ? null : parseInt(pngSizeSelect.value);
                
                if (size) {
                    canvas.width = size;
                    canvas.height = size;
                    ctx.drawImage(image, 0, 0, size, size);
                } else {
                    canvas.width = image.width;
                    canvas.height = image.height;
                    ctx.drawImage(image, 0, 0);
                }
                
                const pngBlob = await canvasToPNG(canvas, preserveTransparency.checked);
                const newName = file.name.replace(/\.ico$/i, '.png');
                imgFolder.file(newName, pngBlob);
                
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
        
        updateProgress(100, 'All files converted to PNG!');
        createDownloadLink(zipBlob, 'converted_pngs.zip', 'Download All as PNG');
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
  
    function canvasToPNG(canvas, preserveAlpha) {
        return new Promise((resolve) => {
            if (preserveAlpha) {
                // Preserve transparency by converting directly to PNG
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/png');
            } else {
                // If not preserving transparency, we'll flatten to white background
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Fill with white background
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Draw original image on top
                tempCtx.drawImage(canvas, 0, 0);
                
                // Convert to PNG
                tempCanvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/png');
            }
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
        
        // Add PNG info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = preserveTransparency.checked 
            ? 'PNG with transparency preserved' 
            : 'PNG with white background';
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
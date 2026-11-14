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
    const sizeOptions = document.querySelectorAll('input[name="ico-size"]');
    
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
            this.value = '';
        }
    });

    // Process files - only accepts JPG
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isJPG = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg');
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
            `Ready to convert ${filesToConvert.length} JPG file(s) to ICO: ${truncateText(fileNames, 50)}`;
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

    // Get selected icon sizes
    function getSelectedSizes() {
        const sizes = [];
        sizeOptions.forEach(option => {
            if (option.checked) sizes.push(parseInt(option.value));
        });
        return sizes.length > 0 ? sizes : [16, 32, 48];
    }

    // Conversion functionality
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
            const selectedSizes = getSelectedSizes();
            
            updateProgress(30, 'Generating ICO sizes...');
            
            const icoBlob = await canvasToICO(image, selectedSizes);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(icoBlob, file.name.replace(/\.jpe?g$/i, '.ico'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }

    async function convertMultipleFiles() {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_icons");
        let processedCount = 0;
        const selectedSizes = getSelectedSizes();
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const image = await loadImage(file);
                const icoBlob = await canvasToICO(image, selectedSizes);
                
                const newName = file.name.replace(/\.jpe?g$/i, '.ico');
                imgFolder.file(newName, icoBlob);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }
        
        updateStatus('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(80 + (metadata.percent * 0.2));
        });
        
        updateProgress(100, 'All files converted to ICO!');
        createDownloadLink(zipBlob, 'converted_icons.zip', 'Download All as ICO');
    }

    // Image processing functions
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

    function canvasToICO(image, sizes) {
        return new Promise(resolve => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            sizes.sort((a, b) => b - a);
            
            const icoHeader = new ArrayBuffer(6);
            const icoHeaderView = new DataView(icoHeader);
            icoHeaderView.setUint16(0, 0, true);
            icoHeaderView.setUint16(2, 1, true);
            icoHeaderView.setUint16(4, sizes.length, true);
            
            const directoryEntries = new ArrayBuffer(16 * sizes.length);
            const directoryView = new DataView(directoryEntries);
            
            const imageDataArray = [];
            let offset = 6 + (16 * sizes.length);
            
            sizes.forEach((size, index) => {
                tempCanvas.width = size;
                tempCanvas.height = size;
                tempCtx.clearRect(0, 0, size, size);
                tempCtx.drawImage(image, 0, 0, size, size);
                
                const pngData = tempCanvas.toDataURL('image/png').split(',')[1];
                const pngBinary = atob(pngData);
                const pngBuffer = new ArrayBuffer(pngBinary.length);
                const pngView = new Uint8Array(pngBuffer);
                for (let i = 0; i < pngBinary.length; i++) {
                    pngView[i] = pngBinary.charCodeAt(i);
                }
                
                directoryView.setUint8(index * 16, size);
                directoryView.setUint8(index * 16 + 1, size);
                directoryView.setUint8(index * 16 + 2, 0);
                directoryView.setUint8(index * 16 + 3, 0);
                directoryView.setUint16(index * 16 + 4, 1, true);
                directoryView.setUint16(index * 16 + 6, 32, true);
                directoryView.setUint32(index * 16 + 8, pngBuffer.byteLength, true);
                directoryView.setUint32(index * 16 + 12, offset, true);
                
                imageDataArray.push(pngBuffer);
                offset += pngBuffer.byteLength;
            });
            
            const icoData = new Uint8Array(offset);
            icoData.set(new Uint8Array(icoHeader), 0);
            icoData.set(new Uint8Array(directoryEntries), 6);
            
            let currentOffset = 6 + directoryEntries.byteLength;
            imageDataArray.forEach(buffer => {
                icoData.set(new Uint8Array(buffer), currentOffset);
                currentOffset += buffer.byteLength;
            });
            
            const blob = new Blob([icoData], {type: 'image/x-icon'});
            resolve(blob);
        });
    }

    // UI functions
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
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
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
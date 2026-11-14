document.addEventListener('DOMContentLoaded', function() {
    // Verify critical elements exist
    const requiredElements = [
        'drop-area', 'file-input', 'file-list', 'convert-btn',
        'compression', 'conversion-modal', 'conversion-progress',
        'progress-text', 'download-section'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        const errorMsg = `Critical error: Required elements missing (${missingElements.join(', ')}). Please refresh the page.`;
        console.error(errorMsg);
        document.body.innerHTML += `
            <div class="error" style="padding: 20px; background: #ffebee; border: 1px solid red;">
                ${errorMsg}
            </div>
        `;
        return;
    }

    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const convertBtn = document.getElementById('convert-btn');
    const compressionSelect = document.getElementById('compression');
    const modal = document.getElementById('conversion-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const progressBar = document.getElementById('conversion-progress');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    
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
            `Ready to convert ${filesToConvert.length} BMP file(s) to TIFF: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one BMP file to convert');
            return;
        }
  
        try {
            const compression = compressionSelect.value;
            await startConversion(compression);
        } catch (error) {
            console.error('Conversion failed:', error);
            let errorMsg = 'Conversion failed';
            
            if (error.message.includes("Cannot read properties of null") && error.message.includes("style")) {
                errorMsg = "Conversion failed: Cannot read the properties of null (reading 'style')";
            } else {
                errorMsg += ': ' + error.message;
            }
            
            showToast(errorMsg, 'error');
            updateStatus(errorMsg);
            closeModal();
        }
    });
  
    async function startConversion(compression) {
        try {
            // Verify modal elements exist before using them
            if (!modal || !progressBar || !progressText || !downloadSection) {
                throw new Error("Critical conversion elements not found");
            }
            
            modal.style.display = 'flex';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            downloadSection.innerHTML = '';
            
            if (filesToConvert.length === 1) {
                await convertSingleFile(filesToConvert[0], compression);
            } else {
                await convertMultipleFiles(compression);
            }
        } catch (error) {
            console.error('Conversion failed:', error);
            let errorMsg = 'Conversion failed';
            
            if (error.message.includes("Cannot read properties of null") && error.message.includes("style")) {
                errorMsg = "Conversion failed: Cannot read the properties of null (reading 'style')";
            } else {
                errorMsg += ': ' + error.message;
            }
            
            showToast(errorMsg, 'error');
            updateStatus(errorMsg);
            throw error;
        }
    }
  
    async function convertSingleFile(file, compression) {
        updateStatus('Processing BMP file...');
        
        try {
            const canvas = await loadImageToCanvas(file);
            updateProgress(50, 'Converting to TIFF...');
            
            const tiffBlob = await convertCanvasToTIFF(canvas, compression);
            
            // Verify the TIFF file was created properly
            if (tiffBlob.size === 0) {
                throw new Error("Generated empty TIFF file");
            }
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(tiffBlob, file.name.replace(/\.bmp$/i, '.tiff'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles(compression) {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_tiff");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const canvas = await loadImageToCanvas(file);
                const tiffBlob = await convertCanvasToTIFF(canvas, compression);
                
                // Verify the TIFF file was created properly
                if (tiffBlob.size === 0) {
                    throw new Error(`Generated empty TIFF file for ${file.name}`);
                }
                
                const newName = file.name.replace(/\.bmp$/i, '.tiff');
                imgFolder.file(newName, tiffBlob);
                
                processedCount++;
                updateProgress((processedCount / filesToConvert.length) * 80);
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showToast(`Failed to convert ${file.name}: ${error.message}`, 'error');
            }
        }
        
        updateStatus('Creating ZIP archive...');
        updateProgress(85);
        
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(85 + (metadata.percent * 15));
        });
        
        updateProgress(100, 'All files converted to TIFF!');
        createDownloadLink(zipBlob, 'converted_images.zip', 'Download All as TIFF');
    }
  
    async function loadImageToCanvas(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }
    
    async function convertCanvasToTIFF(canvas, compression) {
        return new Promise((resolve) => {
            try {
                const ctx = canvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Convert RGBA to RGB (remove alpha channel)
                const rgbData = new Uint8Array(canvas.width * canvas.height * 3);
                for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 3) {
                    rgbData[j] = imageData.data[i];     // R
                    rgbData[j + 1] = imageData.data[i + 1]; // G
                    rgbData[j + 2] = imageData.data[i + 2]; // B
                }

                const tiffData = {
                    width: canvas.width,
                    height: canvas.height,
                    data: rgbData,
                    compression: compression === 'none' ? 1 : 
                                compression === 'lzw' ? 5 :
                                compression === 'deflate' ? 8 :
                                compression === 'packbits' ? 32773 : 1,
                    photometricInterpretation: 2, // RGB
                    resolutionUnit: 2, // inches
                    xResolution: 72,
                    yResolution: 72,
                    samplesPerPixel: 3,
                    bitsPerSample: [8, 8, 8],
                    planarConfiguration: 1
                };
                
                const tiffBuffer = UTIF.encode(tiffData);
                const tiffBlob = new Blob([tiffBuffer], {type: 'image/tiff'});
                
                resolve(tiffBlob);
            } catch (error) {
                console.error("TIFF conversion error:", error);
                throw new Error("Failed to generate TIFF: " + error.message);
            }
        });
    }
  
    function updateProgress(percent, message) {
        try {
            if (!progressBar || !progressText) {
                throw new Error("Cannot read the properties of null (reading 'style')");
            }
            
            const progress = Math.min(100, Math.max(0, percent));
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
            
            if (message) updateStatus(message);
        } catch (error) {
            console.error('Progress update failed:', error);
            throw error;
        }
    }
  
    function updateStatus(message) {
        try {
            const statusElement = document.querySelector('.status-message');
            if (statusElement) {
                statusElement.textContent = message;
            }
        } catch (error) {
            console.error('Status update failed:', error);
        }
    }
  
    function createDownloadLink(blob, fileName, btnText = `Download ${fileName}`) {
        try {
            const downloadUrl = URL.createObjectURL(blob);
            
            const downloadBtn = document.createElement('a');
            downloadBtn.className = 'btn primary download-btn';
            downloadBtn.innerHTML = `<i class="fas fa-download"></i> ${btnText}`;
            downloadBtn.href = downloadUrl;
            downloadBtn.download = fileName;
            
            downloadSection.appendChild(downloadBtn);
            
            const info = document.createElement('p');
            info.className = 'format-info';
            info.textContent = 'TIFF is a high-quality image format';
            downloadSection.appendChild(info);

            console.log(`Created download link for ${fileName} (${blob.size} bytes)`);
        } catch (error) {
            console.error('Download link creation failed:', error);
            showToast('Failed to create download link', 'error');
        }
    }
  
    function showToast(message, type = 'info') {
        try {
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
        } catch (error) {
            console.error('Toast creation failed:', error);
        }
    }
  
    // Modal controls
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });
  
    function closeModal() {
        try {
            if (modal) {
                modal.style.display = 'none';
            }
        } catch (error) {
            console.error('Modal close failed:', error);
        }
    }
});
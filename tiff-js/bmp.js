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
    const bmpColorDepth = document.getElementById('bmp-color-depth');
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
  
    // Process files - only accepts TIFF
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isTIFF = file.type === 'image/tiff' || 
                         file.name.toLowerCase().endsWith('.tif') || 
                         file.name.toLowerCase().endsWith('.tiff');
            if (!isTIFF) {
                showToast(`Skipped ${file.name}: Only TIFF files are supported`);
            }
            return isTIFF;
        });
        
        if (filesToConvert.length > 0) {
            updateDropAreaText();
            updateFileList();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only TIFF files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} TIFF file(s) to BMP: ${truncateText(fileNames, 50)}`;
    }
  
    function updateFileList() {
        fileList.innerHTML = '<h3>Selected TIFF Files</h3>';
        
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
        dropArea.querySelector('p').textContent = 'Drag & drop your TIFF files here or click to browse';
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
            showToast('Please select at least one TIFF file to convert');
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
        updateStatus('Processing TIFF file...');
        
        try {
            const imageData = await parseTIFF(file);
            updateProgress(30, 'Converting to BMP...');
            
            // Convert to BMP
            const bmpBlob = await convertToBMP(
                imageData.data, 
                imageData.width, 
                imageData.height,
                parseInt(bmpColorDepth.value),
                preserveTransparency.checked
            );
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(bmpBlob, file.name.replace(/\.tiff?$/i, '.bmp'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles() {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_bmps");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const imageData = await parseTIFF(file);
                const bmpBlob = await convertToBMP(
                    imageData.data, 
                    imageData.width, 
                    imageData.height,
                    parseInt(bmpColorDepth.value),
                    preserveTransparency.checked
                );
                
                const newName = file.name.replace(/\.tiff?$/i, '.bmp');
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
        createDownloadLink(zipBlob, 'converted_bmps.zip', 'Download All as BMP');
    }
  
    // Parse TIFF file using UTIF.js
    async function parseTIFF(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    const ifds = UTIF.decode(arrayBuffer);
                    
                    if (!ifds || ifds.length === 0) {
                        throw new Error('Invalid TIFF file');
                    }
                    
                    // Get first image
                    const ifd = ifds[0];
                    UTIF.decodeImage(arrayBuffer, ifd);
                    
                    // Convert to RGBA
                    const rgba = new Uint8Array(ifd.width * ifd.height * 4);
                    UTIF.toRGBA8(ifd, rgba);
                    
                    resolve({
                        data: rgba,
                        width: ifd.width,
                        height: ifd.height
                    });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
  
    // Convert RGBA data to BMP format
    function convertToBMP(rgbaData, width, height, bitsPerPixel, preserveAlpha) {
        return new Promise((resolve) => {
            // BMP file structure components
            const fileHeader = createBMPFileHeader(width, height, bitsPerPixel);
            const infoHeader = createBMPInfoHeader(width, height, bitsPerPixel);
            const pixelData = createBMPPixelData(rgbaData, width, height, bitsPerPixel, preserveAlpha);
            
            // Combine all parts
            const bmpData = new Uint8Array(fileHeader.length + infoHeader.length + pixelData.length);
            bmpData.set(fileHeader, 0);
            bmpData.set(infoHeader, fileHeader.length);
            bmpData.set(pixelData, fileHeader.length + infoHeader.length);
            
            resolve(new Blob([bmpData], { type: 'image/bmp' }));
        });
    }
    
    // Create BMP file header (14 bytes)
    function createBMPFileHeader(width, height, bitsPerPixel) {
        const bytesPerPixel = bitsPerPixel === 24 ? 3 : 1;
        const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
        const pixelDataSize = rowSize * height;
        const fileSize = 14 + 40 + pixelDataSize;
        
        const header = new Uint8Array(14);
        
        // BM signature
        header[0] = 0x42; // 'B'
        header[1] = 0x4D; // 'M'
        
        // File size
        header[2] = fileSize & 0xff;
        header[3] = (fileSize >> 8) & 0xff;
        header[4] = (fileSize >> 16) & 0xff;
        header[5] = (fileSize >> 24) & 0xff;
        
        // Reserved
        header[6] = 0;
        header[7] = 0;
        header[8] = 0;
        header[9] = 0;
        
        // Pixel data offset (14 + 40 = 54 bytes)
        header[10] = 54;
        header[11] = 0;
        header[12] = 0;
        header[13] = 0;
        
        return header;
    }
    
    // Create BMP info header (40 bytes)
    function createBMPInfoHeader(width, height, bitsPerPixel) {
        const header = new Uint8Array(40);
        
        // Header size (40 bytes)
        header[0] = 40;
        header[1] = 0;
        header[2] = 0;
        header[3] = 0;
        
        // Image width
        header[4] = width & 0xff;
        header[5] = (width >> 8) & 0xff;
        header[6] = (width >> 16) & 0xff;
        header[7] = (width >> 24) & 0xff;
        
        // Image height (positive for bottom-up BMP)
        header[8] = height & 0xff;
        header[9] = (height >> 8) & 0xff;
        header[10] = (height >> 16) & 0xff;
        header[11] = (height >> 24) & 0xff;
        
        // Planes (must be 1)
        header[12] = 1;
        header[13] = 0;
        
        // Bits per pixel
        header[14] = bitsPerPixel;
        header[15] = 0;
        
        // Compression (0 = none)
        header[16] = 0;
        header[17] = 0;
        header[18] = 0;
        header[19] = 0;
        
        // Image size (can be 0 for uncompressed)
        header[20] = 0;
        header[21] = 0;
        header[22] = 0;
        header[23] = 0;
        
        // Horizontal resolution (pixels per meter, default 2835 = 72 dpi)
        header[24] = 0x13;
        header[25] = 0x0B;
        header[26] = 0;
        header[27] = 0;
        
        // Vertical resolution (same as horizontal)
        header[28] = 0x13;
        header[29] = 0x0B;
        header[30] = 0;
        header[31] = 0;
        
        // Colors in palette (0 for default)
        header[32] = 0;
        header[33] = 0;
        header[34] = 0;
        header[35] = 0;
        
        // Important color count (0 means all)
        header[36] = 0;
        header[37] = 0;
        header[38] = 0;
        header[39] = 0;
        
        return header;
    }
    
    // Create BMP pixel data
    function createBMPPixelData(rgbaData, width, height, bitsPerPixel, preserveAlpha) {
        const bytesPerPixel = bitsPerPixel === 24 ? 3 : 1;
        const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
        const pixelData = new Uint8Array(rowSize * height);
        
        // BMP stores pixels bottom-up
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = ((height - 1 - y) * width + x) * 4;
                const dstPos = y * rowSize + x * bytesPerPixel;
                
                if (bitsPerPixel === 24) {
                    // 24-bit BMP stores pixels in BGR order
                    pixelData[dstPos] = rgbaData[srcPos + 2];     // B
                    pixelData[dstPos + 1] = rgbaData[srcPos + 1]; // G
                    pixelData[dstPos + 2] = rgbaData[srcPos];     // R
                } else if (bitsPerPixel === 8) {
                    // 8-bit grayscale (simple conversion)
                    const r = rgbaData[srcPos];
                    const g = rgbaData[srcPos + 1];
                    const b = rgbaData[srcPos + 2];
                    pixelData[dstPos] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                } else {
                    // 1-bit monochrome (threshold at 50%)
                    const r = rgbaData[srcPos];
                    const g = rgbaData[srcPos + 1];
                    const b = rgbaData[srcPos + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    const bit = gray < 128 ? 1 : 0;
                    
                    // For 1-bit, we need to pack 8 pixels into each byte
                    const bytePos = Math.floor(dstPos / 8);
                    const bitPos = 7 - (dstPos % 8);
                    pixelData[bytePos] |= (bit << bitPos);
                }
            }
        }
        
        return pixelData;
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
        info.textContent = `BMP ${bmpColorDepth.value}-bit ${preserveTransparency.checked ? 'with alpha' : ''}`;
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
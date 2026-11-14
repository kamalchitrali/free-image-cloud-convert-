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
    const icoSizes = document.querySelectorAll('#ico-sizes input[type="checkbox"]');
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
            `Ready to convert ${filesToConvert.length} TIFF file(s) to ICO: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality - converts to ICO
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one TIFF file to convert');
            return;
        }
        
        // Get selected sizes
        const selectedSizes = Array.from(icoSizes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => parseInt(checkbox.value));
            
        if (selectedSizes.length === 0) {
            showToast('Please select at least one icon size');
            return;
        }
  
        try {
            await startConversion(selectedSizes);
        } catch (error) {
            console.error('Conversion failed:', error);
            showToast('Conversion failed: ' + error.message, 'error');
            closeModal();
        }
    });
  
    async function startConversion(selectedSizes) {
        modal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';
        
        if (filesToConvert.length === 1) {
            await convertSingleFile(filesToConvert[0], selectedSizes);
        } else {
            await convertMultipleFiles(selectedSizes);
        }
    }
  
    async function convertSingleFile(file, selectedSizes) {
        updateStatus('Processing TIFF file...');
        
        try {
            const imageData = await parseTIFF(file);
            updateProgress(30, 'Creating ICO...');
            
            // Create ICO with all selected sizes
            const icoBlob = await createMultiSizeICO(imageData, selectedSizes, preserveTransparency.checked);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(icoBlob, file.name.replace(/\.tiff?$/i, '.ico'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles(selectedSizes) {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_icons");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const imageData = await parseTIFF(file);
                const icoBlob = await createMultiSizeICO(imageData, selectedSizes, preserveTransparency.checked);
                
                const newName = file.name.replace(/\.tiff?$/i, '.ico');
                imgFolder.file(newName, icoBlob);
                
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
        
        updateProgress(100, 'All files converted to ICO!');
        createDownloadLink(zipBlob, 'converted_icons.zip', 'Download All as ICO');
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
    
    // Create ICO file with multiple sizes
    async function createMultiSizeICO(imageData, sizes, preserveAlpha) {
        return new Promise((resolve) => {
            // Create an array to hold all icon images
            const iconImages = [];
            
            // Process each requested size
            sizes.forEach(size => {
                // Create canvas for this size
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Create temporary canvas for original image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = imageData.width;
                tempCanvas.height = imageData.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Put original image data to temp canvas
                const tempImageData = new ImageData(
                    new Uint8ClampedArray(imageData.data),
                    imageData.width,
                    imageData.height
                );
                tempCtx.putImageData(tempImageData, 0, 0);
                
                // Draw the source image scaled to this size
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(tempCanvas, 0, 0, size, size);
                
                // Get image data
                const sizedImageData = ctx.getImageData(0, 0, size, size);
                iconImages.push({
                    width: size,
                    height: size,
                    data: sizedImageData.data
                });
            });
            
            // Create ICO file structure
            const icoFile = createICOFile(iconImages, preserveAlpha);
            
            // Convert to Blob
            const blob = new Blob([icoFile], { type: 'image/x-icon' });
            resolve(blob);
        });
    }
    
    // Create ICO file from multiple images
    function createICOFile(iconImages, preserveAlpha) {
        // ICO header (6 bytes)
        const header = new Uint8Array([
            0, 0, // Reserved (must be 0)
            1, 0, // Type (1 for ICO)
            iconImages.length, 0  // Number of images
        ]);
        
        // Calculate offsets
        let offset = 6 + (iconImages.length * 16); // Header + directory entries
        const directoryEntries = [];
        const imageDataChunks = [];
        
        // Process each image
        iconImages.forEach(image => {
            const width = image.width === 256 ? 0 : image.width;
            const height = image.height === 256 ? 0 : image.height;
            const bpp = preserveAlpha ? 32 : 24;
            const size = image.width * image.height * (preserveAlpha ? 4 : 3) + 40;
            
            // Directory entry (16 bytes)
            const entry = new Uint8Array([
                width, height, 0, 0, // Width, Height (0 means 256)
                0,                   // Number of colors in palette (0 for no palette)
                0,                   // Reserved
                1, 0, 0, 0,         // Color planes (1)
                bpp, 0, 0, 0,        // Bits per pixel
                size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff, // Size of image data
                offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff // Offset to image data
            ]);
            
            directoryEntries.push(entry);
            
            // BITMAPINFOHEADER (40 bytes)
            const infoHeader = new Uint8Array([
                40, 0, 0, 0,        // Size of this header (40 bytes)
                image.width & 0xff, (image.width >> 8) & 0xff, (image.width >> 16) & 0xff, (image.width >> 24) & 0xff, // Width
                image.height * 2 & 0xff, (image.height * 2 >> 8) & 0xff, (image.height * 2 >> 16) & 0xff, (image.height * 2 >> 24) & 0xff, // Height (×2)
                1, 0,                // Planes (1)
                preserveAlpha ? 32 : 24, 0,             // Bits per pixel
                0, 0, 0, 0,         // Compression (none)
                0, 0, 0, 0,         // Size of image (can be 0 for uncompressed)
                0, 0, 0, 0,         // X pixels per meter (unused)
                0, 0, 0, 0,         // Y pixels per meter (unused)
                0, 0, 0, 0,         // Colors in color table (0 for no palette)
                0, 0, 0, 0          // Important color count (0 means all)
            ]);
            
            // Pixel data (BGR or BGRA format, bottom-up)
            const pixels = new Uint8Array(image.width * image.height * (preserveAlpha ? 4 : 3));
            for (let y = 0; y < image.height; y++) {
                for (let x = 0; x < image.width; x++) {
                    const srcPos = (y * image.width + x) * 4;
                    const dstPos = ((image.height - 1 - y) * image.width + x) * (preserveAlpha ? 4 : 3);
                    
                    pixels[dstPos] = image.data[srcPos + 2];     // B
                    pixels[dstPos + 1] = image.data[srcPos + 1]; // G
                    pixels[dstPos + 2] = image.data[srcPos];     // R
                    
                    if (preserveAlpha) {
                        pixels[dstPos + 3] = image.data[srcPos + 3]; // A
                    }
                }
            }
            
            // Combine header and pixel data for this image
            const imageData = new Uint8Array(infoHeader.length + pixels.length);
            imageData.set(infoHeader, 0);
            imageData.set(pixels, infoHeader.length);
            
            imageDataChunks.push(imageData);
            offset += imageData.length;
        });
        
        // Combine all parts
        const icoFile = new Uint8Array(
            header.length + 
            directoryEntries.reduce((sum, entry) => sum + entry.length, 0) + 
            imageDataChunks.reduce((sum, chunk) => sum + chunk.length, 0)
        );
        
        let pos = 0;
        icoFile.set(header, pos);
        pos += header.length;
        
        directoryEntries.forEach(entry => {
            icoFile.set(entry, pos);
            pos += entry.length;
        });
        
        imageDataChunks.forEach(chunk => {
            icoFile.set(chunk, pos);
            pos += chunk.length;
        });
        
        return icoFile;
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
        
        // Add ICO info
        const info = document.createElement('p');
        info.className = 'format-info';
        const sizes = Array.from(icoSizes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => `${checkbox.value}×${checkbox.value}`)
            .join(', ');
        info.textContent = `ICO with sizes: ${sizes}`;
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
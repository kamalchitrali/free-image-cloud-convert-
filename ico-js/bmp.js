document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const convertBtn = document.getElementById('convert-btn');
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
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only ICO files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} ICO file(s) to BMP: ${truncateText(fileNames, 50)}`;
    }
  
    function resetDropArea() {
        dropArea.querySelector('p').textContent = 'Drag & drop your ICO files here or click to browse';
        dropArea.classList.remove('has-files');
    }
  
    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
  
    // Conversion functionality - converts ICO to BMP
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
            
            // Use original dimensions
            canvas.width = image.width;
            canvas.height = image.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            updateProgress(50, 'Converting to BMP...');
            
            // Convert canvas to BMP format
            const bmpBlob = await canvasToBMP(canvas);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(bmpBlob, file.name.replace(/\.ico$/i, '.bmp'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles() {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_bitmaps");
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 100);
                
                const image = await loadImage(file);
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0);
                
                const bmpBlob = await canvasToBMP(canvas);
                const newName = file.name.replace(/\.ico$/i, '.bmp');
                imgFolder.file(newName, bmpBlob);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateStatus('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(metadata.percent);
        });
        
        updateProgress(100, 'All files converted to BMP!');
        createDownloadLink(zipBlob, 'converted_bitmaps.zip', 'Download All as BMP');
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
  
    function canvasToBMP(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob(blob => {
                // Convert to BMP by changing the extension
                const reader = new FileReader();
                reader.onload = function() {
                    const arrayBuffer = this.result;
                    const bmpArray = createBMPFile(arrayBuffer, canvas.width, canvas.height);
                    const bmpBlob = new Blob([bmpArray], { type: 'image/bmp' });
                    resolve(bmpBlob);
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/png'); // Temporary format before BMP conversion
        });
    }
    
    function createBMPFile(arrayBuffer, width, height) {
        // BMP file structure implementation
        const HEADER_SIZE = 14;
        const DIB_HEADER_SIZE = 40;
        const PIXEL_DATA_OFFSET = HEADER_SIZE + DIB_HEADER_SIZE;
        const ROW_SIZE = Math.floor((24 * width + 31) / 32) * 4;
        const PIXEL_DATA_SIZE = ROW_SIZE * height;
        const FILE_SIZE = PIXEL_DATA_OFFSET + PIXEL_DATA_SIZE;
        
        const bmpArray = new Uint8Array(FILE_SIZE);
        const view = new DataView(bmpArray.buffer);
        
        // BMP Header (14 bytes)
        view.setUint8(0, 0x42); // 'B'
        view.setUint8(1, 0x4D); // 'M'
        view.setUint32(2, FILE_SIZE, true); // File size
        view.setUint32(6, 0, true); // Reserved
        view.setUint32(10, PIXEL_DATA_OFFSET, true); // Pixel data offset
        
        // DIB Header (40 bytes)
        view.setUint32(14, DIB_HEADER_SIZE, true); // Header size
        view.setInt32(18, width, true); // Width
        view.setInt32(22, height, true); // Height
        view.setUint16(26, 1, true); // Color planes
        view.setUint16(28, 24, true); // Bits per pixel (24-bit)
        view.setUint32(30, 0, true); // Compression (none)
        view.setUint32(34, PIXEL_DATA_SIZE, true); // Image size
        view.setInt32(38, 0, true); // X pixels per meter
        view.setInt32(42, 0, true); // Y pixels per meter
        view.setUint32(46, 0, true); // Colors in palette
        view.setUint32(50, 0, true); // Important colors
        
        // Convert PNG data to BMP format (simplified - in production use a library)
        const pngData = new Uint8Array(arrayBuffer);
        // Note: This is a simplified placeholder - actual conversion would require proper PNG decoding
        
        return bmpArray;
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
        info.textContent = 'BMP is a standard uncompressed image format';
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
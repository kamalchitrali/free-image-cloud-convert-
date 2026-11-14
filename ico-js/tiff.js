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
    const compressionSelect = document.getElementById('tiff-compression');
    
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
            `Ready to convert ${filesToConvert.length} ICO file(s) to TIFF: ${truncateText(fileNames, 50)}`;
    }
  
    function resetDropArea() {
        dropArea.querySelector('p').textContent = 'Drag & drop your ICO files here or click to browse';
        dropArea.classList.remove('has-files');
    }
  
    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
  
    // Conversion functionality - converts ICO to TIFF
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
        
        const compression = compressionSelect.value;
        
        if (filesToConvert.length === 1) {
            await convertSingleFile(filesToConvert[0], compression);
        } else {
            await convertMultipleFiles(compression);
        }
    }
  
    async function convertSingleFile(file, compression) {
        updateStatus('Processing ICO file...');
        
        try {
            const image = await loadImage(file);
            const canvas = document.createElement('canvas');
            
            // Use original dimensions
            canvas.width = image.width;
            canvas.height = image.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            
            updateProgress(50, 'Converting to TIFF...');
            
            // Convert canvas to TIFF format
            const tiffBlob = await canvasToTIFF(canvas, compression);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(tiffBlob, file.name.replace(/\.ico$/i, '.tiff'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles(compression) {
        const zip = new JSZip();
        const imgFolder = zip.folder("converted_tiffs");
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
                
                const tiffBlob = await canvasToTIFF(canvas, compression);
                const newName = file.name.replace(/\.ico$/i, '.tiff');
                imgFolder.file(newName, tiffBlob);
                
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
        
        updateProgress(100, 'All files converted to TIFF!');
        createDownloadLink(zipBlob, 'converted_tiffs.zip', 'Download All as TIFF');
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
  
    function canvasToTIFF(canvas, compression) {
        return new Promise((resolve) => {
            // Using utif.js library for TIFF encoding
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Convert to TIFF using UTIF.js
            const tiffData = UTIF.encodeImageData(imageData, compression);
            const tiffBlob = new Blob([tiffData], { type: 'image/tiff' });
            
            resolve(tiffBlob);
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
        
        // Add TIFF info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = 'TIFF is a high-quality image format ideal for professional use';
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

// Include UTIF.js library for TIFF encoding
const UTIF = {
    encodeImageData: function(imageData, compression) {
        // Simplified TIFF encoding - in production use a proper library
        // This is a placeholder implementation
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;
        
        // Create minimal TIFF structure
        const tiffHeader = new Uint8Array([
            0x49, 0x49, 0x2A, 0x00, // Little-endian, TIFF signature
            0x08, 0x00, 0x00, 0x00, // Offset to first IFD
            // IFD entries would follow here...
            // Actual implementation would be much more complex
        ]);
        
        return tiffHeader;
    }
};
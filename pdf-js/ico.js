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
    const sizeSelect = document.getElementById('ico-size');
    const pageSelect = document.getElementById('page-select');
    
    // PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';
    
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
  
    // Process files - only accepts PDF
    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPDF) {
                showToast(`Skipped ${file.name}: Only PDF files are supported`);
            }
            return isPDF;
        });
        
        if (filesToConvert.length > 0) {
            updateDropAreaText();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only PDF files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} PDF file(s) to ICO: ${truncateText(fileNames, 50)}`;
    }
  
    function resetDropArea() {
        dropArea.querySelector('p').textContent = 'Drag & drop your PDF files here or click to browse';
        dropArea.classList.remove('has-files');
    }
  
    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
  
    // Conversion functionality - converts PDF to ICO
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one PDF file to convert');
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
        
        const size = parseInt(sizeSelect.value);
        const convertAllPages = pageSelect.value === 'all';
        
        if (filesToConvert.length === 1) {
            await convertSinglePDF(filesToConvert[0], size, convertAllPages);
        } else {
            await convertMultiplePDFs(size, convertAllPages);
        }
    }
  
    async function convertSinglePDF(file, size, convertAllPages) {
        updateStatus('Loading PDF document...');
        
        try {
            const pdfData = await readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
            
            const pageCount = convertAllPages ? pdf.numPages : 1;
            const zip = new JSZip();
            let processedPages = 0;
            
            for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                updateProgress((processedPages / pageCount) * 100);
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({scale: 1.0});
                
                // Calculate scale to fit desired icon size
                const scale = Math.min(
                    size / viewport.width,
                    size / viewport.height
                );
                const scaledViewport = page.getViewport({scale});
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = size;
                canvas.width = size;
                
                // Center the PDF content on the canvas
                const xOffset = (size - scaledViewport.width) / 2;
                const yOffset = (size - scaledViewport.height) / 2;
                
                await page.render({
                    canvasContext: context,
                    viewport: scaledViewport,
                    transform: [1, 0, 0, 1, xOffset, yOffset]
                }).promise;
                
                // Convert canvas to ICO
                const icoBlob = await canvasToICO(canvas);
                const pageSuffix = convertAllPages ? `_page${pageNum}` : '';
                zip.file(`${file.name.replace(/\.pdf$/i, '')}${pageSuffix}.ico`, icoBlob);
                
                processedPages++;
            }
            
            updateStatus('Creating download...');
            const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
                updateProgress(metadata.percent);
            });
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(zipBlob, `${file.name.replace(/\.pdf$/i, '')}_icons.zip`, 'Download ICO Files');
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultiplePDFs(size, convertAllPages) {
        const masterZip = new JSZip();
        let processedFiles = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing file ${processedFiles + 1} of ${filesToConvert.length}...`);
                updateProgress((processedFiles / filesToConvert.length) * 50);
                
                const pdfData = await readFileAsArrayBuffer(file);
                const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
                
                const pageCount = convertAllPages ? pdf.numPages : 1;
                const fileZip = new JSZip();
                let processedPages = 0;
                
                for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                    updateStatus(`Processing ${file.name} - page ${pageNum}...`);
                    updateProgress(50 + (processedFiles / filesToConvert.length) * 50 * (processedPages / pageCount));
                    
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({scale: 1.0});
                    const scale = Math.min(
                        size / viewport.width,
                        size / viewport.height
                    );
                    const scaledViewport = page.getViewport({scale});
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = size;
                    canvas.width = size;
                    
                    const xOffset = (size - scaledViewport.width) / 2;
                    const yOffset = (size - scaledViewport.height) / 2;
                    
                    await page.render({
                        canvasContext: context,
                        viewport: scaledViewport,
                        transform: [1, 0, 0, 1, xOffset, yOffset]
                    }).promise;
                    
                    const icoBlob = await canvasToICO(canvas);
                    const pageSuffix = convertAllPages ? `_page${pageNum}` : '';
                    fileZip.file(`${file.name.replace(/\.pdf$/i, '')}${pageSuffix}.ico`, icoBlob);
                    
                    processedPages++;
                }
                
                const fileZipBlob = await fileZip.generateAsync({type: 'blob'});
                masterZip.file(`${file.name.replace(/\.pdf$/i, '')}.zip`, fileZipBlob);
                
                processedFiles++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateStatus('Creating final archive...');
        const masterZipBlob = await masterZip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(50 + (metadata.percent * 0.5));
        });
        
        updateProgress(100, 'All files converted!');
        createDownloadLink(masterZipBlob, 'converted_icons.zip', 'Download All ICO Files');
    }
  
    // Helper functions
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    function canvasToICO(canvas) {
        return new Promise((resolve) => {
            // Create a temporary canvas to ensure 32-bit ARGB format
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw white background first (for transparent areas)
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Create ICO file structure
            const ico = createICOFile(imageData);
            
            // Convert to Blob
            const blob = new Blob([ico], { type: 'image/x-icon' });
            resolve(blob);
        });
    }
    
    function createICOFile(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const bpp = 32; // bits per pixel
        const size = width * height * 4 + 40; // 40 bytes for header
        
        // ICO header (6 bytes)
        const header = new Uint8Array([
            0, 0, // Reserved (must be 0)
            1, 0, // Type (1 for ICO)
            1, 0  // Number of images
        ]);
        
        // Image directory entry (16 bytes)
        const entry = new Uint8Array([
            width, height, 0, 0, // Width, Height (0 means 256)
            0,                   // Number of colors in palette (0 for no palette)
            0,                   // Reserved
            1, 0, 0, 0,          // Color planes (1)
            bpp, 0, 0, 0,        // Bits per pixel
            size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff, // Size of image data
            22, 0, 0, 0          // Offset to image data (6 + 16)
        ]);
        
        // BITMAPINFOHEADER (40 bytes)
        const infoHeader = new Uint8Array([
            40, 0, 0, 0,        // Size of this header (40 bytes)
            width & 0xff, (width >> 8) & 0xff, (width >> 16) & 0xff, (width >> 24) & 0xff, // Width
            height * 2 & 0xff, (height * 2 >> 8) & 0xff, (height * 2 >> 16) & 0xff, (height * 2 >> 24) & 0xff, // Height (×2)
            1, 0,                // Planes (1)
            bpp, 0,             // Bits per pixel
            0, 0, 0, 0,         // Compression (none)
            0, 0, 0, 0,         // Size of image (can be 0 for uncompressed)
            0, 0, 0, 0,         // X pixels per meter (unused)
            0, 0, 0, 0,         // Y pixels per meter (unused)
            0, 0, 0, 0,         // Colors in color table (0 for no palette)
            0, 0, 0, 0          // Important color count (0 means all)
        ]);
        
        // Pixel data (ARGB format, bottom-up)
        const pixels = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcPos = (y * width + x) * 4;
                const dstPos = ((height - 1 - y) * width + x) * 4;
                
                // BGRA format (little-endian)
                pixels[dstPos] = imageData.data[srcPos + 2];     // B
                pixels[dstPos + 1] = imageData.data[srcPos + 1]; // G
                pixels[dstPos + 2] = imageData.data[srcPos];     // R
                pixels[dstPos + 3] = imageData.data[srcPos + 3]; // A
            }
        }
        
        // Combine all parts
        const icoFile = new Uint8Array(header.length + entry.length + infoHeader.length + pixels.length);
        icoFile.set(header, 0);
        icoFile.set(entry, header.length);
        icoFile.set(infoHeader, header.length + entry.length);
        icoFile.set(pixels, header.length + entry.length + infoHeader.length);
        
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
        info.textContent = 'ICO is the standard Windows icon format';
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
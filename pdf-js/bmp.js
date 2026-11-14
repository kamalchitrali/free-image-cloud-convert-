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
    const dpiSelect = document.getElementById('dpi-setting');
    const pageRangeInput = document.getElementById('page-range');
    
    // File handling
    let filesToConvert = [];
    
    // PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';
    
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
            `Ready to convert ${filesToConvert.length} PDF file(s) to BMP: ${truncateText(fileNames, 50)}`;
    }
  
    function resetDropArea() {
        dropArea.querySelector('p').textContent = 'Drag & drop your PDF files here or click to browse';
        dropArea.classList.remove('has-files');
    }
  
    function truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
  
    // Parse page range input (e.g., "1,3-5,7")
    function parsePageRange(rangeStr, pageCount) {
        if (!rangeStr.trim()) {
            return Array.from({length: pageCount}, (_, i) => i + 1);
        }
        
        const pages = new Set();
        const ranges = rangeStr.split(',');
        
        for (const range of ranges) {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= pageCount) pages.add(i);
                }
            } else {
                const page = Number(range);
                if (page >= 1 && page <= pageCount) pages.add(page);
            }
        }
        
        return Array.from(pages).sort((a, b) => a - b);
    }
  
    // Conversion functionality - converts PDF to BMP
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
        
        const dpi = parseInt(dpiSelect.value);
        const scale = dpi / 72; // PDF.js uses 72 DPI as base
        
        if (filesToConvert.length === 1) {
            await convertSinglePDF(filesToConvert[0], scale);
        } else {
            await convertMultiplePDFs(scale);
        }
    }
  
    async function convertSinglePDF(file, scale) {
        updateStatus('Loading PDF document...');
        
        try {
            const pdfData = await readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
            
            const pageRange = parsePageRange(pageRangeInput.value, pdf.numPages);
            if (pageRange.length === 0) {
                throw new Error('No valid pages selected');
            }
            
            const zip = new JSZip();
            let processedPages = 0;
            
            for (const pageNum of pageRange) {
                updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                updateProgress((processedPages / pageRange.length) * 100);
                
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({scale});
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                // Convert canvas to BMP
                const bmpBlob = await canvasToBMP(canvas);
                zip.file(`page_${pageNum}.bmp`, bmpBlob);
                
                processedPages++;
            }
            
            updateStatus('Creating download...');
            const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
                updateProgress(metadata.percent);
            });
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(zipBlob, `${file.name.replace(/\.pdf$/i, '')}_converted.zip`, 'Download All Pages');
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultiplePDFs(scale) {
        const masterZip = new JSZip();
        let processedFiles = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing file ${processedFiles + 1} of ${filesToConvert.length}...`);
                updateProgress((processedFiles / filesToConvert.length) * 50);
                
                const pdfData = await readFileAsArrayBuffer(file);
                const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
                
                const pageRange = parsePageRange(pageRangeInput.value, pdf.numPages);
                if (pageRange.length === 0) continue;
                
                const fileZip = new JSZip();
                let processedPages = 0;
                
                for (const pageNum of pageRange) {
                    updateStatus(`Processing ${file.name} - page ${pageNum}...`);
                    updateProgress(50 + (processedFiles / filesToConvert.length) * 50 * (processedPages / pageRange.length));
                    
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({scale});
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    const bmpBlob = await canvasToBMP(canvas);
                    fileZip.file(`page_${pageNum}.bmp`, bmpBlob);
                    
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
        createDownloadLink(masterZipBlob, 'converted_pdfs.zip', 'Download All Files');
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
    
    function canvasToBMP(canvas) {
        return new Promise((resolve) => {
            // Simplified BMP conversion - in production use a proper library
            const width = canvas.width;
            const height = canvas.height;
            
            // Create minimal BMP structure
            const HEADER_SIZE = 14;
            const DIB_HEADER_SIZE = 40;
            const PIXEL_DATA_OFFSET = HEADER_SIZE + DIB_HEADER_SIZE;
            const PIXEL_DATA_SIZE = width * height * 3; // 24-bit RGB
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
            
            // Get pixel data (simplified - actual implementation would need proper conversion)
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, width, height);
            
            // Write pixel data (BGR format, bottom-up)
            let offset = PIXEL_DATA_OFFSET;
            for (let y = height - 1; y >= 0; y--) {
                for (let x = 0; x < width; x++) {
                    const pos = (y * width + x) * 4;
                    bmpArray[offset++] = imageData.data[pos + 2]; // B
                    bmpArray[offset++] = imageData.data[pos + 1]; // G
                    bmpArray[offset++] = imageData.data[pos];     // R
                }
                // Add padding to make each row a multiple of 4 bytes
                while (offset % 4 !== 0) {
                    bmpArray[offset++] = 0;
                }
            }
            
            const blob = new Blob([bmpArray], { type: 'image/bmp' });
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
        info.textContent = 'BMP is an uncompressed image format ideal for editing';
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
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
    const tiffResolution = document.getElementById('tiff-resolution');
    const tiffCompression = document.getElementById('tiff-compression');
    const tiffColor = document.getElementById('tiff-color');
    
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
            updateFileList();
            dropArea.classList.add('has-files');
        } else if (files.length > 0) {
            showToast('Please select only PDF files');
        }
    }
  
    function updateDropAreaText() {
        const fileNames = filesToConvert.map(file => file.name).join(', ');
        dropArea.querySelector('p').textContent = 
            `Ready to convert ${filesToConvert.length} PDF file(s) to TIFF: ${truncateText(fileNames, 50)}`;
    }
  
    function updateFileList() {
        fileList.innerHTML = '<h3>Selected PDF Files</h3>';
        
        filesToConvert.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-file-pdf file-icon"></i>
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
        dropArea.querySelector('p').textContent = 'Drag & drop your PDF files here or click to browse';
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
  
    // Conversion functionality - converts to TIFF
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
        
        if (filesToConvert.length === 1) {
            await convertSinglePDF(filesToConvert[0]);
        } else {
            await convertMultiplePDFs();
        }
    }
  
    async function convertSinglePDF(file) {
        updateStatus('Loading PDF file...');
        
        try {
            // Load the PDF
            const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
            const totalPages = pdf.numPages;
            
            updateStatus(`Converting ${totalPages} page${totalPages > 1 ? 's' : ''} to TIFF...`);
            
            // Prepare array for all page images
            const pageImages = [];
            
            // Convert each page
            for (let i = 1; i <= totalPages; i++) {
                updateProgress(((i - 1) / totalPages) * 90, `Processing page ${i} of ${totalPages}...`);
                
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: tiffResolution.value / 72 });
                
                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                // Render PDF page to canvas
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                // Get image data based on color mode
                let imageData;
                if (tiffColor.value === 'monochrome') {
                    imageData = convertToMonochrome(canvas);
                } else if (tiffColor.value === 'grayscale') {
                    imageData = convertToGrayscale(canvas);
                } else {
                    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                }
                
                pageImages.push({
                    width: canvas.width,
                    height: canvas.height,
                    data: imageData.data,
                    color: tiffColor.value
                });
            }
            
            updateProgress(95, 'Creating TIFF file...');
            
            // Create multi-page TIFF
            const tiffBlob = await createMultiPageTIFF(pageImages);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(
                tiffBlob, 
                file.name.replace(/\.pdf$/i, '.tiff'),
                'Download TIFF'
            );
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultiplePDFs() {
        const zip = new JSZip();
        let totalPages = 0;
        let processedPages = 0;
        
        // First count total pages for progress tracking
        for (const file of filesToConvert) {
            try {
                const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
                totalPages += pdf.numPages;
            } catch (error) {
                console.error(`Error counting pages in ${file.name}:`, error);
            }
        }
        
        if (totalPages === 0) {
            throw new Error('No pages found in selected PDFs');
        }
        
        // Process each file
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${file.name}...`);
                
                const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
                const totalFilePages = pdf.numPages;
                
                // Prepare array for all page images
                const pageImages = [];
                
                // Convert each page
                for (let i = 1; i <= totalFilePages; i++) {
                    processedPages++;
                    updateProgress((processedPages / totalPages) * 90, `Processing page ${i} of ${totalFilePages}...`);
                    
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: tiffResolution.value / 72 });
                    
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    // Render PDF page to canvas
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    // Get image data based on color mode
                    let imageData;
                    if (tiffColor.value === 'monochrome') {
                        imageData = convertToMonochrome(canvas);
                    } else if (tiffColor.value === 'grayscale') {
                        imageData = convertToGrayscale(canvas);
                    } else {
                        imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    }
                    
                    pageImages.push({
                        width: canvas.width,
                        height: canvas.height,
                        data: imageData.data,
                        color: tiffColor.value
                    });
                }
                
                updateProgress(95 + (processedPages / totalPages * 5), 'Creating TIFF file...');
                
                // Create multi-page TIFF for this PDF
                const tiffBlob = await createMultiPageTIFF(pageImages);
                
                // Add to ZIP
                zip.file(file.name.replace(/\.pdf$/i, '.tiff'), tiffBlob);
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateProgress(98, 'Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'});
        
        updateProgress(100, 'All files converted to TIFF!');
        createDownloadLink(zipBlob, 'converted_pdfs.zip', 'Download All as TIFF');
    }
    
    // Convert canvas to monochrome (1-bit) image data
    function convertToMonochrome(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create new 1-bit image data
        const monoData = new Uint8Array(Math.ceil(canvas.width * canvas.height / 8));
        let monoIndex = 0;
        let bitPos = 7;
        
        for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale using luminance formula
            const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
            const bit = gray < 128 ? 1 : 0;
            
            monoData[monoIndex] |= (bit << bitPos);
            
            if (--bitPos < 0) {
                bitPos = 7;
                monoIndex++;
            }
        }
        
        return {
            width: canvas.width,
            height: canvas.height,
            data: monoData
        };
    }
    
    // Convert canvas to grayscale (8-bit) image data
    function convertToGrayscale(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const grayData = new Uint8Array(canvas.width * canvas.height);
        
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            // Convert to grayscale using luminance formula
            grayData[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        }
        
        return {
            width: canvas.width,
            height: canvas.height,
            data: grayData
        };
    }
    
    // Create multi-page TIFF from array of images
    function createMultiPageTIFF(images) {
        return new Promise((resolve) => {
            // Prepare IFDs (Image File Directories) for each page
            const ifds = [];
            
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                const compression = tiffCompression.value;
                
                // Convert image data to TIFF format
                let tiffData;
                if (img.color === 'monochrome') {
                    tiffData = UTIF.encodeImage(
                        img.data, 
                        img.width, 
                        img.height, 
                        1, // 1-bit
                        0, // photometric interpretation (0 for white-is-zero)
                        compression
                    );
                } else if (img.color === 'grayscale') {
                    tiffData = UTIF.encodeImage(
                        img.data, 
                        img.width, 
                        img.height, 
                        8, // 8-bit grayscale
                        1, // photometric interpretation (1 for black-is-zero)
                        compression
                    );
                } else {
                    tiffData = UTIF.encodeImage(
                        img.data, 
                        img.width, 
                        img.height, 
                        24, // 24-bit RGB
                        2, // photometric interpretation (2 for RGB)
                        compression
                    );
                }
                
                ifds.push(tiffData);
            }
            
            // Combine all IFDs into a multi-page TIFF
            const tiffBuffer = UTIF.encode(ifds);
            const tiffBlob = new Blob([tiffBuffer], { type: 'image/tiff' });
            
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
        info.textContent = `TIFF (${tiffColor.value}, ${tiffCompression.value} compression, ${tiffResolution.value} DPI)`;
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
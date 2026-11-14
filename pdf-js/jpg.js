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
    const jpgQuality = document.getElementById('jpg-quality');
    const qualityValue = document.getElementById('quality-value');
    const jpgResolution = document.getElementById('jpg-resolution');
    const convertAllPages = document.getElementById('convert-all-pages');
    
    // File handling
    let filesToConvert = [];
    
    // Update quality value display
    jpgQuality.addEventListener('input', function() {
        qualityValue.textContent = `${this.value}%`;
    });
    
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
            `Ready to convert ${filesToConvert.length} PDF file(s) to JPG: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality - converts to JPG
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
            const convertAll = convertAllPages.checked;
            const pagesToConvert = convertAll ? totalPages : 1;
            
            updateStatus(`Converting ${convertAll ? 'all' : 'first'} page${pagesToConvert > 1 ? 's' : ''}...`);
            
            // Create ZIP if converting multiple pages
            let zip;
            if (pagesToConvert > 1) {
                zip = new JSZip();
            }
            
            // Convert each page
            for (let i = 1; i <= pagesToConvert; i++) {
                updateProgress(((i - 1) / pagesToConvert) * 90, `Processing page ${i} of ${pagesToConvert}...`);
                
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: jpgResolution.value / 72 });
                
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
                
                // Convert to JPG
                const jpgBlob = await canvasToJPG(canvas, jpgQuality.value / 100);
                
                if (pagesToConvert > 1) {
                    // Add to ZIP
                    const pageName = file.name.replace(/\.pdf$/i, `_page_${i}.jpg`);
                    zip.file(pageName, jpgBlob);
                } else {
                    // Single page - create direct download
                    updateProgress(100, 'Conversion complete!');
                    createDownloadLink(
                        jpgBlob, 
                        file.name.replace(/\.pdf$/i, '.jpg'),
                        `Download Page ${i} as JPG`
                    );
                }
            }
            
            if (pagesToConvert > 1) {
                updateProgress(95, 'Creating ZIP archive...');
                const zipBlob = await zip.generateAsync({type: 'blob'});
                
                updateProgress(100, 'All pages converted to JPG!');
                createDownloadLink(
                    zipBlob, 
                    file.name.replace(/\.pdf$/i, '_pages.zip'),
                    'Download All Pages as JPG'
                );
            }
            
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
                totalPages += convertAllPages.checked ? pdf.numPages : 1;
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
                const convertAll = convertAllPages.checked;
                const pagesToConvert = convertAll ? pdf.numPages : 1;
                
                // Convert each page
                for (let i = 1; i <= pagesToConvert; i++) {
                    processedPages++;
                    updateProgress((processedPages / totalPages) * 95, `Processing page ${i} of ${pagesToConvert}...`);
                    
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: jpgResolution.value / 72 });
                    
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
                    
                    // Convert to JPG
                    const jpgBlob = await canvasToJPG(canvas, jpgQuality.value / 100);
                    
                    // Add to ZIP
                    const pageName = file.name.replace(/\.pdf$/i, `_page_${i}.jpg`);
                    zip.file(pageName, jpgBlob);
                }
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateProgress(98, 'Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'});
        
        updateProgress(100, 'All files converted to JPG!');
        createDownloadLink(zipBlob, 'converted_pdfs.zip', 'Download All as JPG');
    }
  
    // Helper functions
    function canvasToJPG(canvas, quality) {
        return new Promise((resolve) => {
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', quality);
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
        
        // Add JPG info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = `JPG at ${jpgQuality.value}% quality, ${jpgResolution.value} DPI`;
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
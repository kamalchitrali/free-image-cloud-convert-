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
    const qualitySlider = document.getElementById('webp-quality');
    const qualityValue = document.getElementById('quality-value');
    const dpiSelect = document.getElementById('dpi-setting');
    const pageRangeInput = document.getElementById('page-range');
    
    // PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';
    
    // Update quality value display
    qualitySlider.addEventListener('input', function() {
        qualityValue.textContent = `${this.value}%`;
    });
    
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
            `Ready to convert ${filesToConvert.length} PDF file(s) to WebP: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality - converts PDF to WebP
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
        
        const quality = parseInt(qualitySlider.value);
        const dpi = parseInt(dpiSelect.value);
        const scale = dpi / 72; // PDF.js uses 72 DPI as base
        
        if (filesToConvert.length === 1) {
            await convertSinglePDF(filesToConvert[0], quality, scale);
        } else {
            await convertMultiplePDFs(quality, scale);
        }
    }
  
    async function convertSinglePDF(file, quality, scale) {
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
                
                // Set white background
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                // Convert canvas to WebP
                const webpBlob = await canvasToWebP(canvas, quality);
                zip.file(`page_${pageNum}.webp`, webpBlob);
                
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
  
    async function convertMultiplePDFs(quality, scale) {
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
                    
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    const webpBlob = await canvasToWebP(canvas, quality);
                    fileZip.file(`page_${pageNum}.webp`, webpBlob);
                    
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
    
    function canvasToWebP(canvas, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('WebP conversion failed'));
                    return;
                }
                resolve(blob);
            }, 'image/webp', quality/100);
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
        
        // Add WebP info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = 'WebP provides superior compression with quality preservation';
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
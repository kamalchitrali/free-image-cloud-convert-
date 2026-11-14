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
    const pdfQualitySelect = document.getElementById('pdf-quality');
    const pdfOrientationSelect = document.getElementById('pdf-orientation');
    
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
            `Ready to convert ${filesToConvert.length} TIFF file(s) to PDF: ${truncateText(fileNames, 50)}`;
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
  
    // Conversion functionality - converts to PDF
    convertBtn.addEventListener('click', async function() {
        if (filesToConvert.length === 0) {
            showToast('Please select at least one TIFF file to convert');
            return;
        }
  
        const quality = parseFloat(pdfQualitySelect.value);
        const orientation = pdfOrientationSelect.value;
        
        try {
            await startConversion(quality, orientation);
        } catch (error) {
            console.error('Conversion failed:', error);
            showToast('Conversion failed: ' + error.message, 'error');
            closeModal();
        }
    });
  
    async function startConversion(quality, orientation) {
        modal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';
        
        // Load necessary libraries dynamically
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/tiff.js@1.0.0/dist/tiff.min.js');
        
        if (filesToConvert.length === 1) {
            await convertSingleFile(filesToConvert[0], quality, orientation);
        } else {
            await convertMultipleFiles(quality, orientation);
        }
    }
  
    async function convertSingleFile(file, quality, orientation) {
        updateStatus('Processing TIFF file...');
        
        try {
            const imageData = await loadTIFFImage(file);
            updateProgress(30, 'Creating PDF...');
            
            // Create PDF
            const pdfBlob = await imageDataToPDF(imageData, file.name, quality, orientation);
            
            updateProgress(100, 'Conversion complete!');
            createDownloadLink(pdfBlob, file.name.replace(/\.tiff?$/i, '.pdf'));
            
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }
  
    async function convertMultipleFiles(quality, orientation) {
        const zip = new JSZip();
        let processedCount = 0;
        
        for (const file of filesToConvert) {
            try {
                updateStatus(`Processing ${processedCount + 1} of ${filesToConvert.length} files...`);
                updateProgress((processedCount / filesToConvert.length) * 80);
                
                const imageData = await loadTIFFImage(file);
                const pdfBlob = await imageDataToPDF(imageData, file.name, quality, orientation);
                const newName = file.name.replace(/\.tiff?$/i, '.pdf');
                zip.file(newName, pdfBlob);
                
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                // Continue with next file even if one fails
            }
        }
        
        updateStatus('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({type: 'blob'}, metadata => {
            updateProgress(80 + (metadata.percent * 0.2)); // Last 20% for zip creation
        });
        
        updateProgress(100, 'All files converted to PDF!');
        createDownloadLink(zipBlob, 'converted_pdfs.zip', 'Download All as PDF');
    }
  
    // Helper functions
    async function loadTIFFImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const tiff = new Tiff({buffer: e.target.result});
                    const canvas = tiff.toCanvas();
                    resolve({
                        canvas: canvas,
                        width: canvas.width,
                        height: canvas.height,
                        name: file.name
                    });
                } catch (error) {
                    reject(new Error('Failed to parse TIFF file'));
                }
            };
            
            reader.onerror = function() {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    async function imageDataToPDF(imageData, filename, quality, orientation) {
        return new Promise((resolve) => {
            const { jsPDF } = window.jspdf;
            const canvas = imageData.canvas;
            
            // Determine orientation
            let pdfOrientation = 'portrait';
            if (orientation === 'landscape') {
                pdfOrientation = 'landscape';
            } else if (orientation === 'auto') {
                pdfOrientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
            }
            
            // Create PDF
            const pdf = new jsPDF({
                orientation: pdfOrientation,
                unit: 'mm'
            });
            
            // Convert canvas to JPEG with specified quality
            const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // Calculate dimensions
            const imgProps = pdf.getImageProperties(imageDataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            // Add image to PDF
            pdf.addImage(imageDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            // Generate PDF blob
            const pdfBlob = pdf.output('blob');
            resolve(pdfBlob);
        });
    }
    
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (url.includes('jspdf') && window.jspdf) return resolve();
            if (url.includes('tiff') && window.Tiff) return resolve();
            
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
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
        
        // Add PDF info
        const info = document.createElement('p');
        info.className = 'format-info';
        info.textContent = 'PDF is a universal document format';
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
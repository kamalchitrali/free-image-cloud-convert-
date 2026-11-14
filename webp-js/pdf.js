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
    
    // PDF Settings
    const pageSizeSelect = document.getElementById('page-size');
    const orientationSelect = document.getElementById('orientation');
    const marginInput = document.getElementById('margin');
    
    // File handling
    let filesToConvert = [];
    const { jsPDF } = window.jspdf;
    let JSZip = window.JSZip;

    // Initialize ZIP if not loaded
    if (!JSZip && typeof require !== 'undefined') {
        JSZip = require('jszip');
    }

    // Event Handlers ========================================================
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area
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

    // File handling
    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', function() {
        if (this.files.length) handleFiles(this.files);
    });

    // Conversion
    convertBtn.addEventListener('click', async function() {
        if (!filesToConvert.length) {
            showToast('Please select WebP files to convert', 'warning');
            return;
        }
        try {
            await startConversion();
        } catch (error) {
            handleConversionError(error);
        }
    });

    // UI Functions =========================================================

    function handleFiles(files) {
        filesToConvert = Array.from(files).filter(file => {
            const isWebP = file.type === 'image/webp' || /\.webp$/i.test(file.name);
            if (!isWebP) showToast(`Skipped ${file.name}: Not a WebP file`, 'warning');
            return isWebP;
        });
        
        if (filesToConvert.length) {
            updateFileList();
            dropArea.classList.add('has-files');
        }
    }

    function updateFileList() {
        fileList.innerHTML = filesToConvert.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <i class="fas fa-file-image file-icon"></i>
                    <div>
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <i class="fas fa-times remove-file" data-index="${index}"></i>
            </div>
        `).join('');

        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', () => {
                filesToConvert.splice(btn.dataset.index, 1);
                filesToConvert.length ? updateFileList() : resetDropArea();
            });
        });
    }

    function resetDropArea() {
        dropArea.classList.remove('has-files');
        fileList.innerHTML = '<p>No files selected</p>';
    }

    // Conversion Functions =================================================

    async function startConversion() {
        showModal();
        try {
            if (filesToConvert.length === 1) {
                await convertSingleFile(filesToConvert[0]);
            } else {
                await convertMultipleFiles();
            }
        } finally {
            updateProgress(100, 'Conversion complete!');
        }
    }

    async function convertSingleFile(file) {
        try {
            updateProgress(0, 'Processing WebP file...');
            const canvas = await webpToCanvas(file);
            
            updateProgress(30, 'Creating PDF...');
            const pdf = await createPDF(canvas, getPdfSettings());
            
            updateProgress(80, 'Finalizing document...');
            await createDownload(pdf.output('blob'), file.name.replace(/\.webp$/i, '.pdf'));
        } catch (error) {
            throw new Error(`Failed to convert ${file.name}: ${error.message}`);
        }
    }

    async function convertMultipleFiles() {
        const zip = new JSZip();
        const pdfFolder = zip.folder("converted_pdfs");
        const settings = getPdfSettings();

        for (const [index, file] of filesToConvert.entries()) {
            try {
                updateProgress((index / filesToConvert.length) * 80, `Processing ${file.name}...`);
                const canvas = await webpToCanvas(file);
                const pdf = await createPDF(canvas, settings);
                pdfFolder.file(file.name.replace(/\.webp$/i, '.pdf'), pdf.output('blob'));
            } catch (error) {
                console.error(`Skipped ${file.name}:`, error);
            }
        }

        updateProgress(85, 'Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        await createDownload(zipBlob, 'converted_pdfs.zip');
    }

    // Core Utilities =======================================================

    function webpToCanvas(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve(canvas);
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    function createPDF(canvas, settings) {
        return new Promise((resolve, reject) => {
            try {
                const pdf = new jsPDF({
                    orientation: settings.orientation,
                    unit: 'mm',
                    format: settings.pageSize === 'fit' 
                        ? [canvas.width * 0.264583, canvas.height * 0.264583] 
                        : settings.pageSize
                });

                const dimensions = calculateDimensions(canvas, settings);
                const imageData = canvas.toDataURL('image/jpeg', 0.9);
                
                pdf.addImage(imageData, 'JPEG', 
                    dimensions.x, 
                    dimensions.y, 
                    dimensions.width, 
                    dimensions.height
                );
                
                resolve(pdf);
            } catch (error) {
                reject(new Error('PDF creation failed: ' + error.message));
            }
        });
    }

    function calculateDimensions(canvas, settings) {
        const isFit = settings.pageSize === 'fit';
        const pageWidth = isFit ? canvas.width * 0.264583 : getPageWidth(settings.pageSize, settings.orientation);
        const pageHeight = isFit ? canvas.height * 0.264583 : getPageHeight(settings.pageSize, settings.orientation);
        
        const maxWidth = pageWidth - (settings.margin * 2);
        const maxHeight = pageHeight - (settings.margin * 2);
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);

        return {
            width: canvas.width * ratio * 0.264583,
            height: canvas.height * ratio * 0.264583,
            x: (pageWidth - (canvas.width * ratio * 0.264583)) / 2,
            y: (pageHeight - (canvas.height * ratio * 0.264583)) / 2
        };
    }

    // Helper Functions =====================================================

    function getPdfSettings() {
        return {
            pageSize: pageSizeSelect.value,
            orientation: orientationSelect.value,
            margin: parseInt(marginInput.value) || 0
        };
    }

    async function createDownload(blob, filename) {
        return new Promise((resolve) => {
            try {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.className = 'download-btn';
                a.textContent = `Download ${filename}`;
                
                a.addEventListener('click', () => {
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                        resolve();
                    }, 1000);
                });

                downloadSection.innerHTML = '';
                downloadSection.appendChild(a);
                
                if (/Mobile|Android/i.test(navigator.userAgent)) {
                    a.click();
                }
            } catch (error) {
                showToast('Download failed: Please try again', 'error');
                console.error('Download error:', error);
                resolve();
            }
        });
    }

    function showModal() {
        modal.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        downloadSection.innerHTML = '';
    }

    function updateProgress(percent, message) {
        const progress = Math.min(100, Math.max(0, percent));
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        const status = document.querySelector('.status-message') || document.createElement('p');
        status.className = 'status-message';
        status.textContent = message;
        if (!status.parentElement) modal.querySelector('.modal-content').appendChild(status);
    }

    function handleConversionError(error) {
        console.error('Conversion Error:', error);
        showToast(error.message || 'Conversion failed', 'error');
        closeModal();
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    function formatFileSize(bytes) {
        const units = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Page Size Constants
    function getPageWidth(size, orientation) {
        const sizes = {
            a4: [210, 297],
            letter: [216, 279],
            legal: [216, 356]
        };
        return sizes[size][orientation === 'portrait' ? 0 : 1];
    }

    function getPageHeight(size, orientation) {
        const sizes = {
            a4: [297, 210],
            letter: [279, 216],
            legal: [356, 216]
        };
        return sizes[size][orientation === 'portrait' ? 0 : 1];
    }
});

// Add dynamic JSZip loading if needed
if (typeof JSZip === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
}
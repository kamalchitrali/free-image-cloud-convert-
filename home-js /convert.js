document.addEventListener('DOMContentLoaded', function() {
    // File upload functionality
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const outputFormat = document.getElementById('outputFormat');
    const convertBtn = document.getElementById('convertBtn');
    const resultContainer = document.getElementById('resultContainer');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const downloadBtn = document.getElementById('downloadBtn');
    
    let selectedFile = null;
    
    // Drag and drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#4361ee';
        dropzone.style.backgroundColor = 'rgba(67, 97, 238, 0.1)';
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#6c757d';
        dropzone.style.backgroundColor = 'transparent';
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#6c757d';
        dropzone.style.backgroundColor = 'transparent';
        
        if (e.dataTransfer.files.length) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });
    
    // File input change event
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileSelection(fileInput.files[0]);
        }
    });
    
    // Click on dropzone triggers file input
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection
    function handleFileSelection(file) {
        const validExtensions = ['.bmp', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.pdf', '.ico'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(fileExt)) {
            alert('Please select a valid file format (BMP, PNG, JPG, WEBP, TIFF, PDF, ICO)');
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            alert('File size exceeds 50MB limit');
            return;
        }
        
        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        resultContainer.classList.remove('hidden');
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Convert button click
    convertBtn.addEventListener('click', () => {
        if (!selectedFile) {
            alert('Please select a file first');
            return;
        }
        
        // Simulate conversion (in a real app, this would upload to a server)
        setTimeout(() => {
            downloadBtn.href = URL.createObjectURL(selectedFile);
            downloadBtn.download = selectedFile.name.split('.')[0] + '.' + outputFormat.value;
            alert('Conversion complete! Click download to get your file.');
        }, 1500);
    });
    
    // Initialize FAQ functionality
    initFAQs();
});

// FAQ toggle functionality
function initFAQs() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            answer.classList.toggle('active');
            
            // Toggle icon
            const icon = question.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-plus');
                icon.classList.toggle('fa-minus');
            }
        });
    });
}
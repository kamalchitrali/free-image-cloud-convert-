document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('quality-value');
  const convertBtn = document.getElementById('convert-btn');
  const modal = document.getElementById('conversion-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const progressBar = document.getElementById('conversion-progress');
  const progressText = document.getElementById('progress-text');
  const downloadSection = document.getElementById('download-section');
  
  // File handling
  let filesToConvert = [];
  
  // Update quality display
  qualitySlider.addEventListener('input', function() {
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

  // Process files - now only accepts PNG
  function handleFiles(files) {
      filesToConvert = Array.from(files).filter(file => {
          const isPNG = file.type === 'image/png';
          if (!isPNG) {
              showToast(`Skipped ${file.name}: Only PNG files are supported`);
          }
          return isPNG;
      });
      
      if (filesToConvert.length > 0) {
          updateDropAreaText();
          updateFileList();
          dropArea.classList.add('has-files');
      } else if (files.length > 0) {
          showToast('Please select only PNG files');
      }
  }

  function updateDropAreaText() {
      const fileNames = filesToConvert.map(file => file.name).join(', ');
      dropArea.querySelector('p').textContent = 
          `Ready to convert ${filesToConvert.length} PNG file(s) to WebP: ${truncateText(fileNames, 50)}`;
  }

  function updateFileList() {
      fileList.innerHTML = '<h3>Selected PNG Files</h3>';
      
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
      dropArea.querySelector('p').textContent = 'Drag & drop your PNG files here or click to browse';
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

  // Conversion functionality - now only converts to WebP
  convertBtn.addEventListener('click', async function() {
      if (filesToConvert.length === 0) {
          showToast('Please select at least one PNG file to convert');
          return;
      }

      const quality = parseInt(qualitySlider.value) / 100;
      
      try {
          await startConversion(quality);
      } catch (error) {
          console.error('Conversion failed:', error);
          showToast('Conversion failed: ' + error.message, 'error');
          closeModal();
      }
  });

  async function startConversion(quality) {
      modal.style.display = 'flex';
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      downloadSection.innerHTML = '';
      
      if (filesToConvert.length === 1) {
          await convertSingleFile(filesToConvert[0], quality);
      } else {
          await convertMultipleFiles(quality);
      }
  }

  async function convertSingleFile(file, quality) {
      updateStatus('Processing PNG file...');
      
      try {
          const image = await loadImage(file);
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const ctx = canvas.getContext('2d');
          
          // Preserve transparency for WebP
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0);
          
          updateProgress(50, 'Converting to WebP...');
          
          const blob = await canvasToBlob(canvas, 'image/webp', quality);
          
          updateProgress(100, 'Conversion complete!');
          createDownloadLink(blob, file.name.replace(/\.png$/i, '.webp'));
          
      } catch (error) {
          throw new Error(`Failed to convert ${file.name}: ${error.message}`);
      }
  }

  async function convertMultipleFiles(quality) {
      const zip = new JSZip();
      const imgFolder = zip.folder("converted_webp");
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
              
              // Preserve transparency
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0);
              
              const blob = await canvasToBlob(canvas, 'image/webp', quality);
              
              const newName = file.name.replace(/\.png$/i, '.webp');
              imgFolder.file(newName, blob);
              
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
      
      updateProgress(100, 'All files converted to WebP!');
      createDownloadLink(zipBlob, 'converted_webp.zip', 'Download All as WebP');
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

  function canvasToBlob(canvas, mimeType, quality) {
      return new Promise(resolve => {
          canvas.toBlob(resolve, mimeType, quality);
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
      info.textContent = 'WebP offers better compression with quality preservation';
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
  // Add this CSS for toast notifications
  const toastStyles = document.createElement('style');
  toastStyles.textContent = `
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.3s;
    z-index: 10000;
  }
  .toast.show {
    opacity: 1;
  }
  .toast.error {
    background: #f72585;
  }
  .toast.warning {
    background: #f8961e;
  }
  .toast.success {
    background: #4cc9f0;
  }
  `;
  document.head.appendChild(toastStyles);




  





document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById("file-input");
    const dropArea = document.getElementById("drop-area");
    const convertBtn = document.getElementById("convert-btn");
    const fileList = document.getElementById("file-list");
    const qualityInput = document.getElementById("quality");
    const qualityValue = document.getElementById("quality-value");
    const modal = document.getElementById("conversion-modal");
    const progress = document.getElementById("conversion-progress");
    const progressText = document.getElementById("progress-text");
    const downloadSection = document.getElementById("download-section");
    const closeModal = document.querySelector(".close-modal");

    let files = [];

    // Handle click on drop area
    dropArea.addEventListener("click", () => fileInput.click());

    // Handle file input change
    fileInput.addEventListener("change", (e) => {
        files = Array.from(e.target.files).filter(file => 
            file.type === 'image/jpeg' || file.type === 'image/jpg'
        );
        showFileNames();
    });

    // Handle drag over
    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.classList.add("dragover");
    });

    // Handle drag leave
    dropArea.addEventListener("dragleave", () => {
        dropArea.classList.remove("dragover");
    });

    // Handle drop
    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        dropArea.classList.remove("dragover");
        files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'image/jpeg' || file.type === 'image/jpg'
        );
        showFileNames();
    });

    // Update quality value display
    qualityInput.addEventListener("input", () => {
        qualityValue.textContent = `${qualityInput.value}%`;
    });

    // Handle convert button click
    convertBtn.addEventListener("click", async () => {
        if (!files.length) {
            alert("Please select JPG files to convert.");
            return;
        }
        
        modal.style.display = "block";
        progress.style.width = "0%";
        progressText.textContent = "0%";
        downloadSection.innerHTML = "";

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            reader.onload = function(event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob((blob) => {
                        const link = document.createElement("a");
                        link.download = file.name.replace(/\.jpe?g$/i, ".webp");
                        link.href = URL.createObjectURL(blob);
                        link.textContent = `Download ${link.download}`;
                        link.className = "download-link";
                        
                        const linkContainer = document.createElement("div");
                        linkContainer.appendChild(link);
                        downloadSection.appendChild(linkContainer);

                        const percent = Math.round(((i + 1) / files.length) * 100);
                        progress.style.width = `${percent}%`;
                        progressText.textContent = `${percent}%`;

                        if (i === files.length - 1) {
                            document.querySelector(".status-message").textContent = "Conversion complete!";
                        }
                    }, "image/webp", qualityInput.value / 100);
                };
            };

            reader.onerror = function() {
                console.error("Error reading file");
            };

            reader.readAsDataURL(file);
        }
    });

    // Close modal
    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Show file names in the list
    function showFileNames() {
        fileList.innerHTML = "";
        if (files.length === 0) return;

        const listHeader = document.createElement("h3");
        listHeader.textContent = "Selected Files:";
        fileList.appendChild(listHeader);

        files.forEach(file => {
            const item = document.createElement("div");
            item.className = "file-item";
            item.textContent = file.name;
            fileList.appendChild(item);
        });
    }
});
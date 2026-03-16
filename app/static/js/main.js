/* ========================================================================
   PDF Translator — Client-side JavaScript
   ======================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initDropZone();
    initCopyButtons();
    initFormSubmit();
});

/* ---------- Drag-and-Drop File Upload ---------- */
function initDropZone() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("pdfFile");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
    const removeBtn = document.getElementById("removeFile");

    if (!dropZone || !fileInput) return;

    // Drag events
    ["dragenter", "dragover"].forEach((evt) =>
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        })
    );

    ["dragleave", "drop"].forEach((evt) =>
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
        })
    );

    dropZone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            fileInput.files = files;
            showFileName(files[0].name);
        }
    });

    // Normal file select
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            showFileName(fileInput.files[0].name);
        }
    });

    // Remove selected file
    if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fileInput.value = "";
            fileInfo.style.display = "none";
        });
    }

    function showFileName(name) {
        if (fileName) fileName.textContent = name;
        if (fileInfo) fileInfo.style.display = "flex";
    }
}

/* ---------- Copy-to-Clipboard ---------- */
function initCopyButtons() {
    document.querySelectorAll(".btn-copy").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const el = document.getElementById(targetId);
            if (!el) return;

            navigator.clipboard.writeText(el.innerText).then(() => {
                const icon = btn.querySelector("i");
                icon.classList.replace("fa-copy", "fa-check");
                btn.style.color = "var(--success)";
                btn.style.borderColor = "var(--success)";

                setTimeout(() => {
                    icon.classList.replace("fa-check", "fa-copy");
                    btn.style.color = "";
                    btn.style.borderColor = "";
                }, 2000);
            });
        });
    });
}

/* ---------- Form Submit with Loading State ---------- */
function initFormSubmit() {
    const form = document.getElementById("uploadForm");
    const submitBtn = document.getElementById("submitBtn");

    if (!form || !submitBtn) return;

    form.addEventListener("submit", () => {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<span class="spinner"></span> <span>Translating…</span>';
        submitBtn.classList.add("btn-loading");
    });
}

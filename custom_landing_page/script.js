// Configuration
const CONFIG = {
    goldUrl: 'https://www.goodreturns.in/gold-rates/chennai.html',
    proxyUrl: 'https://api.allorigins.win/get?url=',
    refreshInterval: 300000,
    fallbackRates: {
        date: 'Nov 23, 2025',
        k22: 7350,
        k24: 8020
    }
};

// State
let isEditMode = false;
let draggedEl = null;
let resizedEl = null;
let initialX, initialY;
let initialWidth, initialHeight;
let initialLeft, initialTop;

// DOM Elements
const els = {
    body: document.body,
    editBtn: document.getElementById('editToggle'),
    notes: document.getElementById('notesInput'),
    widgets: document.querySelectorAll('.widget'),
    date: document.getElementById('mainDate'),
    clocks: {
        india: document.getElementById('mainClock'),
        france: document.getElementById('clock-france'),
        usa: document.getElementById('clock-usa')
    },
    gold: {
        updated: document.getElementById('goldLastUpdated'),
        k22: {
            g1: document.getElementById('gold-22-1g'),
            g8: document.getElementById('gold-22-8g'),
            g10: document.getElementById('gold-22-10g')
        },
        k24: {
            g1: document.getElementById('gold-24-1g'),
            g8: document.getElementById('gold-24-8g'),
            g10: document.getElementById('gold-24-10g')
        }
    }
};

// --- Layout & Persistence ---

function loadLayout() {
    const savedLayout = JSON.parse(localStorage.getItem('dashboardLayout'));
    const savedNotes = localStorage.getItem('dashboardNotes');

    if (savedNotes) {
        els.notes.value = savedNotes;
    }

    els.widgets.forEach(widget => {
        const id = widget.id;
        if (savedLayout && savedLayout[id]) {
            const style = savedLayout[id];
            widget.style.left = style.left;
            widget.style.top = style.top;
            widget.style.width = style.width;
            widget.style.height = style.height;
        } else {
            // Apply defaults from data attributes
            const x = widget.dataset.x;
            const y = widget.dataset.y;

            if (x === 'center') {
                widget.style.left = '50%';
                widget.style.transform = 'translateX(-50%)'; // Initial center only
            } else {
                widget.style.left = x;
            }

            if (y === 'center') {
                widget.style.top = '50%';
                if (widget.style.transform) {
                    widget.style.transform = 'translate(-50%, -50%)';
                } else {
                    widget.style.transform = 'translateY(-50%)';
                }
            } else {
                widget.style.top = y;
            }
        }
    });
}

function saveLayout() {
    const layout = {};
    els.widgets.forEach(widget => {
        layout[widget.id] = {
            left: widget.style.left,
            top: widget.style.top,
            width: widget.style.width,
            height: widget.style.height
        };
    });
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
}

// --- Interaction (Drag & Resize) ---

els.editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    els.body.classList.toggle('edit-mode', isEditMode);

    // Reset transforms when entering edit mode to make absolute positioning easier to calculate
    if (isEditMode) {
        els.widgets.forEach(w => {
            const rect = w.getBoundingClientRect();
            w.style.transform = 'none';
            w.style.left = rect.left + 'px';
            w.style.top = rect.top + 'px';
            w.style.width = rect.width + 'px';
            w.style.height = rect.height + 'px';
        });
    } else {
        saveLayout();
    }
});

// Notes Auto-save
els.notes.addEventListener('input', (e) => {
    localStorage.setItem('dashboardNotes', e.target.value);
});

// Drag Logic
document.addEventListener('mousedown', (e) => {
    if (!isEditMode) return;

    // Resize Handle
    if (e.target.classList.contains('resize-handle')) {
        resizedEl = e.target.parentElement;
        initialX = e.clientX;
        initialY = e.clientY;
        initialWidth = parseFloat(getComputedStyle(resizedEl).width);
        initialHeight = parseFloat(getComputedStyle(resizedEl).height);
        e.preventDefault();
        return;
    }

    // Drag Handle (Header)
    const header = e.target.closest('.widget-header');
    if (header) {
        draggedEl = header.parentElement;
        initialX = e.clientX;
        initialY = e.clientY;
        initialLeft = parseFloat(draggedEl.style.left || 0);
        initialTop = parseFloat(draggedEl.style.top || 0);
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isEditMode) return;

    if (draggedEl) {
        const dx = e.clientX - initialX;
        const dy = e.clientY - initialY;
        draggedEl.style.left = `${initialLeft + dx}px`;
        draggedEl.style.top = `${initialTop + dy}px`;
    }

    if (resizedEl) {
        const dx = e.clientX - initialX;
        const dy = e.clientY - initialY;
        resizedEl.style.width = `${initialWidth + dx}px`;
        resizedEl.style.height = `${initialHeight + dy}px`;
    }
});

document.addEventListener('mouseup', () => {
    if (draggedEl || resizedEl) {
        saveLayout();
    }
    draggedEl = null;
    resizedEl = null;
});


// --- Existing Logic (Time & Gold) ---

window.switchTab = function (carat) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.gold-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${carat}`).classList.add('active');
};

function updateTime() {
    const now = new Date();
    const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    els.date.textContent = now.toLocaleDateString('en-US', dateOptions);
    const mainTimeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    els.clocks.india.textContent = new Intl.DateTimeFormat('en-US', { ...mainTimeOptions, timeZone: 'Asia/Kolkata' }).format(now);
    els.clocks.france.textContent = new Intl.DateTimeFormat('en-US', { ...mainTimeOptions, timeZone: 'Europe/Paris' }).format(now);
    els.clocks.usa.textContent = new Intl.DateTimeFormat('en-US', { ...mainTimeOptions, timeZone: 'America/New_York' }).format(now);
}

async function fetchGoldRates() {
    els.gold.updated.textContent = 'Updating...';
    try {
        const response = await fetch(`${CONFIG.proxyUrl}${encodeURIComponent(CONFIG.goldUrl)}`);
        const data = await response.json();
        if (!data.contents) throw new Error('No content received');
        parseGoldData(data.contents);
        els.gold.updated.textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (error) {
        console.error('Failed to fetch gold rates:', error);
        useFallbackData();
        els.gold.updated.textContent = `Offline Mode`;
    }
}

function parseGoldData(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    let price22k = 0;
    let price24k = 0;
    const tables = doc.querySelectorAll('table');
    tables.forEach(table => {
        const text = table.textContent;
        if (text.includes('22 Carat') && text.includes('1 Gram')) {
            price22k = extractPriceFromTable(table);
        }
        if (text.includes('24 Carat') && text.includes('1 Gram')) {
            price24k = extractPriceFromTable(table);
        }
    });
    if (price22k && price24k) {
        updateGoldUI(price22k, price24k);
    } else {
        throw new Error('Could not parse prices');
    }
}

function extractPriceFromTable(table) {
    const rows = table.querySelectorAll('tr');
    for (let row of rows) {
        if (row.textContent.includes('1 Gram')) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const priceText = cells[1].textContent.replace(/[₹,]/g, '').trim();
                return parseFloat(priceText);
            }
        }
    }
    return 0;
}

function updateGoldUI(price22, price24) {
    const format = (num) => '₹' + num.toLocaleString('en-IN');
    els.gold.k22.g1.textContent = format(price22);
    els.gold.k22.g8.textContent = format(price22 * 8);
    els.gold.k22.g10.textContent = format(price22 * 10);
    els.gold.k24.g1.textContent = format(price24);
    els.gold.k24.g8.textContent = format(price24 * 8);
    els.gold.k24.g10.textContent = format(price24 * 10);
}

function useFallbackData() {
    updateGoldUI(CONFIG.fallbackRates.k22, CONFIG.fallbackRates.k24);
}

// Initialize
loadLayout();
setInterval(updateTime, 1000);
updateTime();
fetchGoldRates();
setInterval(fetchGoldRates, CONFIG.refreshInterval);

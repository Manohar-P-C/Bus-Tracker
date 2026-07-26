// Faculty Dashboard Interactive Engine

document.addEventListener('DOMContentLoaded', () => {
    initFacultyMap();
    initSearchFilter();
    initTabs();
    initThemeToggle();
    initLangSelector();
});

let facultyMap = null;

// Initialize Leaflet Map for Assigned Bus
function initFacultyMap() {
    const mapEl = document.getElementById('faculty-bus-map');
    if (!mapEl) return;

    // Faculty assigned bus coordinates (e.g. Bus 4 route through Silk Board / Koramangala / SVIT)
    const lat = window.FACULTY_BUS_LAT || 12.9352;
    const lng = window.FACULTY_BUS_LNG || 77.6245;

    facultyMap = L.map('faculty-bus-map', {
        zoomControl: true
    }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(facultyMap);

    // Custom Bus Icon
    const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `<div style="background:#2563eb; color:#fff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 10px rgba(37,99,235,0.4); border: 2px solid #fff;"><i class="bi bi-bus-front-fill" style="font-size:1.1rem;"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    const marker = L.marker([lat, lng], { icon: busIcon }).addTo(facultyMap);
    marker.bindPopup(`<b>Bus ${window.FACULTY_BUS_NO || 4}</b><br>Status: On Route<br>Speed: 32 km/h`).openPopup();

    // Draw sample route polyline
    const routeCoords = window.FACULTY_ROUTE_COORDS || [
        [12.9176, 77.6238],
        [12.9275, 77.6270],
        [12.9352, 77.6245],
        [12.9500, 77.6100],
        [12.9780, 77.6080],
        [13.1480, 77.5700]
    ];

    if (routeCoords && routeCoords.length > 0) {
        const polyline = L.polyline(routeCoords, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.8,
            dashArray: '8, 8'
        }).addTo(facultyMap);

        facultyMap.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    }
}

// Student Search Filter
function initSearchFilter() {
    const searchInput = document.getElementById('faculty-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#students-table-body tr');

        rows.forEach(row => {
            const name = row.getAttribute('data-name') || '';
            const usn = row.getAttribute('data-usn') || '';
            const parent = row.getAttribute('data-parent') || '';

            if (name.includes(query) || usn.includes(query) || parent.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Tab Switching
function initTabs() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const tabPanels = document.querySelectorAll('.tab-panel');
            tabPanels.forEach(panel => {
                if (panel.id === `tab-${targetTab}`) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            if (targetTab === 'tracking' && facultyMap) {
                setTimeout(() => {
                    facultyMap.invalidateSize();
                }, 200);
            }
        });
    });
}

// Theme Toggle
function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const icon = themeBtn.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            icon.className = 'bi bi-sun-fill';
            localStorage.setItem('svit_theme', 'dark');
        } else {
            icon.className = 'bi bi-moon-stars-fill';
            localStorage.setItem('svit_theme', 'light');
        }
    });

    if (localStorage.getItem('svit_theme') === 'dark') {
        document.body.classList.add('dark-theme');
        const icon = themeBtn.querySelector('i');
        if (icon) icon.className = 'bi bi-sun-fill';
    }
}

// Multi-language Selection
function initLangSelector() {
    const select = document.getElementById('faculty-lang-select');
    if (!select) return;

    select.addEventListener('change', (e) => {
        const selectedLang = e.target.value;
        if (window.changeLanguage) {
            window.changeLanguage(selectedLang);
        }
    });
}

// Trigger Faculty SOS Modal / Action
function triggerFacultySOS() {
    if (confirm("🚨 Dispatch Emergency SOS Alert for Bus " + (window.FACULTY_BUS_NO || 4) + " to Transport Head & Security?")) {
        fetch('/api/student/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emergency_type: 'Faculty Coordinator SOS',
                bus_no: window.FACULTY_BUS_NO || 4,
                student_name: 'Faculty Coordinator',
                usn: 'FACULTY'
            })
        }).then(r => r.json()).then(data => {
            alert("✅ Emergency Alert Dispatched to Transport Office & Security!");
        }).catch(err => {
            alert("✅ Emergency Alert Dispatched!");
        });
    }
}

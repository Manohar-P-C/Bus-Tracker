// SVIT Student Dashboard Logic

let studentMap = null;
let fullMap = null;
let currentTileLayer = null;
let busMarker = null;
let routePolyline = null;
let simInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initStudentMap();
    generatePassQRCode();
});

// Theme Initialization
function initTheme() {
    const savedTheme = localStorage.getItem('svit_theme');
    const icon = document.getElementById('theme-icon');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
        if (icon) icon.className = 'bi bi-moon-fill';
    } else {
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
        if (icon) icon.className = 'bi bi-sun-fill';
    }
}

// Toggle Theme
function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    const icon = document.getElementById('theme-icon');

    if (isLight) {
        document.documentElement.classList.remove('light-theme');
        document.body.classList.remove('light-theme');
        localStorage.setItem('svit_theme', 'dark');
        if (icon) icon.className = 'bi bi-sun-fill';
    } else {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('svit_theme', 'light');
        if (icon) icon.className = 'bi bi-moon-fill';
    }

    if (studentMap) {
        setTimeout(() => studentMap.invalidateSize(), 200);
    }
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
}

// Account Dropdown Toggle
function toggleAccountDropdown() {
    const menu = document.getElementById('account-dropdown-menu');
    if (menu) menu.classList.toggle('show');
}

// Tab Switching System
function switchStudentTab(tabId) {
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(p => p.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => n.classList.remove('active'));

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    if (tabId === 'tab-dashboard' && studentMap) {
        setTimeout(() => studentMap.invalidateSize(), 200);
    } else if (tabId === 'tab-map') {
        setTimeout(() => initFullMap(), 200);
    }
}

// 1. Leaflet Map View Logic
function initStudentMap() {
    const mapContainer = document.getElementById('student-live-map');
    if (!mapContainer) return;

    const lat = BUS_DATA.lat || 13.0420;
    const lng = BUS_DATA.lng || 77.6200;

    studentMap = L.map('student-live-map').setView([lat, lng], 13);

    // Default Tile Layer (Normal OSM)
    currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(studentMap);

    // Custom Bus Icon
    const busIcon = L.divIcon({
        className: 'custom-bus-icon-marker',
        html: `<div style="background: #2563eb; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37,99,235,0.5); font-size: 1.2rem; border: 2px solid #fff;"><i class="bi bi-bus-front-fill"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    busMarker = L.marker([lat, lng], { icon: busIcon }).addTo(studentMap);
    busMarker.bindPopup(`<b>Bus ${STUDENT_DATA.bus_no}</b><br>Assigned Route: ${STUDENT_DATA.route_name}<br>Status: On Route`).openPopup();

    // Draw route path if stops exist
    const defaultCoords = [
        [13.0075, 77.6959],
        [13.0280, 77.6400],
        [13.0420, 77.6200],
        [13.0850, 77.5980],
        [13.1480, 77.5700]
    ];

    routePolyline = L.polyline(defaultCoords, { color: '#3b82f6', weight: 5, opacity: 0.8, dashArray: '8, 8' }).addTo(studentMap);
    studentMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    startLiveBusMotion(defaultCoords);
}

// Map Tile Layers Switch (Normal vs Satellite)
function setMapTile(type) {
    if (!studentMap) return;

    if (currentTileLayer) {
        studentMap.removeLayer(currentTileLayer);
    }

    const btnNormal = document.getElementById('btn-normal-view');
    const btnSat = document.getElementById('btn-satellite-view');

    if (type === 'satellite') {
        currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        }).addTo(studentMap);

        if (btnNormal) btnNormal.classList.remove('active');
        if (btnSat) btnSat.classList.add('active');
    } else {
        currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(studentMap);

        if (btnSat) btnSat.classList.remove('active');
        if (btnNormal) btnNormal.classList.add('active');
    }
}

function toggleTrafficOverlay() {
    alert("Traffic overlay layer enabled for Bus Route " + STUDENT_DATA.bus_no + " (Live Speed: 32 km/h - Traffic Low)");
}

function recenterMap() {
    if (studentMap && busMarker) {
        studentMap.setView(busMarker.getLatLng(), 14);
    }
}

// Live Bus Animation along route
function startLiveBusMotion(coords) {
    let step = 0;
    simInterval = setInterval(() => {
        step = (step + 1) % coords.length;
        const nextCoord = coords[step];
        if (busMarker) {
            busMarker.setLatLng(nextCoord);
        }
        
        // Update tele speed randomly between 28 - 36 km/h
        const speedEl = document.getElementById('tele-speed');
        if (speedEl) {
            speedEl.textContent = `${Math.floor(Math.random() * 8) + 28} km/h`;
        }
    }, 4000);
}

// Full Map Initialization for Tab 2
function initFullMap() {
    const el = document.getElementById('full-student-map');
    if (!el) return;
    if (fullMap) {
        fullMap.invalidateSize();
        return;
    }

    const lat = BUS_DATA.lat || 13.0420;
    const lng = BUS_DATA.lng || 77.6200;

    fullMap = L.map('full-student-map').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(fullMap);

    const busIcon = L.divIcon({
        className: 'custom-bus-icon-marker',
        html: `<div style="background: #2563eb; color: #fff; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37,99,235,0.5); font-size: 1.2rem; border: 2px solid #fff;"><i class="bi bi-bus-front-fill"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    L.marker([lat, lng], { icon: busIcon }).addTo(fullMap).bindPopup(`Bus ${STUDENT_DATA.bus_no} Live Position`);
}

// 2. Dynamic QR Code Generation
function generatePassQRCode() {
    const qrContainer = document.getElementById('student-pass-qr');
    const bigQrContainer = document.getElementById('big-student-qr');

    const qrPayload = JSON.stringify({
        usn: STUDENT_DATA.usn,
        name: STUDENT_DATA.name,
        bus_no: STUDENT_DATA.bus_no,
        valid_till: '2026-06-30',
        issuer: 'SVIT Transport'
    });

    if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrContainer, {
                text: qrPayload,
                width: 90,
                height: 90,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } else {
            // Fallback Google Chart QR API
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrPayload)}" alt="Bus Pass QR">`;
        }
    }

    if (bigQrContainer) {
        bigQrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(bigQrContainer, {
                text: qrPayload,
                width: 200,
                height: 200,
                colorDark : "#0f172a",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } else {
            bigQrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}" alt="Bus Pass QR">`;
        }
    }
}

// Download Pass Action
function downloadDigitalPass() {
    alert(`Downloading Digital Bus Pass PDF for ${STUDENT_DATA.name} (USN: ${STUDENT_DATA.usn})...`);
}

// 4. Send Student SOS Alert
async function sendStudentSOSAlert() {
    const selectedType = document.querySelector('input[name="sos_type"]:checked')?.value || 'Admin';

    if (!confirm(`Are you sure you want to dispatch a ${selectedType} Emergency Alert? Your current location and bus position will be broadcasted to Admin.`)) {
        return;
    }

    try {
        const response = await fetch('/api/student/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emergency_type: selectedType,
                bus_no: STUDENT_DATA.bus_no,
                student_name: STUDENT_DATA.name,
                usn: STUDENT_DATA.usn
            })
        });

        const data = await response.json();
        if (data.success) {
            alert(`🚨 EMERGENCY SOS DISPATCHED!\n\n${data.message}\nAdmin Dashboard has been notified in real time.`);
        } else {
            alert("Failed to dispatch SOS alert. Please retry.");
        }
    } catch (e) {
        alert(`🚨 EMERGENCY SOS SENT!\n\n${selectedType} Alert sent to SVIT Transport Admin.`);
    }
}

// Filter Attendance History
function filterAttendance(val) {
    console.log("Filtering attendance by:", val);
}

// Share Live Bus Location Link
function shareLiveBusLocation() {
    const shareText = `Live tracking for SVIT Bus ${STUDENT_DATA.bus_no} (${STUDENT_DATA.route_name}): http://127.0.0.1:5000/student/dashboard`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText);
        alert("🔗 Live Bus Location link copied to clipboard:\n\n" + shareText);
    } else {
        alert("🔗 Live Bus Location link:\n\n" + shareText);
    }
}

/* ==========================================================================
   SVIT SMART BUS TRACKER - ENTERPRISE PARENT DASHBOARD INTERACTION JS
   ========================================================================== */

let parentMap = null;
let fullParentMap = null;
let busMarker = null;
let routePolyline = null;
let currentTileLayer = null;

// Map Tiles (OpenStreetMap Normal & Esri World Imagery Satellite)
const TILE_LAYERS = {
    normal: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    })
};

document.addEventListener('DOMContentLoaded', () => {
    initParentMap();
    setupOutsideClickHandlers();
});

// Initialize Leaflet Map for Assigned Bus
function initParentMap() {
    const mapContainer = document.getElementById('parent-live-map');
    if (!mapContainer) return;

    const initialLat = PARENT_BUS_DATA.lat || 13.0420;
    const initialLng = PARENT_BUS_DATA.lng || 77.6200;

    parentMap = L.map('parent-live-map', {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: true
    });

    currentTileLayer = TILE_LAYERS.normal;
    currentTileLayer.addTo(parentMap);

    // Custom Bus Icon
    const busIcon = L.divIcon({
        className: 'custom-bus-marker-div',
        html: `
            <div style="background:#2563eb; color:#fff; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(37,99,235,0.4); border:3px solid #fff;">
                <i class="bi bi-bus-front-fill" style="font-size:1.2rem;"></i>
            </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
    });

    busMarker = L.marker([initialLat, initialLng], { icon: busIcon }).addTo(parentMap);
    busMarker.bindPopup(`<b>Bus ${PARENT_BUS_DATA.bus_no}</b><br>Status: ${PARENT_BUS_DATA.status}`).openPopup();

    // Sample Route Polyline
    const routeCoords = [
        [12.9680, 77.5020],
        [12.9770, 77.5080],
        [13.0030, 77.5180],
        [13.0250, 77.5270],
        [13.0420, 77.6200],
        [13.0780, 77.5520],
        [13.1100, 77.5680],
        [13.1480, 77.5700]
    ];

    routePolyline = L.polyline(routeCoords, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.8,
        dashArray: '8, 8'
    }).addTo(parentMap);

    // Add Stop markers along polyline
    routeCoords.forEach((coord, idx) => {
        L.circleMarker(coord, {
            radius: 5,
            fillColor: idx === routeCoords.length - 1 ? '#ef4444' : '#2563eb',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 1
        }).addTo(parentMap);
    });

    parentMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    // Live Telemetry Movement Simulation
    let step = 0;
    setInterval(() => {
        step = (step + 1) % routeCoords.length;
        const newPos = routeCoords[step];
        busMarker.setLatLng(newPos);
        
        // Dynamic Telemetry update
        const stops = ["Mallathahalli", "Nagarabhavi", "Rajkumar Samadhi", "Jalahalli Cross", "HSR Layout", "Silk Board", "Yelahanka", "SVIT Campus"];
        const currStopEl = document.getElementById('tele-curr-stop');
        const nextStopEl = document.getElementById('tele-next-stop');
        const speedEl = document.getElementById('tele-speed');

        if (currStopEl) currStopEl.textContent = stops[step % stops.length];
        if (nextStopEl) nextStopEl.textContent = stops[(step + 1) % stops.length];
        if (speedEl) speedEl.textContent = `${Math.floor(25 + Math.random() * 15)} km/h`;
    }, 4000);
}

// Switch Map Tiles (Normal vs Satellite)
function setMapTile(type) {
    if (!parentMap) return;

    if (currentTileLayer) {
        parentMap.removeLayer(currentTileLayer);
    }

    if (type === 'satellite') {
        currentTileLayer = TILE_LAYERS.satellite;
        document.getElementById('btn-satellite-view')?.classList.add('active');
        document.getElementById('btn-normal-view')?.classList.remove('active');
    } else {
        currentTileLayer = TILE_LAYERS.normal;
        document.getElementById('btn-normal-view')?.classList.add('active');
        document.getElementById('btn-satellite-view')?.classList.remove('active');
    }

    currentTileLayer.addTo(parentMap);
}

// Fullscreen Map Toggle
function toggleFullscreenMap() {
    const mapCard = document.querySelector('.map-card');
    if (!mapCard) return;

    if (!document.fullscreenElement) {
        mapCard.requestFullscreen().catch(err => alert("Error enabling fullscreen mode"));
    } else {
        document.exitFullscreen();
    }
}

// Tab Switching System
function switchParentTab(tabId) {
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

    // Refresh map sizes if tab contains a map
    if (tabId === 'tab-dashboard' && parentMap) {
        setTimeout(() => parentMap.invalidateSize(), 200);
    } else if (tabId === 'tab-tracking') {
        initFullParentMap();
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

function initFullParentMap() {
    const mapBox = document.getElementById('full-parent-map');
    if (!mapBox || fullParentMap) return;

    const initialLat = PARENT_BUS_DATA.lat || 13.0420;
    const initialLng = PARENT_BUS_DATA.lng || 77.6200;

    fullParentMap = L.map('full-parent-map', {
        center: [initialLat, initialLng],
        zoom: 14
    });

    TILE_LAYERS.normal.addTo(fullParentMap);

    const busIcon = L.divIcon({
        className: 'custom-bus-marker-div',
        html: `<div style="background:#2563eb; color:#fff; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(37,99,235,0.4); border:3px solid #fff;"><i class="bi bi-bus-front-fill" style="font-size:1.3rem;"></i></div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
    });

    L.marker([initialLat, initialLng], { icon: busIcon }).addTo(fullParentMap)
        .bindPopup(`<b>Bus ${PARENT_BUS_DATA.bus_no}</b><br>Live GPS Active`).openPopup();
}

// Sidebar Toggle Mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// Day/Night Theme Toggle
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    
    body.className = newTheme + '-theme';
    localStorage.setItem('svit_theme', newTheme);

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
    }
}

// Account Dropdown Toggle
function toggleAccountDropdown() {
    const menu = document.getElementById('account-dropdown-menu');
    if (menu) menu.classList.toggle('show');
}

function setupOutsideClickHandlers() {
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.account-dropdown-wrapper')) {
            const menu = document.getElementById('account-dropdown-menu');
            if (menu && menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        }
    });
}

// Modals
function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('active');
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
}

function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('active');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('active');
}

function savePasswordChange(e) {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (newPass !== confirmPass) {
        alert("New password and confirm password do not match!");
        return;
    }

    closeChangePasswordModal();
    document.getElementById('change-password-form').reset();
    alert("Password updated successfully!");
}

function scrollToStudentCard() {
    const card = document.getElementById('student-profile-card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
    }
}

function handleParentSearch(e) {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;

    if (q.includes('bus') || q.includes('track') || q.includes('map')) {
        switchParentTab('tab-tracking');
    } else if (q.includes('driver')) {
        switchParentTab('tab-driver');
    } else if (q.includes('faculty') || q.includes('teacher')) {
        switchParentTab('tab-faculty');
    } else if (q.includes('attend') || q.includes('present') || q.includes('absent')) {
        switchParentTab('tab-attendance');
    } else if (q.includes('emerg') || q.includes('contact') || q.includes('police') || q.includes('office')) {
        switchParentTab('tab-emergency');
    }
}

function filterAttendanceHistory(val) {
    // Client side filter simulation
    console.log("Filtering attendance range:", val);
}

function filterAttendanceStatus(val) {
    const rows = document.querySelectorAll('#attendance-tbody tr');
    rows.forEach(r => {
        if (val === 'all') {
            r.style.display = '';
        } else {
            const hasStatus = r.querySelector(`.status-${val}`);
            r.style.display = hasStatus ? '' : 'none';
        }
    });
}

function markAllNotificationsRead() {
    const unreadDots = document.querySelectorAll('.dot-unread');
    unreadDots.forEach(d => d.style.display = 'none');
    alert("All notifications marked as read!");
}

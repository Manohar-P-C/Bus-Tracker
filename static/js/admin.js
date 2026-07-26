// Admin Dashboard JavaScript Application Logic

let liveMap = null;
let routeDetailMap = null;
let currentStudentsList = [];
let currentBusesList = [];
let currentDriversList = [];
let currentFacultyList = [];
let simulationActive = false;
let simulationInterval = null;
let simulationMarkers = [];
let lastSOSCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
    initThemeIcon();
    await populateBusDropdowns();
    loadDashboardStats();
    loadRecentSOS();
    loadLiveMap();
    loadStudentsTable();
    loadBusesData();
    loadDriversData();
    loadFacultyData();
    loadRoutesData();
    loadAttendanceData();
    loadFullSOSAlerts();
    startSOSPolling();
});

// ==========================================
// DAY / NIGHT THEME TOGGLE
// ==========================================

function initThemeIcon() {
    const savedTheme = localStorage.getItem('svit_theme') || 'dark';
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = savedTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('svit_theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.className = newTheme + '-theme';
    localStorage.setItem('svit_theme', newTheme);
    
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = newTheme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }

    // Refresh maps since tile layers may need redraw
    if (liveMap) {
        setTimeout(() => liveMap.invalidateSize(), 200);
    }
    if (routeDetailMap) {
        setTimeout(() => routeDetailMap.invalidateSize(), 200);
    }
}

// Tab Switching System
function switchAdminTab(tabId) {
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

    const pageTitle = document.getElementById('page-title');
    const totalStudentsCount = document.getElementById('stat-students') ? document.getElementById('stat-students').textContent : '90';
    const titlesMap = {
        'tab-dashboard': 'Admin Dashboard Overview',
        'tab-students': `Total Students Directory (${totalStudentsCount} Students)`,
        'tab-buses': 'Total Buses Management (9 Buses)',
        'tab-drivers': 'Drivers List & Bus Assignments',
        'tab-faculty': 'Faculty Coordinators Directory (9 Faculty)',
        'tab-routes': 'Bus Routes & Leaflet Map Tracking',
        'tab-attendance': 'Bus Attendance & Absentees Overview',
        'tab-register-user': 'Create New User Account',
        'tab-register-bus': 'Register New Bus',
        'tab-notifications': 'Emergency SOS Alerts & Notifications'
    };
    if (pageTitle && titlesMap[tabId]) {
        pageTitle.textContent = titlesMap[tabId];
    }

    if (tabId === 'tab-dashboard' && liveMap) {
        setTimeout(() => liveMap.invalidateSize(), 200);
    } else if (tabId === 'tab-routes' && routeDetailMap) {
        setTimeout(() => routeDetailMap.invalidateSize(), 200);
    }
}

// Sidebar Mobile Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('show');
}

// Account Dropdown Toggle
function toggleAccountDropdown() {
    const menu = document.getElementById('account-dropdown-menu');
    if (menu) menu.classList.toggle('show');
}

window.addEventListener('click', (e) => {
    if (!e.target.closest('.account-dropdown-wrapper')) {
        const menu = document.getElementById('account-dropdown-menu');
        if (menu && menu.classList.contains('show')) {
            menu.classList.remove('show');
        }
    }
});

function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('active');
}

function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.remove('active');
}

// ==========================================
// DYNAMIC BUS DROPDOWN POPULATOR
// ==========================================

async function populateBusDropdowns() {
    try {
        const res = await fetch('/api/buses');
        currentBusesList = await res.json();
        
        // 1. Populate "Assign Bus Number" dropdown in Create User panel
        const regBusSelect = document.getElementById('reg-bus-no');
        if (regBusSelect) {
            const currentVal = regBusSelect.value;
            let html = '';
            currentBusesList.forEach(b => {
                const label = b.route_name ? `Bus ${b.bus_no} (${b.route_name})` : `Bus ${b.bus_no}`;
                html += `<option value="${b.bus_no}">${label}</option>`;
            });
            if (html) {
                regBusSelect.innerHTML = html;
                if (currentVal && currentBusesList.some(b => b.bus_no == currentVal)) {
                    regBusSelect.value = currentVal;
                }
            }
        }

        // 2. Populate Students Tab - Bus Filter dropdown
        const filterSelect = document.getElementById('student-bus-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value || 'all';
            let totalStudents = currentBusesList.reduce((acc, b) => acc + (b.total_students || 0), 0);
            let html = `<option value="all">All ${currentBusesList.length} Buses (${totalStudents} Students)</option>`;
            currentBusesList.forEach(b => {
                html += `<option value="${b.bus_no}">Bus ${b.bus_no} (${b.total_students || 0} Students)</option>`;
            });
            filterSelect.innerHTML = html;
            if (currentVal) filterSelect.value = currentVal;
        }

        // 3. Update navbar & stat card bus count headers
        const busCountEls = document.querySelectorAll('#nav-bus-count, #stat-buses');
        busCountEls.forEach(el => {
            if (el) el.textContent = currentBusesList.length;
        });

    } catch (err) {
        console.error("Error populating bus dropdowns:", err);
    }
}

// ==========================================
// FEATURE 1: LIVE GPS MOVEMENT SIMULATOR
// ==========================================

const routeCoordsMap = {
    1: [[12.9680, 77.5020], [12.9770, 77.5080], [13.0030, 77.5180], [13.0250, 77.5270], [13.0480, 77.5350], [13.0780, 77.5520], [13.1100, 77.5680], [13.1583, 77.5684]],
    2: [[12.9610, 77.5130], [12.9750, 77.5350], [12.9920, 77.5480], [13.0150, 77.5540], [13.0330, 77.5640], [13.1583, 77.5684]],
    3: [[12.9555, 77.5670], [12.9780, 77.5690], [13.0010, 77.5700], [13.0120, 77.5830], [13.0350, 77.5970], [13.0780, 77.6080], [13.1583, 77.5684]],
    4: [[13.0075, 77.6959], [13.0280, 77.6400], [13.0420, 77.6200], [13.0850, 77.5980], [13.1350, 77.6100], [13.1583, 77.5684]],
    5: [[13.0380, 77.5750], [13.0520, 77.5780], [13.0750, 77.5680], [13.0850, 77.5620], [13.1100, 77.5680], [13.1583, 77.5684]],
    6: [[13.0480, 77.5080], [13.0650, 77.5250], [13.0780, 77.5520], [13.0900, 77.5600], [13.1150, 77.5700], [13.1583, 77.5684]],
    7: [[13.0335, 77.5645], [13.0500, 77.5600], [13.0750, 77.5620], [13.0950, 77.5650], [13.1100, 77.5680], [13.1583, 77.5684]],
    8: [[13.0975, 77.6080], [13.1000, 77.5960], [13.1150, 77.5850], [13.1300, 77.5780], [13.1400, 77.5720], [13.1583, 77.5684]],
    9: [[13.2925, 77.5410], [13.2800, 77.5450], [13.2500, 77.5500], [13.2100, 77.5580], [13.1800, 77.5650], [13.1583, 77.5684]]
};

function getRouteCoords(busNo) {
    if (routeCoordsMap[busNo]) return routeCoordsMap[busNo];
    const bNo = parseInt(busNo);
    const startLat = 13.0000 + ((bNo * 0.015) % 0.10);
    const startLng = 77.5000 + ((bNo * 0.012) % 0.12);
    return [
        [startLat, startLng],
        [startLat + 0.03, startLng + 0.02],
        [startLat + 0.07, startLng + 0.04],
        [13.1583, 77.5684]
    ];
}

function toggleLiveSimulation() {
    if (simulationActive) {
        stopSimulation();
    } else {
        startSimulation();
    }
}

function startSimulation() {
    simulationActive = true;
    const btn = document.getElementById('simulate-toggle-btn');
    const btnText = document.getElementById('simulate-btn-text');
    const statusBar = document.getElementById('map-status-bar');
    
    btn.classList.add('active');
    btn.querySelector('i').className = 'bi bi-stop-circle-fill';
    btnText.textContent = 'Stop Simulation';
    statusBar.style.display = 'flex';

    // Clear existing markers
    simulationMarkers.forEach(m => liveMap.removeLayer(m));
    simulationMarkers = [];

    const activeBuses = currentBusesList.length > 0 ? currentBusesList : Array.from({length: 9}, (_, i) => ({ bus_no: i + 1 }));

    // Initialize bus positions at start of routes
    const busStates = {};
    activeBuses.forEach(b => {
        const busNo = b.bus_no;
        const coords = getRouteCoords(busNo);
        busStates[busNo] = {
            progress: 0,
            coords: coords,
            speed: 0.008 + Math.random() * 0.006
        };
        
        const marker = L.circleMarker(coords[0], {
            radius: 10,
            fillColor: '#10b981',
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.95
        }).addTo(liveMap);

        const speedKmh = Math.round(25 + Math.random() * 20);
        marker.bindPopup(`<div style="font-family: 'Inter', sans-serif;">
            <strong style="color: #10b981; font-size: 1.05em;">🚌 Bus ${busNo} — IN TRANSIT</strong><br>
            <strong>Speed:</strong> <span id="speed-bus-${busNo}">${speedKmh}</span> km/h<br>
            <strong>ETA to SVIT:</strong> <span id="eta-bus-${busNo}">${Math.round(15 + Math.random() * 25)}</span> mins<br>
            <strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">🟢 Moving</span>
        </div>`);

        simulationMarkers.push(marker);
        busStates[busNo].marker = marker;
    });

    // Animation interval
    simulationInterval = setInterval(() => {
        let allArrived = true;
        activeBuses.forEach(b => {
            const busNo = b.bus_no;
            const state = busStates[busNo];
            if (!state || state.progress >= 1) return;
            allArrived = false;

            state.progress = Math.min(1, state.progress + state.speed);
            const coords = state.coords;
            const totalSegments = coords.length - 1;
            const segProgress = state.progress * totalSegments;
            const segIndex = Math.min(Math.floor(segProgress), totalSegments - 1);
            const segFrac = segProgress - segIndex;

            const lat = coords[segIndex][0] + (coords[segIndex + 1][0] - coords[segIndex][0]) * segFrac;
            const lng = coords[segIndex][1] + (coords[segIndex + 1][1] - coords[segIndex][1]) * segFrac;

            state.marker.setLatLng([lat, lng]);

            if (state.progress >= 0.95) {
                state.marker.setStyle({ fillColor: '#3b82f6' });
            }
        });

        const movingCount = Object.values(busStates).filter(s => s.progress < 1).length;
        const arrivedCount = activeBuses.length - movingCount;
        document.getElementById('map-status-text').textContent = 
            `Live: ${movingCount} buses in transit, ${arrivedCount} arrived at SVIT Campus`;

        if (allArrived) {
            document.getElementById('map-status-text').textContent = `✅ All ${activeBuses.length} buses have arrived at SVIT Campus!`;
            stopSimulation();
        }
    }, 800);
}

function stopSimulation() {
    simulationActive = false;
    const btn = document.getElementById('simulate-toggle-btn');
    const btnText = document.getElementById('simulate-btn-text');
    const statusBar = document.getElementById('map-status-bar');

    btn.classList.remove('active');
    btn.querySelector('i').className = 'bi bi-play-circle-fill';
    btnText.textContent = 'Simulate Live';
    statusBar.style.display = 'none';

    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

// ==========================================
// FEATURE 2: CSV / EXCEL EXPORT
// ==========================================

function exportStudentsCSV() {
    if (!currentStudentsList || currentStudentsList.length === 0) {
        showSOSToast('No Data', 'No student data available to export.', 'info');
        return;
    }

    const headers = ['Name', 'USN', 'Email', 'Phone', 'Bus No', 'Route', 'Stop Point', 'Parent Contact', 'Attendance %', 'Status'];
    const rows = currentStudentsList.map(s => [
        s.full_name, s.usn, s.email, s.phone, s.bus_no,
        s.route_name, s.stop_name, s.parent_contact, s.attendance_pct + '%', s.status
    ]);

    downloadCSV('SVIT_Students_Report', headers, rows);
}

async function exportAttendanceCSV() {
    try {
        const res = await fetch('/api/attendance');
        const data = await res.json();
        
        const headers = ['Bus No', 'Total Students', 'Present', 'Absent', 'Attendance %'];
        const rows = data.map(item => [
            `Bus ${item.bus_no}`, item.total_students, item.present_count,
            item.absent_count, item.attendance_pct + '%'
        ]);

        // Add absentee details
        const absHeaders = ['Bus No', 'Student Name', 'USN', 'Phone', 'Parent Contact', 'Status'];
        const absRows = [];
        data.forEach(item => {
            item.absent_list.forEach(s => {
                absRows.push([`Bus ${item.bus_no}`, s.full_name, s.usn, s.phone, s.parent_contact, 'Absent']);
            });
        });

        // Download summary
        downloadCSV('SVIT_Attendance_Summary', headers, rows);
        
        // Download absentees if any
        if (absRows.length > 0) {
            setTimeout(() => {
                downloadCSV('SVIT_Absentees_Report', absHeaders, absRows);
            }, 500);
        }
    } catch (e) {
        console.error('Error exporting attendance:', e);
    }
}

function downloadCSV(filename, headers, rows) {
    const date = new Date().toISOString().split('T')[0];
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ==========================================
// FEATURE 3: DRIVER & FACULTY EDIT MODALS
// ==========================================

// --- Driver Edit ---
function openEditDriverModal(driverId) {
    const d = currentDriversList.find(item => item.id === driverId);
    if (!d) return;

    document.getElementById('edit-driver-id').value = d.id;
    document.getElementById('edit-driver-name').value = d.name;
    document.getElementById('edit-driver-phone').value = d.phone;
    document.getElementById('edit-driver-email').value = d.email;
    document.getElementById('edit-driver-bus').value = d.assigned_bus;

    document.getElementById('edit-driver-modal').classList.add('active');
}

function closeEditDriverModal() {
    document.getElementById('edit-driver-modal').classList.remove('active');
}

async function saveDriverEdit(e) {
    e.preventDefault();
    const driverId = parseInt(document.getElementById('edit-driver-id').value);
    const d = currentDriversList.find(item => item.id === driverId);
    const payload = {
        id: driverId,
        name: document.getElementById('edit-driver-name').value,
        phone: document.getElementById('edit-driver-phone').value,
        email: document.getElementById('edit-driver-email').value,
        license_no: d ? d.license_no : 'N/A',
        assigned_bus: parseInt(document.getElementById('edit-driver-bus').value),
        experience_yrs: d ? d.experience_yrs : 0
    };

    try {
        const res = await fetch('/api/drivers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeEditDriverModal();
            loadDriversData();
            loadBusesData();
        }
    } catch (err) {
        console.error('Error saving driver edit:', err);
    }
}

// --- Faculty Edit ---
function openEditFacultyModal(facultyId) {
    const f = currentFacultyList.find(item => item.id === facultyId);
    if (!f) return;

    document.getElementById('edit-faculty-id').value = f.id;
    document.getElementById('edit-faculty-name').value = f.name;
    document.getElementById('edit-faculty-phone').value = f.phone;
    document.getElementById('edit-faculty-email').value = f.email;
    document.getElementById('edit-faculty-bus').value = f.assigned_bus;

    document.getElementById('edit-faculty-modal').classList.add('active');
}

function closeEditFacultyModal() {
    document.getElementById('edit-faculty-modal').classList.remove('active');
}

async function saveFacultyEdit(e) {
    e.preventDefault();
    const payload = {
        id: parseInt(document.getElementById('edit-faculty-id').value),
        full_name: document.getElementById('edit-faculty-name').value,
        phone: document.getElementById('edit-faculty-phone').value,
        email: document.getElementById('edit-faculty-email').value
    };

    try {
        const res = await fetch('/api/faculty', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeEditFacultyModal();
            loadFacultyData();
        }
    } catch (err) {
        console.error('Error saving faculty edit:', err);
    }
}

// ==========================================
// FEATURE 4: REAL-TIME SOS TOAST ALERTS
// ==========================================

function startSOSPolling() {
    // Poll for new SOS alerts every 15 seconds
    setInterval(async () => {
        try {
            const res = await fetch('/api/sos');
            const alerts = await res.json();
            
            if (alerts.length > lastSOSCount && lastSOSCount > 0) {
                // New SOS alert(s) received!
                const newAlerts = alerts.slice(0, alerts.length - lastSOSCount);
                newAlerts.forEach(alert => {
                    showSOSToast(
                        `🚨 SOS Alert — Bus ${alert.bus_no}`,
                        `<strong>${alert.message}</strong><br>Triggered by: ${alert.triggered_by}`,
                        'sos',
                        alert.bus_no
                    );
                });

                // Update badge counts
                const sosCountEl = document.getElementById('nav-sos-count');
                const topbarBadge = document.getElementById('topbar-sos-badge');
                if (sosCountEl) sosCountEl.textContent = alerts.length;
                if (topbarBadge) topbarBadge.textContent = alerts.length;

                // Refresh SOS tables
                loadRecentSOS();
                loadFullSOSAlerts();
            }
            lastSOSCount = alerts.length;
        } catch (e) {
            // Silently fail polling
        }
    }, 15000);
}

function showSOSToast(title, message, type = 'sos', busNo = null) {
    const container = document.getElementById('sos-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'sos-toast';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    toast.innerHTML = `
        <div class="toast-header-row">
            <div class="toast-title">
                <i class="bi bi-exclamation-triangle-fill"></i>
                ${title}
            </div>
            <button class="toast-close" onclick="dismissToast(this)">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
        <div class="toast-actions">
            ${busNo ? `<button class="toast-btn toast-btn-primary" onclick="dispatchAid(${busNo}); dismissToast(this);">
                <i class="bi bi-telephone-fill"></i> Dispatch Aid
            </button>` : ''}
            <button class="toast-btn toast-btn-secondary" onclick="switchAdminTab('tab-notifications'); dismissToast(this);">
                View All Alerts
            </button>
        </div>
        <div class="toast-time">${timeStr}</div>
    `;

    container.appendChild(toast);

    // Auto-dismiss after 12 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            dismissToast(toast.querySelector('.toast-close'));
        }
    }, 12000);
}

function dismissToast(btnOrElement) {
    const toast = btnOrElement.closest('.sos-toast');
    if (toast) {
        toast.classList.add('dismissing');
        setTimeout(() => toast.remove(), 350);
    }
}

function dispatchAid(busNo) {
    showSOSToast(
        '✅ Aid Dispatched',
        `Emergency response team has been notified for <strong>Bus ${busNo}</strong>. Coordination in progress.`,
        'info'
    );
}

// ==========================================
// CORE DATA LOADING FUNCTIONS
// ==========================================

// Load Stat Cards Data
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        
        document.getElementById('stat-students').textContent = data.total_students;
        document.getElementById('stat-buses').textContent = data.total_buses;
        document.getElementById('stat-drivers').textContent = data.total_drivers;
        document.getElementById('stat-faculty').textContent = data.total_faculty;
        document.getElementById('stat-routes').textContent = data.total_routes;
        document.getElementById('stat-attendance-pct').textContent = `${data.today_attendance_pct}%`;
        document.getElementById('nav-student-count').textContent = data.total_students;
        document.getElementById('nav-bus-count').textContent = data.total_buses;

        const subtextSpan = document.getElementById('students-subtext-count');
        if (subtextSpan) subtextSpan.textContent = data.total_students;

        const filterSelect = document.getElementById('student-bus-filter');
        if (filterSelect && data.bus_counts) {
            const currentSelected = filterSelect.value || 'all';
            const busKeys = Object.keys(data.bus_counts).map(Number).sort((a, b) => a - b);
            let optionsHTML = `<option value="all">All ${data.total_buses || busKeys.length} Buses (${data.total_students} Students)</option>`;
            busKeys.forEach(busNo => {
                const count = data.bus_counts[busNo] || 0;
                optionsHTML += `<option value="${busNo}">Bus ${busNo} (${count} Students)</option>`;
            });
            filterSelect.innerHTML = optionsHTML;
            if (currentSelected && (currentSelected === 'all' || busKeys.includes(Number(currentSelected)))) {
                filterSelect.value = currentSelected;
            }
        }
    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

// Load Live Map with Buses
async function loadLiveMap() {
    // Stop any running simulation first
    if (simulationActive) stopSimulation();

    const mapElement = document.getElementById('live-map');
    if (!mapElement) return;

    if (liveMap) {
        liveMap.remove();
    }

    liveMap = L.map('live-map').setView([13.0850, 77.5800], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(liveMap);

    try {
        const res = await fetch('/api/buses');
        const buses = await res.json();

        buses.forEach(b => {
            const popupContent = `
                <div style="font-family: 'Inter', sans-serif;">
                    <strong style="color: #2563eb; font-size: 1.1em;">Bus ${b.bus_no} (${b.reg_no})</strong><br>
                    <strong>Route:</strong> ${b.route_name}<br>
                    <strong>Driver:</strong> ${b.driver_name} (${b.driver_phone})<br>
                    <strong>Faculty:</strong> ${b.faculty_coordinator}<br>
                    <strong>Students Assigned:</strong> ${b.total_students || 0} Students<br>
                    <strong>Status:</strong> <span style="color: green; font-weight: bold;">${b.status}</span>
                </div>
            `;
            
            const circleMarker = L.circleMarker([b.lat, b.lng], {
                radius: 9,
                fillColor: '#3b82f6',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(liveMap);

            circleMarker.bindPopup(popupContent);
        });
    } catch (e) {
        console.error("Error loading map buses:", e);
    }
}

// Load Recent SOS Alerts
async function loadRecentSOS() {
    try {
        const res = await fetch('/api/sos');
        const alerts = await res.json();
        const tbody = document.getElementById('dashboard-sos-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        const recent = alerts.slice(0, 4);

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No active SOS alerts</td></tr>';
            return;
        }

        recent.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge-pill bg-red">${a.timestamp}</span></td>
                <td><strong>Bus ${a.bus_no}</strong></td>
                <td>${a.message}</td>
                <td><small>${a.triggered_by}</small></td>
            `;
            tbody.appendChild(tr);
        });

        // Update last known count for polling
        lastSOSCount = alerts.length;
        document.getElementById('nav-sos-count').textContent = alerts.length;
        document.getElementById('topbar-sos-badge').textContent = alerts.length;
    } catch (e) {
        console.error("Error loading SOS:", e);
    }
}

// TAB 1: TOTAL STUDENTS DIRECTORY
async function loadStudentsTable(busFilter = 'all', searchQuery = '') {
    try {
        const url = `/api/students?bus_no=${busFilter}&search=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        currentStudentsList = await res.json();

        const tbody = document.getElementById('students-tbody');
        const countSpan = document.getElementById('students-table-count');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (countSpan) countSpan.textContent = currentStudentsList.length;

        currentStudentsList.forEach(s => {
            const tr = document.createElement('tr');
            const statusBadge = s.status === 'Present' 
                ? '<span class="badge-pill bg-green">Present</span>' 
                : '<span class="badge-pill bg-red">Absent</span>';

            tr.innerHTML = `
                <td><strong>${s.full_name}</strong></td>
                <td><code>${s.usn}</code></td>
                <td><small>${s.email}</small></td>
                <td>${s.phone}</td>
                <td><span class="badge-pill bg-blue">Bus ${s.bus_no}</span></td>
                <td><small>${s.route_name}</small></td>
                <td>${s.stop_name}</td>
                <td>${s.parent_contact}</td>
                <td><strong>${s.attendance_pct}%</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-sm btn-outline text-blue" onclick="openEditStudentModal(${s.id})"><i class="bi bi-pencil"></i> Edit</button>
                    <button class="btn-sm btn-outline text-red" onclick="deleteStudent(${s.id})"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const currentLang = localStorage.getItem('svit_lang') || 'en';
        if (typeof changeLanguage === 'function') {
            changeLanguage(currentLang);
        }
    } catch (e) {
        console.error("Error loading students table:", e);
    }
}

function filterStudentsByBus() {
    const busVal = document.getElementById('student-bus-filter').value;
    loadStudentsTable(busVal);
}

// Edit Student Modal Functions
function openEditStudentModal(studentId) {
    const s = currentStudentsList.find(item => item.id === studentId);
    if (!s) return;

    document.getElementById('edit-student-id').value = s.id;
    document.getElementById('edit-student-name').value = s.full_name;
    document.getElementById('edit-student-usn').value = s.usn;
    document.getElementById('edit-student-email').value = s.email;
    document.getElementById('edit-student-phone').value = s.phone;
    document.getElementById('edit-student-parent').value = s.parent_contact;
    document.getElementById('edit-student-bus').value = s.bus_no;

    document.getElementById('edit-student-modal').classList.add('active');
}

function closeEditStudentModal() {
    document.getElementById('edit-student-modal').classList.remove('active');
}

async function saveStudentEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-student-id').value;
    const s = currentStudentsList.find(item => item.id == id);
    
    const payload = {
        id: id,
        full_name: document.getElementById('edit-student-name').value,
        usn: document.getElementById('edit-student-usn').value,
        email: document.getElementById('edit-student-email').value,
        phone: document.getElementById('edit-student-phone').value,
        parent_contact: document.getElementById('edit-student-parent').value,
        bus_no: parseInt(document.getElementById('edit-student-bus').value),
        route_name: s ? s.route_name : 'Default Route',
        stop_name: s ? s.stop_name : 'Main Stop',
        status: s ? s.status : 'Present'
    };

    const res = await fetch('/api/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
        closeEditStudentModal();
        loadStudentsTable();
    }
}

async function deleteStudent(id) {
    if (!confirm("Are you sure you want to delete this student profile?")) return;
    const res = await fetch(`/api/students?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
        loadStudentsTable();
        loadDashboardStats();
    }
}

// TAB 2: TOTAL BUSES
async function loadBusesData() {
    try {
        const res = await fetch('/api/buses');
        const buses = await res.json();
        const container = document.getElementById('buses-grid-container');
        if (!container) return;

        const busesTabCount = document.getElementById('buses-tab-count');
        if (busesTabCount) busesTabCount.textContent = buses.length;

        container.innerHTML = '';

        buses.forEach(b => {
            const card = document.createElement('div');
            card.className = 'bus-card';
            card.innerHTML = `
                <div class="bus-card-header">
                    <span class="bus-badge">Bus ${b.bus_no}</span>
                    <span class="badge-pill bg-green">${b.status}</span>
                </div>
                <div class="bus-body mt-2">
                    <h4 style="color: #fff;">${b.reg_no}</h4>
                    <p class="text-muted" style="font-size: 0.85rem;"><i class="bi bi-geo-alt"></i> ${b.route_name}</p>
                    <hr style="border-color: rgba(255,255,255,0.06); margin: 0.8rem 0;">
                    <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <div><strong>Driver:</strong> ${b.driver_name} (${b.driver_phone})</div>
                        <div><strong>Faculty Coordinator:</strong> ${b.faculty_coordinator}</div>
                        <div><strong>Assigned Students:</strong> <span class="text-blue"><strong>${b.total_students} Students</strong></span></div>
                        <div><strong>Capacity:</strong> ${b.capacity} Seats</div>
                    </div>
                </div>
                <div class="mt-3 flex-between">
                    <button class="btn-sm btn-outline text-blue" onclick="switchAdminTab('tab-routes')"><i class="bi bi-map"></i> View Route</button>
                    <button class="btn-sm btn-outline text-red" onclick="deleteBus(${b.bus_no})"><i class="bi bi-trash"></i> Delete</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading buses data:", e);
    }
}

async function deleteBus(busNo) {
    if (!confirm(`Are you sure you want to remove Bus ${busNo}?`)) return;
    const res = await fetch(`/api/buses?bus_no=${busNo}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
        await populateBusDropdowns();
        loadBusesData();
        loadRoutesData();
        loadDashboardStats();
    }
}

// TAB 3: DRIVERS DATA (with Edit buttons)
async function loadDriversData() {
    try {
        const res = await fetch('/api/drivers');
        currentDriversList = await res.json();
        const tbody = document.getElementById('drivers-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        currentDriversList.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${d.name}</strong></td>
                <td>${d.phone}</td>
                <td><small>${d.email}</small></td>
                <td><span class="badge-pill bg-blue">Bus ${d.assigned_bus}</span></td>
                <td>
                    <button class="btn-sm btn-outline text-blue" onclick="openEditDriverModal(${d.id})"><i class="bi bi-pencil"></i> Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading drivers:", e);
    }
}

// TAB 3b: FACULTY DATA (with Edit buttons)
async function loadFacultyData() {
    try {
        const res = await fetch('/api/faculty');
        currentFacultyList = await res.json();
        const tbody = document.getElementById('faculty-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        currentFacultyList.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${f.name}</strong></td>
                <td>${f.phone}</td>
                <td><small>${f.email}</small></td>
                <td><span class="badge-pill bg-blue">Bus ${f.assigned_bus}</span></td>
                <td><small>${f.route_name}</small></td>
                <td>
                    <button class="btn-sm btn-outline text-blue" onclick="openEditFacultyModal(${f.id})"><i class="bi bi-pencil"></i> Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading faculty data:", e);
    }
}

// TAB 4: ROUTES & LEAFLET MAP TRACKING
async function loadRoutesData() {
    try {
        const res = await fetch('/api/routes');
        const routes = await res.json();
        const container = document.getElementById('routes-list-box');
        if (!container) return;

        container.innerHTML = '';
        routes.forEach(r => {
            const item = document.createElement('div');
            item.className = 'att-bus-card';
            item.onclick = () => renderRouteDetailMap(r);
            item.innerHTML = `
                <div class="flex-between">
                    <strong style="color: #60a5fa;">Bus ${r.bus_no} - ${r.route_name}</strong>
                    <span class="badge-pill bg-purple">${r.distance_km} KM</span>
                </div>
                <div class="mt-2 text-muted" style="font-size: 0.85rem;">
                    <strong>Stops:</strong> ${r.stops.join(' → ')}
                </div>
                <div class="mt-2" style="font-size: 0.8rem; color: #94a3b8;">
                    Est. Travel Time: ${r.est_time_min} mins
                </div>
            `;
            container.appendChild(item);
        });

        if (routes.length > 0) {
            renderRouteDetailMap(routes[0]);
        }
    } catch (e) {
        console.error("Error loading routes:", e);
    }
}

function renderRouteDetailMap(routeObj) {
    document.getElementById('active-route-map-title').textContent = `Tracking Bus ${routeObj.bus_no}: ${routeObj.route_name}`;
    
    const pathCoords = routeCoordsMap[routeObj.bus_no] || [[13.0850, 77.5800], [13.1583, 77.5684]];

    if (!routeDetailMap) {
        routeDetailMap = L.map('route-detail-map').setView(pathCoords[0], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(routeDetailMap);
    } else {
        routeDetailMap.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
                routeDetailMap.removeLayer(layer);
            }
        });
    }

    const startPoint = pathCoords[0];
    L.circleMarker(startPoint, {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
    }).addTo(routeDetailMap).bindPopup(`<strong>Start Location:</strong> ${routeObj.start_point}`);

    const svitPoint = pathCoords[pathCoords.length - 1];
    L.circleMarker(svitPoint, {
        radius: 10,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
    }).addTo(routeDetailMap).bindPopup(`<strong>Destination:</strong> SVIT Campus (Rajanukunte)`);

    L.polyline(pathCoords, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 6'
    }).addTo(routeDetailMap);

    const bounds = L.latLngBounds(pathCoords);
    routeDetailMap.fitBounds(bounds, { padding: [30, 30] });
}

// TAB 5: ATTENDANCE
async function loadAttendanceData() {
    try {
        const res = await fetch('/api/attendance');
        const data = await res.json();
        const container = document.getElementById('attendance-buses-container');
        if (!container) return;

        container.innerHTML = '';

        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'att-bus-card';
            card.onclick = () => openAbsenteeDrawer(item);

            card.innerHTML = `
                <div class="flex-between">
                    <strong style="color: #ffffff; font-size: 1.05rem;">Bus ${item.bus_no}</strong>
                    <span class="badge-pill bg-blue">${item.attendance_pct}% Present</span>
                </div>
                <div class="att-stats-row mt-2">
                    <span>Total Students: <strong>${item.total_students}</strong></span>
                    <span style="color: #34d399;">Present: <strong>${item.present_count}</strong></span>
                    <span style="color: #f87171;">Absent: <strong>${item.absent_count}</strong></span>
                </div>
                <div class="att-bar">
                    <div class="att-bar-fill" style="width: ${item.attendance_pct}%;"></div>
                </div>
                <div class="mt-2 text-muted" style="font-size: 0.78rem; text-align: right;">
                    Click to view list of absentees <i class="bi bi-chevron-right"></i>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading attendance:", e);
    }
}

function openAbsenteeDrawer(busItem) {
    const drawer = document.getElementById('absentee-drawer');
    const title = document.getElementById('absentee-drawer-title');
    const tbody = document.getElementById('absentee-drawer-tbody');
    if (!drawer || !tbody) return;

    title.textContent = `Bus ${busItem.bus_no} Attendance Breakdown (${busItem.absent_count} Absentees)`;
    tbody.innerHTML = '';

    if (busItem.absent_list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-3">🎉 All students present for Bus ' + busItem.bus_no + '!</td></tr>';
    } else {
        busItem.absent_list.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.full_name}</strong></td>
                <td><code>${s.usn}</code></td>
                <td>${s.phone}</td>
                <td>${s.parent_contact}</td>
                <td>${s.stop_name}</td>
                <td><span class="badge-pill bg-red">Absent</span></td>
                <td>
                    <button class="btn-sm btn-outline text-blue" onclick="toggleStudentAttendance(${s.id}, 'Present')">Mark Present</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    drawer.style.display = 'block';
    drawer.scrollIntoView({ behavior: 'smooth' });
}

function closeAbsenteeDrawer() {
    const drawer = document.getElementById('absentee-drawer');
    if (drawer) drawer.style.display = 'none';
}

async function toggleStudentAttendance(studentId, newStatus) {
    const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
        loadAttendanceData();
        loadStudentsTable();
        loadDashboardStats();
        closeAbsenteeDrawer();
    }
}

// TAB 6: REGISTER USER
function toggleRollNumberField() {
    const role = document.getElementById('reg-role').value;
    const rollGroup = document.getElementById('roll-number-group');
    if (rollGroup) {
        rollGroup.style.display = role === 'student' ? 'block' : 'none';
    }
}

function openAddStudentModal() {
    switchAdminTab('tab-register-user');
    const roleSelect = document.getElementById('reg-role');
    if (roleSelect) {
        roleSelect.value = 'student';
        toggleRollNumberField();
    }
}

function openAddDriverModal() {
    switchAdminTab('tab-register-user');
    const roleSelect = document.getElementById('reg-role');
    if (roleSelect) {
        roleSelect.value = 'driver';
        toggleRollNumberField();
    }
}


async function handleUserRegistration(e) {
    e.preventDefault();

    const busSelect = document.getElementById('reg-bus-no');
    const busNo = busSelect ? parseInt(busSelect.value) : 1;

    const payload = {
        full_name: document.getElementById('reg-fullname').value,
        email: document.getElementById('reg-email').value,
        role: document.getElementById('reg-role').value,
        bus_no: busNo,
        phone: document.getElementById('reg-phone').value,
        usn: document.getElementById('reg-usn').value,
        password: document.getElementById('reg-password').value
    };

    try {
        const res = await fetch('/api/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        alert(data.message);

        if (data.success) {
            document.getElementById('create-user-form').reset();
            loadStudentsTable();
            loadBusesData();
            loadDriversData();
            loadFacultyData();
            loadDashboardStats();
        }
    } catch (err) {
        alert("Failed to register user. Please try again.");
    }
}

// TAB 7: REGISTER BUS
async function handleBusRegistration(e) {
    e.preventDefault();

    const payload = {
        bus_no: parseInt(document.getElementById('bus-reg-number').value),
        reg_no: document.getElementById('bus-reg-no').value,
        capacity: parseInt(document.getElementById('bus-capacity').value) || 40,
        driver_name: document.getElementById('bus-driver').value || 'Unassigned',
        faculty_coordinator: document.getElementById('bus-faculty').value || 'Unassigned',
        route_name: document.getElementById('bus-route-name').value || 'Default Route',
        status: 'On Time'
    };

    const res = await fetch('/api/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) {
        document.getElementById('create-bus-form').reset();
        await populateBusDropdowns();
        loadBusesData();
        loadRoutesData();
        loadDashboardStats();
    }
}

// TAB 8: NOTIFICATION & SOS ALERTS
async function loadFullSOSAlerts() {
    try {
        const res = await fetch('/api/sos');
        const alerts = await res.json();
        const tbody = document.getElementById('sos-full-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        alerts.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge-pill bg-red">${a.timestamp}</span></td>
                <td><strong>Bus ${a.bus_no}</strong></td>
                <td>${a.message}</td>
                <td>${a.triggered_by}</td>
                <td><span class="badge-pill bg-orange">${a.status}</span></td>
                <td>
                    <button class="btn-sm btn-outline text-blue" onclick="dispatchAid(${a.bus_no})">Dispatch Aid</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading full SOS:", e);
    }
}

// Global Search Filter
function handleGlobalSearch(e) {
    const query = e.target.value.trim();
    if (query.length > 0 && !document.getElementById('tab-students').classList.contains('active')) {
        switchAdminTab('tab-students');
    }
    loadStudentsTable('all', query);
}

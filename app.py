from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
import sqlite3
import json
import os
import random
from datetime import datetime, timedelta
from database import get_db_connection, init_db

app = Flask(__name__)
app.secret_key = 'saividya-bus-tracking-system-secret-key'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# Ensure database initialized on startup
init_db()

@app.route('/')
def index():
    user = session.get('user')
    if user and user.get('role') == 'admin':
        return redirect(url_for('admin_dashboard'))

    active_role = request.args.get('role', 'student')
    ROLE_DEFAULTS = {
        'admin': {'name': 'System Administrator', 'email': 'admin@saividya.ac.in'},
        'scanner': {'name': 'Bus QR Scanner Kiosk', 'email': 'scanner1@saividya.ac.in'},
        'faculty': {'name': 'Faculty Member', 'email': 'faculty1@saividya.ac.in'},
        'student': {'name': 'Student', 'email': 'student1@saividya.ac.in'},
        'parent': {'name': 'Parent / Guardian', 'email': 'parent1@saividya.ac.in'}
    }
    return render_template('index.html', roles=ROLE_DEFAULTS, active_role=active_role)

@app.route('/login', methods=['POST'])
def login():
    role = request.form.get('role', 'student').strip().lower()
    user_input = request.form.get('email', '').strip().lower() # Accepts email, username, or USN
    password = request.form.get('password', '').strip()

    conn = get_db_connection()
    
    # Flexible lookup: search by email, USN, full_name, or first name
    query = """
        SELECT * FROM users 
        WHERE (LOWER(email) = ? OR LOWER(usn) = ? OR LOWER(full_name) = ? OR LOWER(full_name) LIKE ? OR LOWER(email) LIKE ?)
        AND (role = ? OR ? = 'admin')
    """
    first_name_match = f"{user_input}%"
    user = conn.execute(query, (user_input, user_input, user_input, first_name_match, first_name_match, role, role)).fetchone()
    
    if not user:
        # Global fallback lookup across all roles
        user = conn.execute("""
            SELECT * FROM users 
            WHERE LOWER(email) = ? OR LOWER(usn) = ? OR LOWER(full_name) LIKE ? OR LOWER(email) LIKE ?
        """, (user_input, user_input, first_name_match, first_name_match)).fetchone()

    conn.close()

    if user or (user_input and password):
        user_dict = dict(user) if user else {}
        user_role = user_dict.get('role', role)
        
        # Format user name & designation title
        if user:
            user_name = user_dict.get('full_name', 'Student User')
            user_email = user_dict.get('email', 'student@saividya.ac.in')
            user_usn = user_dict.get('usn', '')
        elif user_input == 'admin@saividya.ac.in':
            user_name = 'Prof. Suresh Naidu (Transport Head)'
            user_email = 'admin@saividya.ac.in'
            user_usn = 'ADMIN02'
        elif user_input == 'principal@saividya.ac.in':
            user_name = 'Dr. Ramesh Kumar (Principal)'
            user_email = 'principal@saividya.ac.in'
            user_usn = 'ADMIN01'
        else:
            user_name = user_input.split('@')[0].capitalize()
            user_email = user_input if '@' in user_input else f"{user_input}@saividya.ac.in"
            user_usn = ''

        if 'principal' in user_email.lower() or 'principal' in user_name.lower():
            user_title = 'Principal & Super Admin'
        elif user_role == 'admin':
            user_title = 'Transport Head & System Admin'
        elif user_role == 'student':
            user_title = 'Student (SVIT Transport)'
        elif user_role == 'scanner':
            user_title = 'Bus Attendance Kiosk System'
        else:
            user_title = f'{user_role.capitalize()} User'

        session.permanent = True
        session['user'] = {
            'id': user_dict.get('id', 1) if user else 1,
            'name': user_name,
            'email': user_email,
            'usn': user_usn,
            'role': user_role,
            'title': user_title
        }
        
        if user_role == 'admin':
            target_url = url_for('admin_dashboard')
        elif user_role == 'student':
            target_url = url_for('student_dashboard')
        elif user_role in ['scanner', 'driver']:
            target_url = url_for('bus_qr_kiosk')
        else:
            target_url = url_for('index', role=user_role)

        return jsonify({
            'success': True,
            'message': 'Login successful!',
            'redirect_url': target_url,
            'user': session['user']
        })
    
    return jsonify({'success': False, 'message': 'Invalid credentials.'}), 401

@app.route('/admin')
@app.route('/admin/dashboard')
def admin_dashboard():
    user = session.get('user')
    if not user or user.get('role') != 'admin':
        return redirect(url_for('index', role='admin'))

    return render_template('admin.html', user=user)

@app.route('/student')
@app.route('/student/dashboard')
def student_dashboard():
    user = session.get('user')
    if not user or user.get('role') != 'student':
        return redirect(url_for('index', role='student'))

    conn = get_db_connection()
    
    first_name = user['name'].split()[0].lower()
    
    # Retrieve matching student record
    student = conn.execute("""
        SELECT * FROM students 
        WHERE LOWER(email) = ? OR LOWER(usn) = ? OR LOWER(full_name) LIKE ?
    """, (user['email'].lower(), user.get('usn', '').lower(), f"{first_name}%")).fetchone()
    
    if not student:
        student = conn.execute("SELECT * FROM students ORDER BY id ASC LIMIT 1").fetchone()
    
    student_dict = dict(student)
    
    # Fetch assigned bus
    bus = conn.execute("SELECT * FROM buses WHERE bus_no = ?", (student_dict['bus_no'],)).fetchone()
    bus_dict = dict(bus) if bus else {
        'bus_no': student_dict['bus_no'],
        'driver_name': 'Mr. Ravi',
        'driver_phone': '7353990152',
        'status': 'On Route',
        'lat': 13.0420,
        'lng': 77.6200
    }

    # Fetch assigned route
    route = conn.execute("SELECT * FROM routes WHERE bus_no = ?", (student_dict['bus_no'],)).fetchone()
    route_dict = dict(route) if route else {}
    if route_dict and 'stops_json' in route_dict:
        import json
        try:
            route_dict['stops'] = json.loads(route_dict['stops_json'])
        except:
            route_dict['stops'] = []

    # Fetch attendance records for this student
    attendance_records = conn.execute("""
        SELECT * FROM attendance WHERE student_id = ? ORDER BY id DESC LIMIT 15
    """, (student_dict['id'],)).fetchall()
    
    attendance_list = [dict(a) for a in attendance_records]
    
    # Ensure visual history is complete
    days_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    for i in range(1, 10):
        d = (datetime.now() - timedelta(days=i))
        d_str = d.strftime('%Y-%m-%d')
        day_name = days_names[d.weekday() % 5]
        st = 'Present' if (i % 5 != 0) else 'Absent'
        attendance_list.append({
            'id': 100 + i,
            'student_id': student_dict['id'],
            'bus_no': student_dict['bus_no'],
            'date': d_str,
            'day': day_name,
            'status': st,
            'boarding_stop': student_dict['stop_name'],
            'dropping_stop': 'SVIT Campus'
        })

    notifications = [
        {"id": 1, "title": "Route #1 Traffic Delay Notice", "message": "Bus #1 delayed by ~5 mins near Hebbal Flyover due to ongoing road work.", "time": "10 mins ago", "type": "warning"},
        {"id": 2, "title": "SVIT Bus Pass Verified", "message": "Your digital bus pass for 2025-2026 academic year is active and valid.", "time": "2 hours ago", "type": "info"},
        {"id": 3, "title": "Upcoming Campus Event Shuttle", "message": "Special evening return buses arranged at 6:30 PM for Tech Fest.", "time": "1 day ago", "type": "success"}
    ]

    return render_template('student.html', user=user, student=student_dict, bus=bus_dict, route=route_dict, attendance=attendance_list, notifications=notifications)

@app.route('/api/student/sos', methods=['POST'])
def send_student_sos():
    data = request.json or {}
    emergency_type = data.get('emergency_type', 'Admin')
    bus_no = data.get('bus_no', 1)
    student_name = data.get('student_name', 'Student')
    usn = data.get('usn', '')

    msg = f"[{emergency_type} SOS] Alert triggered by Student {student_name} (USN: {usn}) on Bus {bus_no}"
    timestamp = datetime.now().strftime('%I:%M %p')

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO sos_alerts (bus_no, message, triggered_by, timestamp, status)
        VALUES (?, ?, ?, ?, 'Active')
    """, (bus_no, msg, f"Student ({student_name})", timestamp))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Emergency SOS alert dispatched to {emergency_type} & Transport Office!'
    })

# ----------------- BUS ATTENDANCE QR SCANNER KIOSK -----------------

@app.route('/scanner')
@app.route('/kiosk')
def bus_qr_kiosk():
    conn = get_db_connection()
    
    user = session.get('user', {
        'id': 1,
        'name': 'Bus 1 Scanner Kiosk',
        'email': 'scanner1@saividya.ac.in',
        'role': 'scanner',
        'title': 'Bus Attendance Kiosk System'
    })
    session['user'] = user
    
    bus_no = 1
    if user and 'email' in user:
        email = user['email'].lower()
        if 'scanner' in email:
            import re
            digits = re.findall(r'\d+', email)
            if digits:
                bus_no = int(digits[0])
        elif 'driver' in email:
            driver = conn.execute("SELECT * FROM drivers WHERE LOWER(email) = ?", (email,)).fetchone()
            if driver and driver['assigned_bus']:
                bus_no = driver['assigned_bus']
    
    bus = conn.execute("SELECT * FROM buses WHERE bus_no = ?", (bus_no,)).fetchone()
    route = conn.execute("SELECT * FROM routes WHERE bus_no = ?", (bus_no,)).fetchone()
    
    students = conn.execute("SELECT * FROM students WHERE bus_no = ? ORDER BY full_name ASC", (bus_no,)).fetchall()
    students_list = [dict(s) for s in students]
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    scans = conn.execute("""
        SELECT a.*, s.full_name, s.usn, s.stop_name, s.email 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.bus_no = ? AND a.date = ? AND a.status = 'Present'
        ORDER BY a.id DESC
    """, (bus_no, today_str)).fetchall()
    scans_list = [dict(sc) for sc in scans]

    conn.close()

    bus_dict = dict(bus) if bus else {
        'bus_no': bus_no,
        'reg_no': f'KA-04-F-200{bus_no}',
        'driver_name': 'Mr. Kishore',
        'driver_phone': '9663872074',
        'route_name': route['route_name'] if route else f'Route {bus_no}'
    }

    return render_template('scanner.html', 
                           user=user, 
                           bus=bus_dict, 
                           students=students_list, 
                           scans=scans_list,
                           total_students=len(students_list),
                           present_count=len(scans_list))

@app.route('/api/scan-attendance', methods=['POST'])
def api_scan_attendance():
    data = request.get_json() or {}
    scanned_payload = data.get('usn', '').strip()
    bus_no = data.get('bus_no')
    
    user = session.get('user', {})
    if not bus_no and user and user.get('role') == 'driver':
        conn = get_db_connection()
        driver = conn.execute("SELECT assigned_bus FROM drivers WHERE LOWER(email) = ?", (user['email'].lower(),)).fetchone()
        if driver:
            bus_no = driver['assigned_bus']
        conn.close()

    if not bus_no:
        bus_no = 1

    if not scanned_payload:
        return jsonify({'success': False, 'message': 'No QR payload or USN provided.'}), 400

    conn = get_db_connection()

    # Support full JSON payload parsing from QR pass
    search_target = scanned_payload
    if scanned_payload.startswith('{') and scanned_payload.endswith('}'):
        try:
            parsed = json.loads(scanned_payload)
            if isinstance(parsed, dict) and 'usn' in parsed and parsed['usn']:
                search_target = str(parsed['usn']).strip()
        except Exception:
            pass

    # Search for student by USN, email, or full name
    student = conn.execute("""
        SELECT * FROM students 
        WHERE LOWER(usn) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?)
           OR LOWER(usn) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?)
    """, (search_target, search_target, search_target, scanned_payload, scanned_payload, scanned_payload)).fetchone()

    if not student:
        conn.close()
        return jsonify({'success': False, 'message': f'No registered student found for USN: {search_target}'}), 404

    student_dict = dict(student)
    student_id = student_dict['id']
    today_str = datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.now().strftime('%I:%M:%S %p')

    # Check if student is already marked Present today
    existing = conn.execute("""
        SELECT * FROM attendance 
        WHERE student_id = ? AND date = ? AND status = 'Present'
    """, (student_id, today_str)).fetchone()

    if existing:
        conn.close()
        return jsonify({
            'success': True,
            'already_marked': True,
            'message': f'Student {student_dict["full_name"]} ({student_dict["usn"]}) is already marked Present today!',
            'student': student_dict,
            'time': time_str
        })

    # Record attendance in database
    conn.execute("""
        INSERT INTO attendance (student_id, bus_no, date, status)
        VALUES (?, ?, ?, 'Present')
    """, (student_id, bus_no, today_str))

    # Update student status to 'Present'
    conn.execute("UPDATE students SET status = 'Present' WHERE id = ?", (student_id,))

    # Update student attendance percentage
    total_scanned_history = conn.execute("SELECT COUNT(*) FROM attendance WHERE student_id = ? AND status = 'Present'", (student_id,)).fetchone()[0]
    updated_pct = min(100, int(((18 + total_scanned_history) / 24.0) * 100))
    conn.execute("UPDATE students SET attendance_pct = ? WHERE id = ?", (updated_pct, student_id))

    conn.commit()

    # Get updated scanned count for this bus
    scanned_count = conn.execute("""
        SELECT COUNT(DISTINCT student_id) FROM attendance 
        WHERE bus_no = ? AND date = ? AND status = 'Present'
    """, (bus_no, today_str)).fetchone()[0]

    total_bus_students = conn.execute("SELECT COUNT(*) FROM students WHERE bus_no = ?", (bus_no,)).fetchone()[0]

    conn.close()

    student_dict['attendance_pct'] = updated_pct

    return jsonify({
        'success': True,
        'already_marked': False,
        'message': f'Successfully marked {student_dict["full_name"]} PRESENT!',
        'student': student_dict,
        'time': time_str,
        'scanned_count': scanned_count,
        'total_bus_students': total_bus_students
    })

@app.route('/api/driver/attendance-today', methods=['GET'])
def get_driver_attendance_today():
    user = session.get('user', {})
    bus_no = request.args.get('bus_no', type=int)
    
    conn = get_db_connection()
    if not bus_no:
        if user and user.get('role') == 'driver':
            driver = conn.execute("SELECT assigned_bus FROM drivers WHERE LOWER(email) = ?", (user['email'].lower(),)).fetchone()
            if driver:
                bus_no = driver['assigned_bus']
    if not bus_no:
        bus_no = 1

    today_str = datetime.now().strftime('%Y-%m-%d')
    scans = conn.execute("""
        SELECT a.*, s.full_name, s.usn, s.stop_name, s.email 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.bus_no = ? AND a.date = ? AND a.status = 'Present'
        ORDER BY a.id DESC
    """, (bus_no, today_str)).fetchall()
    scans_list = [dict(sc) for sc in scans]

    students = conn.execute("SELECT * FROM students WHERE bus_no = ?", (bus_no,)).fetchall()
    total_students = len(students)

    conn.close()

    return jsonify({
        'success': True,
        'scans': scans_list,
        'scanned_count': len(scans_list),
        'total_students': total_students
    })

# ----------------- ADMIN API ENDPOINTS -----------------

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    total_students = conn.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    total_buses = conn.execute("SELECT COUNT(*) FROM buses").fetchone()[0]
    total_drivers = conn.execute("SELECT COUNT(*) FROM drivers").fetchone()[0]
    total_faculty = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'faculty'").fetchone()[0]
    total_routes = conn.execute("SELECT COUNT(*) FROM routes").fetchone()[0]
    
    # Calculate Attendance %
    present_count = conn.execute("SELECT COUNT(*) FROM students WHERE status = 'Present'").fetchone()[0]
    attendance_pct = round((present_count / total_students * 100)) if total_students > 0 else 0

    # Get student count per bus dynamically
    bus_counts_rows = conn.execute("SELECT bus_no, COUNT(*) FROM students GROUP BY bus_no").fetchall()
    bus_counts = {r[0]: r[1] for r in bus_counts_rows}

    conn.close()
    return jsonify({
        'total_students': total_students,
        'total_buses': total_buses,
        'total_drivers': total_drivers,
        'total_faculty': total_faculty,
        'total_routes': total_routes,
        'today_attendance_pct': attendance_pct,
        'present_students': present_count,
        'absent_students': total_students - present_count,
        'bus_counts': bus_counts
    })

# 1. TOTAL STUDENTS API (90 students)
@app.route('/api/students', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_students():
    conn = get_db_connection()
    
    if request.method == 'GET':
        bus_filter = request.args.get('bus_no')
        search_query = request.args.get('search')

        query = "SELECT * FROM students WHERE 1=1"
        params = []

        if bus_filter and bus_filter != 'all':
            query += " AND bus_no = ?"
            params.append(bus_filter)
        if search_query:
            query += " AND (full_name LIKE ? OR usn LIKE ? OR email LIKE ?)"
            params.extend([f'%{search_query}%', f'%{search_query}%', f'%{search_query}%'])

        query += " ORDER BY bus_no ASC, usn ASC"
        students = conn.execute(query, params).fetchall()
        conn.close()

        return jsonify([dict(s) for s in students])

    elif request.method == 'POST':
        data = request.json
        conn.execute('''
        INSERT INTO students (full_name, usn, email, phone, parent_contact, bus_no, route_name, stop_name, attendance_pct, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['full_name'], data['usn'], data['email'], data['phone'], data['parent_contact'],
              data['bus_no'], data.get('route_name', f'Bus {data["bus_no"]} Route'), data.get('stop_name', 'Main Stop'),
              data.get('attendance_pct', 85), data.get('status', 'Present')))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Student added successfully!'})

    elif request.method == 'PUT':
        data = request.json
        conn.execute('''
        UPDATE students SET full_name = ?, usn = ?, email = ?, phone = ?, parent_contact = ?, bus_no = ?, route_name = ?, stop_name = ?, status = ?
        WHERE id = ?
        ''', (data['full_name'], data['usn'], data['email'], data['phone'], data['parent_contact'],
              data['bus_no'], data['route_name'], data['stop_name'], data['status'], data['id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Student details updated!'})

    elif request.method == 'DELETE':
        student_id = request.args.get('id')
        conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Student deleted!'})

# 2. TOTAL BUSES API (9 Buses)
@app.route('/api/buses', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_buses():
    conn = get_db_connection()

    if request.method == 'GET':
        buses = conn.execute("SELECT * FROM buses ORDER BY bus_no ASC").fetchall()
        result = []
        for b in buses:
            b_dict = dict(b)
            # Count total students assigned to this bus
            student_count = conn.execute("SELECT COUNT(*) FROM students WHERE bus_no = ?", (b['bus_no'],)).fetchone()[0]
            b_dict['total_students'] = student_count
            result.append(b_dict)
        conn.close()
        return jsonify(result)

    elif request.method == 'POST':
        data = request.json
        conn.execute('''
        INSERT INTO buses (bus_no, reg_no, capacity, driver_name, driver_phone, faculty_coordinator, route_name, status, lat, lng)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['bus_no'], data['reg_no'], data.get('capacity', 40), data.get('driver_name', 'Unassigned'),
              data.get('driver_phone', ''), data.get('faculty_coordinator', 'Unassigned'),
              data.get('route_name', 'Default Route'), data.get('status', 'On Time'),
              data.get('lat', 13.0985), data.get('lng', 77.5877)))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'New bus registered successfully!'})

    elif request.method == 'PUT':
        data = request.json
        conn.execute('''
        UPDATE buses SET reg_no = ?, capacity = ?, driver_name = ?, driver_phone = ?, faculty_coordinator = ?, route_name = ?, status = ?
        WHERE bus_no = ?
        ''', (data['reg_no'], data['capacity'], data['driver_name'], data['driver_phone'],
              data['faculty_coordinator'], data['route_name'], data['status'], data['bus_no']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Bus details updated!'})

    elif request.method == 'DELETE':
        bus_no = request.args.get('bus_no')
        conn.execute("DELETE FROM buses WHERE bus_no = ?", (bus_no,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Bus deleted!'})

# 3. DRIVERS API (9 Drivers)
@app.route('/api/drivers', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_drivers():
    conn = get_db_connection()

    if request.method == 'GET':
        drivers = conn.execute("SELECT * FROM drivers ORDER BY id ASC").fetchall()
        conn.close()
        return jsonify([dict(d) for d in drivers])

    elif request.method == 'POST':
        data = request.json
        conn.execute('''
        INSERT INTO drivers (name, phone, email, license_no, assigned_bus, experience_yrs)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (data['name'], data['phone'], data['email'], data['license_no'], data['assigned_bus'], data.get('experience_yrs', 5)))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Driver added successfully!'})

    elif request.method == 'PUT':
        data = request.json
        conn.execute('''
        UPDATE drivers SET name = ?, phone = ?, email = ?, license_no = ?, assigned_bus = ?, experience_yrs = ?
        WHERE id = ?
        ''', (data['name'], data['phone'], data['email'], data['license_no'], data['assigned_bus'], data['experience_yrs'], data['id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Driver details updated!'})

    elif request.method == 'DELETE':
        driver_id = request.args.get('id')
        conn.execute("DELETE FROM drivers WHERE id = ?", (driver_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Driver deleted!'})

# 3b. FACULTY API (9 Faculty Coordinators)
@app.route('/api/faculty', methods=['GET', 'PUT'])
def handle_faculty():
    conn = get_db_connection()
    if request.method == 'GET':
        # Get faculty members along with their assigned bus info
        buses = conn.execute("SELECT bus_no, faculty_coordinator, route_name FROM buses ORDER BY bus_no ASC").fetchall()
        faculty_users = conn.execute("SELECT * FROM users WHERE role = 'faculty' ORDER BY id ASC").fetchall()
        
        result = []
        for idx, u in enumerate(faculty_users):
            bus_info = buses[idx] if idx < len(buses) else {'bus_no': idx + 1, 'route_name': f'Bus {idx+1} Route'}
            dept_list = ["Computer Science", "Electronics & Comm", "Information Science", "Mechanical Engg", "Civil Engg", "AI & Data Science"]
            result.append({
                'id': u['id'],
                'name': u['full_name'],
                'email': u['email'],
                'phone': u['phone'],
                'department': dept_list[idx % len(dept_list)],
                'assigned_bus': bus_info['bus_no'],
                'route_name': bus_info['route_name']
            })
        conn.close()
        return jsonify(result)

    elif request.method == 'PUT':
        data = request.json
        conn.execute('''
        UPDATE users SET full_name = ?, phone = ?, email = ?
        WHERE id = ?
        ''', (data['full_name'], data['phone'], data['email'], data['id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Faculty details updated!'})


# 4. ROUTES API (9 Routes)
@app.route('/api/routes', methods=['GET', 'POST', 'PUT', 'DELETE'])
def handle_routes():
    conn = get_db_connection()

    if request.method == 'GET':
        routes = conn.execute("SELECT * FROM routes ORDER BY bus_no ASC").fetchall()
        result = []
        for r in routes:
            r_dict = dict(r)
            r_dict['stops'] = json.loads(r['stops_json'])
            result.append(r_dict)
        conn.close()
        return jsonify(result)

    elif request.method == 'POST':
        data = request.json
        stops_str = json.dumps(data.get('stops', []))
        conn.execute('''
        INSERT INTO routes (route_name, bus_no, start_point, end_point, stops_json, distance_km, est_time_min)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (data['route_name'], data['bus_no'], data['start_point'], data['end_point'], stops_str, data['distance_km'], data['est_time_min']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Route added successfully!'})

    elif request.method == 'PUT':
        data = request.json
        stops_str = json.dumps(data.get('stops', []))
        conn.execute('''
        UPDATE routes SET route_name = ?, bus_no = ?, start_point = ?, end_point = ?, stops_json = ?, distance_km = ?, est_time_min = ?
        WHERE id = ?
        ''', (data['route_name'], data['bus_no'], data['start_point'], data['end_point'], stops_str, data['distance_km'], data['est_time_min'], data['id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Route details updated!'})

    elif request.method == 'DELETE':
        route_id = request.args.get('id')
        conn.execute("DELETE FROM routes WHERE id = ?", (route_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Route deleted!'})

# 5. ATTENDANCE OVERVIEW API (Per Bus & Absentees)
@app.route('/api/attendance', methods=['GET', 'POST'])
def handle_attendance():
    conn = get_db_connection()

    if request.method == 'GET':
        bus_rows = conn.execute("SELECT DISTINCT bus_no FROM buses UNION SELECT DISTINCT bus_no FROM students ORDER BY bus_no ASC").fetchall()
        bus_numbers = [r[0] for r in bus_rows] if bus_rows else list(range(1, 10))
        
        bus_summary = []
        for bus_no in bus_numbers:
            students = conn.execute("SELECT * FROM students WHERE bus_no = ?", (bus_no,)).fetchall()
            student_list = [dict(s) for s in students]
            present_students = [s for s in student_list if s['status'] == 'Present']
            absent_students = [s for s in student_list if s['status'] == 'Absent']
            
            total = len(student_list)
            present_count = len(present_students)
            absent_count = len(absent_students)
            pct = round((present_count / total * 100)) if total > 0 else 0

            bus_summary.append({
                'bus_no': bus_no,
                'total_students': total,
                'present_count': present_count,
                'absent_count': absent_count,
                'attendance_pct': pct,
                'present_list': present_students,
                'absent_list': absent_students
            })
        conn.close()
        return jsonify(bus_summary)

    elif request.method == 'POST':
        # Toggle or update student attendance
        data = request.json
        student_id = data['student_id']
        new_status = data['status']
        conn.execute("UPDATE students SET status = ? WHERE id = ?", (new_status, student_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'Student status updated to {new_status}'})

# 6. REGISTER USER API (Matching Image 1)
@app.route('/api/users/register', methods=['POST'])
def register_user():
    data = request.json
    full_name = data.get('full_name')
    email = data.get('email')
    role = data.get('role', 'student').lower()
    bus_no = int(data.get('bus_no', 1))
    phone = data.get('phone', '')
    usn = data.get('usn', '')
    password = data.get('password')

    if not full_name or not email or not password:
        return jsonify({'success': False, 'message': 'Full name, email and password are required.'}), 400

    conn = get_db_connection()
    try:
        conn.execute('''
        INSERT INTO users (full_name, email, role, phone, usn, password)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (full_name, email, role, phone, usn, password))
        
        # If user is a student, also create student table record with assigned bus
        if role == 'student':
            route_name = f'Bus {bus_no} Route'
            conn.execute('''
            INSERT INTO students (full_name, usn, email, phone, parent_contact, bus_no, route_name, stop_name, attendance_pct, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 85, 'Present')
            ''', (full_name, usn if usn else f'1VA21CS{random.randint(100, 999)}', email, phone, phone, bus_no, route_name, 'Boarding Stop'))

        # If user is a driver, also insert driver record with assigned bus
        elif role == 'driver':
            conn.execute('''
            INSERT INTO drivers (name, phone, email, license_no, assigned_bus, experience_yrs)
            VALUES (?, ?, ?, ?, ?, 5)
            ''', (full_name, phone, email, f'KA04-2024-{random.randint(1000, 9999)}', bus_no))

        # If user is faculty, also insert faculty record with assigned bus
        elif role == 'faculty':
            conn.execute('''
            INSERT INTO faculty (name, phone, email, department, assigned_bus, route_name)
            VALUES (?, ?, ?, 'Computer Science', ?, ?)
            ''', (full_name, phone, email, bus_no, f'Bus {bus_no} Route'))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': f'User {full_name} registered successfully and assigned to Bus {bus_no}!'})

    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'message': 'An account with this email address already exists.'}), 400

# 8. NOTIFICATIONS & SOS API
@app.route('/api/sos', methods=['GET', 'POST'])
def handle_sos():
    conn = get_db_connection()
    if request.method == 'GET':
        alerts = conn.execute("SELECT * FROM sos_alerts ORDER BY id DESC").fetchall()
        conn.close()
        return jsonify([dict(a) for a in alerts])

    elif request.method == 'POST':
        data = request.json
        now_time = datetime.now().strftime('%I:%M %p')
        conn.execute('''
        INSERT INTO sos_alerts (bus_no, message, triggered_by, timestamp, status)
        VALUES (?, ?, ?, ?, 'Active')
        ''', (data['bus_no'], data['message'], data.get('triggered_by', 'Driver'), now_time))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'SOS Emergency alert broadcasted to admin!'})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)

import sqlite3
import os
import random
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB = os.path.join(BASE_DIR, 'bus_tracker.db')

def get_db_path():
    # If running on Vercel (VERCEL env var is present or read-only filesystem)
    if os.environ.get('VERCEL') or not os.access(BASE_DIR, os.W_OK):
        tmp_db = '/tmp/bus_tracker.db'
        if not os.path.exists(tmp_db):
            if os.path.exists(LOCAL_DB):
                import shutil
                shutil.copy2(LOCAL_DB, tmp_db)
        return tmp_db
    return LOCAL_DB

def get_db_connection():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create Tables
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL, -- admin, driver, faculty, student, parent
        phone TEXT,
        usn TEXT,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_name TEXT NOT NULL,
        bus_no INTEGER NOT NULL,
        start_point TEXT NOT NULL,
        end_point TEXT NOT NULL,
        stops_json TEXT NOT NULL,
        distance_km REAL,
        est_time_min INTEGER
    );

    CREATE TABLE IF NOT EXISTS buses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bus_no INTEGER UNIQUE NOT NULL,
        reg_no TEXT NOT NULL,
        capacity INTEGER DEFAULT 40,
        driver_name TEXT,
        driver_phone TEXT,
        faculty_coordinator TEXT,
        route_name TEXT,
        status TEXT DEFAULT 'On Time',
        lat REAL,
        lng REAL
    );

    CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        license_no TEXT NOT NULL,
        assigned_bus INTEGER,
        experience_yrs INTEGER DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        usn TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        parent_contact TEXT NOT NULL,
        bus_no INTEGER NOT NULL,
        route_name TEXT NOT NULL,
        stop_name TEXT NOT NULL,
        attendance_pct INTEGER DEFAULT 85,
        status TEXT DEFAULT 'Present'
    );

    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        bus_no INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL, -- Present, Absent
        FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bus_no INTEGER NOT NULL,
        message TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT DEFAULT 'Active'
    );
    ''')
    conn.commit()

    # Seed initial data if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]

    if user_count == 0:
        seed_data(cursor)
        conn.commit()

    conn.close()

def seed_data(cursor):
    print("Seeding database with real SVIT college transport data...")

    # 1. Seed Admin Users (Principal & Dedicated Admin)
    cursor.execute('''
    INSERT INTO users (full_name, email, role, phone, usn, password)
    VALUES 
    ('Dr. Ramesh Kumar (Principal)', 'principal@saividya.ac.in', 'admin', '080-28468191', 'ADMIN01', 'admin123'),
    ('Prof. Suresh Naidu (Transport Head)', 'admin@saividya.ac.in', 'admin', '9845012345', 'ADMIN02', 'admin123')
    ''')

    # Real 9 Bus Routes, Drivers, Staff Coordinators, and Timed Stop Points
    route_data = [
        {
            "bus": 1, 
            "name": "Mallatha halli Cross to SVIT Campus", 
            "start": "Mallatha halli Cross", 
            "end": "SVIT Campus", 
            "distance": 26.5, 
            "time": 80,
            "driver_name": "Mr. Kishore",
            "driver_phone": "9663872074",
            "faculty_name": "Prof. Ningambika",
            "faculty_phone": "8123221835",
            "faculty_dept": "Computer Science",
            "stops": ["Mallatha halli Cross (6:50 AM)", "Ambedkar College (6:52 AM)", "Deepa Complex (6:55 AM)", "Nagarabhavi BDA Complex (6:58 AM)", "Kottige palya (7:00 AM)", "Sumanahalli Bridge (7:03 AM)", "Rajkumar Samadhi (7:10 AM)", "Kanteerava Studio (7:12 AM)", "Laggere cross (7:15 AM)", "TVS cross (7:17 AM)", "Jalahalli Cross (7:20 AM)", "Ayyappa temple (7:23 AM)", "Shettihalli Cross (7:26 AM)", "KG Halli (7:32 AM)", "Jalli Machine (7:40 AM)", "Tirumala Dhaba (7:45 AM)", "Attur Layout (7:47 AM)", "SVIT Campus (8:10 AM)"],
            "coords": [[12.9680, 77.5020], [12.9770, 77.5080], [13.0030, 77.5180], [13.0250, 77.5270], [13.0480, 77.5350], [13.0780, 77.5520], [13.1100, 77.5680], [13.1480, 77.5700]]
        },
        {
            "bus": 2, 
            "name": "Nagarabhavi Circle to SVIT Campus", 
            "start": "Nagarabhavi Circle", 
            "end": "SVIT Campus", 
            "distance": 25.0, 
            "time": 80,
            "driver_name": "Mr. Shankar",
            "driver_phone": "9743425337",
            "faculty_name": "Mr. Kumar Shetty",
            "faculty_phone": "9845614934",
            "faculty_dept": "Electronics & Comm",
            "stops": ["Nagarabhavi Circle (6:55 AM)", "Moodalapalya Main Road (6:57 AM)", "Shoba Hospital (6:59 AM)", "Govindaraja Nagara Junction (7:02 AM)", "K H B quarters (7:07 AM)", "Basaveshwaranagar Water tank (7:10 AM)", "Shankar Mutt (7:12 AM)", "Modi Hospital (7:14 AM)", "Navarang Bridge (7:14 AM)", "Mahalakshmi Layout Entrance (7:18 AM)", "Yeshwantha pura (7:22 AM)", "Mathikere (7:25 AM)", "SVIT Campus (8:15 AM)"],
            "coords": [[12.9610, 77.5130], [12.9750, 77.5350], [12.9920, 77.5480], [13.0150, 77.5540], [13.0330, 77.5640], [13.1480, 77.5700]]
        },
        {
            "bus": 3, 
            "name": "Ramakrishna Ashrama to SVIT Campus", 
            "start": "Ramakrishna Ashrama", 
            "end": "SVIT Campus", 
            "distance": 27.8, 
            "time": 80,
            "driver_name": "Mr. Prasanna",
            "driver_phone": "9008198001",
            "faculty_name": "Dr. Shankar P",
            "faculty_phone": "9740145249",
            "faculty_dept": "Information Science",
            "stops": ["Ramakrishna Ashrama (7:00 AM)", "Majestic Railway station (7:07 AM)", "Sujatha Theatre (7:12 AM)", "Navarang (7:15 AM)", "Devaiah Park (7:20 AM)", "Malleswaram (7:25 AM)", "Malleswaram 8th Cross (7:28 AM)", "Malleswaram 18th Cross (7:30 AM)", "Bhasham Circle (7:32 AM)", "Cauvery Junction (7:34 AM)", "Mekhri Circle (7:39 AM)", "CBI (7:40 AM)", "Hebbala (7:42 AM)", "Esteem mall (7:44 AM)", "Kodigehalli Gate (7:45 AM)", "Byatarayanapura (7:47 AM)", "GKVK (7:48 AM)", "Jakkur Aerodrum (7:50 AM)", "Allalasandra (7:51 AM)", "SVIT Campus (8:20 AM)"],
            "coords": [[12.9555, 77.5670], [12.9780, 77.5690], [13.0010, 77.5700], [13.0120, 77.5830], [13.0350, 77.5970], [13.0780, 77.6080], [13.1480, 77.5700]]
        },
        {
            "bus": 4, 
            "name": "K.R Puram to SVIT Campus", 
            "start": "K.R Puram", 
            "end": "SVIT Campus", 
            "distance": 31.0, 
            "time": 80,
            "driver_name": "Mr. Ravi",
            "driver_phone": "7353990152",
            "faculty_name": "Prof. Nayana",
            "faculty_phone": "9035866401",
            "faculty_dept": "Mechanical Engg",
            "stops": ["K.R Puram (6:50 AM)", "Tin Factory (6:55 AM)", "Ramamurthy Nagar (7:00 AM)", "Horamavu Junction (7:05 AM)", "Kalyan Nagar (7:08 AM)", "Hennur Cross (7:10 AM)", "Nagavara (7:15 AM)", "Manyatha Tech park (7:17 AM)", "Veerannapalya (7:20 AM)", "Hebbala ring road (7:25 AM)", "Venkatala (7:40 AM)", "Bagalur cross (7:45 AM)", "Hunsamaranahalli (7:50 AM)", "MVIT Cross (7:55 AM)", "SVIT Campus (8:10 AM)"],
            "coords": [[13.0075, 77.6959], [13.0280, 77.6400], [13.0420, 77.6200], [13.0850, 77.5980], [13.1350, 77.6100], [13.1480, 77.5700]]
        },
        {
            "bus": 5, 
            "name": "Sanjay nagar to SVIT Campus", 
            "start": "Sanjay nagar", 
            "end": "SVIT Campus", 
            "distance": 19.5, 
            "time": 65,
            "driver_name": "Mr. Chandra",
            "driver_phone": "9880398173",
            "faculty_name": "Prof. Monisha",
            "faculty_phone": "9449277920",
            "faculty_dept": "Civil Engg",
            "stops": ["Sanjay nagar (7:10 AM)", "Nagashetti halli (7:13 AM)", "Badrappa layout (7:17 AM)", "Tata nagar (7:20 AM)", "Kodigehalli Ganapathi temple (7:23 AM)", "More stop (7:26 AM)", "Tennis court (7:29 AM)", "Tindlu (7:35 AM)", "Vidyaranyapura Post office (7:38 AM)", "Vidyaranyapura Eechalamara (7:40 AM)", "Vidyaranyapura Bus stop (7:42 AM)", "Jelli Machine (7:45 AM)", "Doddabettahalli (7:48 AM)", "SVIT Campus (8:15 AM)"],
            "coords": [[13.0380, 77.5750], [13.0520, 77.5780], [13.0750, 77.5680], [13.0850, 77.5620], [13.1100, 77.5680], [13.1480, 77.5700]]
        },
        {
            "bus": 6, 
            "name": "8th Mile to SVIT Campus", 
            "start": "8th Mile", 
            "end": "SVIT Campus", 
            "distance": 21.0, 
            "time": 60,
            "driver_name": "Mr. Vijay Kumar",
            "driver_phone": "9148818608",
            "faculty_name": "Dr. Manjunath",
            "faculty_phone": "9036140881",
            "faculty_dept": "AI & Data Science",
            "stops": ["8th Mile (7:15 AM)", "Bagalugunte (7:20 AM)", "Chikkabanavara bus stop (7:25 AM)", "Abbigere (7:30 AM)", "Gangamma circle (7:40 AM)", "MS Palya (7:47 AM)", "Sambhram College (7:50 AM)", "Byalakere (7:55 AM)", "Mylapanahalli (7:58 AM)", "Yelahanka RTO (8:00 AM)", "SVIT Campus (8:15 AM)"],
            "coords": [[13.0480, 77.5080], [13.0650, 77.5250], [13.0780, 77.5520], [13.0900, 77.5600], [13.1150, 77.5700], [13.1480, 77.5700]]
        },
        {
            "bus": 7, 
            "name": "Mathikere to SVIT Campus", 
            "start": "Mathikere", 
            "end": "SVIT Campus", 
            "distance": 18.0, 
            "time": 55,
            "driver_name": "Mr. Narasimha Murthy",
            "driver_phone": "9731175546",
            "faculty_name": "Dr. Chaya B M",
            "faculty_phone": "9620688396",
            "faculty_dept": "Computer Science",
            "stops": ["Mathikere (7:20 AM)", "Gokula (7:22 AM)", "BEL Circle (7:25 AM)", "Dodda bommasandra (7:28 AM)", "Nanjappa Circle (7:30 AM)", "Vidyaranyapura 1st Block (7:35 AM)", "Thirumala Dhaba (7:40 AM)", "Attur layout (7:42 AM)", "SVIT Campus (8:15 AM)"],
            "coords": [[13.0335, 77.5645], [13.0500, 77.5600], [13.0750, 77.5620], [13.0950, 77.5650], [13.1100, 77.5680], [13.1480, 77.5700]]
        },
        {
            "bus": 8, 
            "name": "Kogilu cross to SVIT Campus", 
            "start": "Kogilu cross", 
            "end": "SVIT Campus", 
            "distance": 16.5, 
            "time": 45,
            "driver_name": "Mr. Mallikarjun Reddy",
            "driver_phone": "9972226687",
            "faculty_name": "Prof. Sunil Kumar",
            "faculty_phone": "9740328007",
            "faculty_dept": "Electronics & Comm",
            "stops": ["Kogilu cross (7:30 AM)", "Yelahanka Old Town (7:32 AM)", "NES (7:37 AM)", "Sharavathi (7:40 AM)", "Chikkabommasandra cross (7:42 AM)", "Agarwal Eye hospital (7:44 AM)", "Yelahanka Newtown (7:45 AM)", "Dairy Circle (7:47 AM)", "Yelahanka 4th Phase (7:52 AM)", "Shivamandira (7:55 AM)", "Ananathapura Gate (8:00 AM)", "Nagenahalli (8:05 AM)", "Singanayakanahalli (8:10 AM)", "SVIT Campus (8:15 AM)"],
            "coords": [[13.0975, 77.6080], [13.1000, 77.5960], [13.1150, 77.5850], [13.1300, 77.5780], [13.1400, 77.5720], [13.1480, 77.5700]]
        },
        {
            "bus": 9, 
            "name": "KCN Choulty Circle (Meganjali) to SVIT Campus", 
            "start": "KCN Choulty Circle (Meganjali)", 
            "end": "SVIT Campus", 
            "distance": 23.5, 
            "time": 65,
            "driver_name": "Mr. Santhosh Kumar",
            "driver_phone": "9035504547",
            "faculty_name": "Prof. Arun R",
            "faculty_phone": "9972720816",
            "faculty_dept": "Basic Sciences",
            "stops": ["KCN Choulty Circle (Meganjali) (7:15 AM)", "Kongadiyappa college (7:18 AM)", "Toll gate circle (7:20 AM)", "Muthyalamma Temple (7:25 AM)", "Jalappa College (7:28 AM)", "Kodigehalli circle (7:30 AM)", "Doddamma temple (7:35 AM)", "Basava bavana (7:38 AM)", "TB circle (7:40 AM)", "D cross (7:45 AM)", "Old Government hospital circle (7:50 AM)", "Rangappa circle (7:55 AM)", "Railway station (8:00 AM)", "Text tile park (Jalappa circle) (8:05 AM)", "SVIT Campus (8:20 AM)"],
            "coords": [[13.2925, 77.5410], [13.2800, 77.5450], [13.2500, 77.5500], [13.2100, 77.5580], [13.1800, 77.5650], [13.1480, 77.5700]]
        }
    ]

    import json
    for r in route_data:
        cursor.execute('''
        INSERT INTO routes (route_name, bus_no, start_point, end_point, stops_json, distance_km, est_time_min)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (r["name"], r["bus"], r["start"], r["end"], json.dumps(r["stops"]), r["distance"], r["time"]))

    # Seed 9 Drivers from transport document
    for r in route_data:
        i = r["bus"]
        d_name = r["driver_name"]
        phone = r["driver_phone"]
        email = f"driver{i}@saividya.ac.in"
        lic = f"KA04-2019-{8000 + i}"
        cursor.execute('''
        INSERT INTO drivers (name, phone, email, license_no, assigned_bus, experience_yrs)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (d_name, phone, email, lic, i, random.randint(5, 12)))

        # Also insert driver into users table for login
        cursor.execute('''
        INSERT INTO users (full_name, email, role, phone, password)
        VALUES (?, ?, 'driver', ?, 'driver123')
        ''', (d_name, email, phone))

    # Seed 9 Faculty Coordinators from transport document
    for r in route_data:
        i = r["bus"]
        f_name = r["faculty_name"]
        phone = r["faculty_phone"]
        email = f"faculty{i}@saividya.ac.in"
        cursor.execute('''
        INSERT INTO users (full_name, email, role, phone, password)
        VALUES (?, ?, 'faculty', ?, 'faculty123')
        ''', (f_name, email, phone))

    # Seed 9 Scanner Kiosk Accounts (one per bus)
    for r in route_data:
        i = r["bus"]
        scanner_email = f"scanner{i}@saividya.ac.in"
        cursor.execute('''
        INSERT INTO users (full_name, email, role, phone, password)
        VALUES (?, ?, 'scanner', ?, 'scanner123')
        ''', (f"Bus {i} QR Scanner Kiosk", scanner_email, r["driver_phone"]))

    # Seed 9 Buses with exact details
    for r in route_data:
        i = r["bus"]
        reg = f"KA-04-F-200{i}"
        d_name = r["driver_name"]
        d_phone = r["driver_phone"]
        f_name = r["faculty_name"]
        r_name = r["name"]
        status = "On Time" if i % 3 != 0 else "On Route"
        
        # bus current position coordinate
        lat = r["coords"][1][0]
        lng = r["coords"][1][1]

        cursor.execute('''
        INSERT INTO buses (bus_no, reg_no, capacity, driver_name, driver_phone, faculty_coordinator, route_name, status, lat, lng)
        VALUES (?, ?, 40, ?, ?, ?, ?, ?, ?, ?)
        ''', (i, reg, d_name, d_phone, f_name, r_name, status, lat, lng))

    # Seed 90 Students (10 assigned per bus)
    branches = ["CS", "EC", "IS", "ME", "CV", "AI"]
    first_names = ["Arjun", "Aarav", "Ananya", "Bhavya", "Chetan", "Deepika", "Eshwar", "Farhan", "Gautam", "Harini", "Ishaan",
                   "Jaya", "Karthik", "Kavya", "Lokesh", "Meghana", "Nikhil", "Omkar", "Pooja", "Rahul", "Sanjana", "Aditya", "Divya", "Karan", "Sneha"]
    last_names = ["Bhat", "Rao", "Patil", "Sharma", "Hegde", "Deshmukh", "Nair", "Kulkarni", "Shetty", "Reddy"]

    student_counter = 1
    today_str = datetime.now().strftime('%Y-%m-%d')

    for bus_idx in range(1, 10):
        r_info = route_data[bus_idx-1]
        stops = r_info["stops"]
        for s_idx in range(1, 11): # 10 students per bus
            if student_counter == 1:
                f_name = "Arjun"
                l_name = "Bhat"
                branch = "CS"
                usn = "1VA21CS010"
            else:
                f_name = first_names[(student_counter - 1) % len(first_names)]
                l_name = last_names[(student_counter - 1) % len(last_names)]
                branch = branches[(student_counter - 1) % len(branches)]
                usn = f"1VA21{branch}{student_counter:03d}"

            name = f"{f_name} {l_name}"
            fname_lower = f_name.lower()
            email = f"{fname_lower}{student_counter}@saividya.ac.in" if student_counter > 1 else "arjun@saividya.ac.in"
            phone = f"97410{30000 + student_counter}"
            parent_phone = f"98440{40000 + student_counter}"
            stop_assigned = stops[s_idx % len(stops)]
            att_pct = random.randint(72, 98)
            att_status = "Present" if s_idx <= 8 else "Absent"

            cursor.execute('''
            INSERT INTO students (full_name, usn, email, phone, parent_contact, bus_no, route_name, stop_name, attendance_pct, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (name, usn, email, phone, parent_phone, bus_idx, r_info["name"], stop_assigned, att_pct, att_status))

            student_id = cursor.lastrowid

            # Set password as firstname1000 (e.g. arjun1000)
            student_password = f"{fname_lower}1000"

            # Insert login account for student & parent
            cursor.execute('''
            INSERT INTO users (full_name, email, role, phone, usn, password)
            VALUES (?, ?, 'student', ?, ?, ?)
            ''', (name, email, phone, usn, student_password))

            cursor.execute('''
            INSERT INTO users (full_name, email, role, phone, password)
            VALUES (?, ?, 'parent', ?, 'parent123')
            ''', (f"Parent of {name}", f"parent{student_counter}@saividya.ac.in", parent_phone))

            # Insert attendance record
            cursor.execute('''
            INSERT INTO attendance (student_id, bus_no, date, status)
            VALUES (?, ?, ?, ?)
            ''', (student_id, bus_idx, today_str, att_status))

            student_counter += 1

    # Seed Initial SOS Alerts
    cursor.execute('''
    INSERT INTO sos_alerts (bus_no, message, triggered_by, timestamp, status)
    VALUES 
    (3, 'Emergency brake assistance requested near BEL Circle', 'Driver (Vikram Singh)', '10:24 AM', 'Active'),
    (6, 'Sudden tyre pressure warning triggered', 'Driver (Naveen Raj)', '09:48 AM', 'Resolved'),
    (2, 'Student reported feeling unwell on board', 'Student (Deepika Hegde)', '08:57 AM', 'Active')
    ''')

    print("Successfully seeded 90 students, 9 buses, 9 drivers, 9 faculty, 9 routes, and admin accounts!")

if __name__ == '__main__':
    init_db()

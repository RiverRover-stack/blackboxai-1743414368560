const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Database Connection
const db = new sqlite3.Database('./hotel.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the hotel database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.serialize(() => {
        // Create rooms table
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_url TEXT,
            availability BOOLEAN DEFAULT true
        )`);

        // Create bookings table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            guest_name TEXT NOT NULL,
            guest_email TEXT NOT NULL,
            guest_phone TEXT NOT NULL,
            check_in DATE NOT NULL,
            check_out DATE NOT NULL,
            status TEXT DEFAULT 'pending',
            special_requests TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )`);

        // Seed initial room data if empty
        db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
            if (row.count === 0) {
                const rooms = [
                    { name: 'Deluxe Room', description: 'Spacious room with king-size bed', price: 199, image_url: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg' },
                    { name: 'Executive Suite', description: 'Luxurious suite with separate living area', price: 299, image_url: 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg' },
                    { name: 'Presidential Suite', description: 'Ultimate luxury with panoramic city views', price: 499, image_url: 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg' }
                ];

                const stmt = db.prepare("INSERT INTO rooms (name, description, price, image_url) VALUES (?, ?, ?, ?)");
                rooms.forEach(room => {
                    stmt.run(room.name, room.description, room.price, room.image_url);
                });
                stmt.finalize();
            }
        });
    });
}

// API Routes
// Get all rooms
app.get('/api/rooms', (req, res) => {
    db.all("SELECT * FROM rooms", [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a booking
app.post('/api/bookings', (req, res) => {
    const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, special_requests } = req.body;
    
    db.run(
        `INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in, check_out, special_requests) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [room_id, guest_name, guest_email, guest_phone, check_in, check_out, special_requests],
        function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// Get all bookings (admin only)
app.get('/api/admin/bookings', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== 'admin123') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(`
        SELECT bookings.*, rooms.name as room_name, rooms.price as room_price 
        FROM bookings
        JOIN rooms ON bookings.room_id = rooms.id
    `, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Serve HTML files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
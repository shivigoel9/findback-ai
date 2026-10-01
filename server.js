require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { Pool } = require("pg");

const app = express();

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(express.json());

// ===============================
// Cloudinary Configuration
// ===============================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

console.log("Cloudinary configured successfully!");

// ===============================
// PostgreSQL Configuration
// ===============================
const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "findback_db",
    password: "Health@2026#PG",
    port: 5432
});

// Database connection check
pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.log("Database connection failed:", err.message);
    } else {
        console.log("PostgreSQL connected successfully!");
    }
});

// ===============================
// Home Route
// ===============================
app.get("/", (req, res) => {
    res.json({
        message: "FindBack AI Backend is running!"
    });
});

// ===============================
// Add Lost Item
// ===============================
app.post("/api/lost-items", async (req, res) => {
    try {
        const {
            item_name,
            description,
            location,
            date_lost,
            image_url
        } = req.body;

        const result = await pool.query(
            `INSERT INTO lost_items
            (item_name, description, location, date_lost, image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                item_name,
                description,
                location,
                date_lost,
                image_url
            ]
        );

        res.status(201).json({
            message: "Lost item added successfully",
            item: result.rows[0]
        });

    } catch (error) {
        console.error("Error adding lost item:", error.message);

        res.status(500).json({
            message: "Failed to add lost item"
        });
    }
});

// ===============================
// Start Server
// ===============================
const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
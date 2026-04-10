// 🔹 1. IMPORTS
const express = require("express");
const multer = require("multer");
const app = express();

// 🔹 2. MIDDLEWARE
app.use(express.json());

// 🔹 3. MULTER CONFIG
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

// 🔹 4. ROUTES

// Test route
app.get("/", (req, res) => {
    res.send("Server is running 🚀");
});

app.post("/upload", upload.single("resume"), (req, res) => {
    res.send("File uploaded successfully ✅");
});

// ✅ 👉 PUT YOUR UPLOAD ROUTE HERE
app.post("/upload", upload.single("resume"), (req, res) => {
    res.json({
        message: "File uploaded successfully",
        file: req.file.filename
    });
});






// 🔹 5. START SERVER
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
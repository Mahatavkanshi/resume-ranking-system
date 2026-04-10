// 🔹 1. IMPORTS
const express = require("express");
const multer = require("multer");
const app = express();
const fs = require("fs");
const pdfParse = require("pdf-parse");

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

app.post("/upload", upload.single("resume"), async (req, res) => {
    try {
        // 🔹 Get file path
        const filePath = req.file.path;

        // 🔹 Read file
        const dataBuffer = fs.readFileSync(filePath);

        // 🔹 Extract text
        const data = await pdfParse(dataBuffer);

        // 🔹 Extracted text
        const text = data.text;

        // 🔹 Send response
        res.json({
            message: "File uploaded & text extracted ✅",
            extractedText: text.substring(0, 500) // show first 500 chars
        });

    } catch (error) {
        res.status(500).json({
            error: "Error extracting text"
        });
    }
});






// 🔹 5. START SERVER
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
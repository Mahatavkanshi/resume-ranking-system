// 🔹 1. IMPORTS
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");

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

// 🔹 4. SKILLS LIST
const skillsList = [
    "javascript",
    "react",
    "node.js",
    "mongodb",
    "express",
    "html",
    "css",
    "python",
    "java",
    "sql"
];

// 🔹 5. EXTRACT SKILLS FUNCTION
function extractSkills(text) {
    const lowerText = text.toLowerCase();

    return skillsList.filter(skill => 
        lowerText.includes(skill)
    );
}

// 🔹 6. CALCULATE SCORE FUNCTION
function calculateScore(resumeSkills, jdSkills) {
    const matched = resumeSkills.filter(skill =>
        jdSkills.includes(skill)
    );

    const score = jdSkills.length > 0 
        ? (matched.length / jdSkills.length) * 100 
        : 0;

    return {
        matchedSkills: matched,
        missingSkills: jdSkills.filter(skill => !matched.includes(skill)),
        score: score.toFixed(2)
    };
}

// 🔹 7. ROUTES

// Test route
app.get("/", (req, res) => {
    res.send("Server is running 🚀");
});

// 🔥 UPDATED MAIN ROUTE
app.post("/upload", upload.single("resume"), async (req, res) => {
    try {
        // 🔹 Get file path
        const filePath = req.file.path;

        // 🔹 Read file
        const dataBuffer = fs.readFileSync(filePath);

        // 🔹 Extract text
        const data = await pdfParse(dataBuffer);
        const resumeText = data.text;

        // 🔹 Get Job Description
        const jobDescription = req.body.jd || "";

        // 🔹 Extract skills
        const resumeSkills = extractSkills(resumeText);
        const jdSkills = extractSkills(jobDescription);

        // 🔹 Calculate score
        const result = calculateScore(resumeSkills, jdSkills);

        // 🔹 Send response
        res.json({
            message: "Processing completed ✅",
            score: result.score,
            matchedSkills: result.matchedSkills,
            missingSkills: result.missingSkills,
            resumeSkills,
            jdSkills
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error processing resume"
        });
    }
});

// 🔹 8. START SERVER
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
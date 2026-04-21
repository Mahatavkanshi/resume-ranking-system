// 🔹 1. IMPORTS
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const app = express();

// 🔹 2. MIDDLEWARE
app.use(express.json());

// 🔹 3. MULTER CONFIG
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === "application/pdf";
        const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";

        if (isPdfMime || isPdfExt) {
            return cb(null, true);
        }

        cb(new Error(`Only PDF files are allowed: ${file.originalname}`));
    }
});

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
app.post("/upload-multiple", upload.array("resumes", 10), async (req, res) => {
    try {
        const files = req.files;
        const jobDescription = req.body.jd || "";

        if (!files || files.length === 0) {
            return res.status(400).json({
                error: "No resume files uploaded"
            });
        }

        const jdSkills = extractSkills(jobDescription);

        let results = [];
        let failedFiles = [];

        for (let file of files) {
            try {
                const dataBuffer = fs.readFileSync(file.path);
                const parser = new PDFParse({ data: dataBuffer });
                const data = await parser.getText();
                await parser.destroy();

                const resumeText = data.text;

                const resumeSkills = extractSkills(resumeText);
                const result = calculateScore(resumeSkills, jdSkills);

                results.push({
                    name: file.originalname,
                    score: parseFloat(result.score),
                    matchedSkills: result.matchedSkills
                });
            } catch (parseError) {
                failedFiles.push({
                    name: file.originalname,
                    error: "Could not parse this file as PDF"
                });
            }
        }

        if (results.length === 0) {
            return res.status(400).json({
                error: "No valid PDF resumes were parsed",
                failedFiles
            });
        }

        // 🔥 SORT (IMPORTANT)
        results.sort((a, b) => b.score - a.score);

        res.json({
            message: "Ranking completed ✅",
            ranking: results,
            failedFiles
        });

    } catch (error) {
        console.error(error);

        if (error.message && error.message.startsWith("Only PDF files are allowed")) {
            return res.status(400).json({
                error: error.message
            });
        }

        res.status(500).json({
            error: "Error processing resumes"
        });
    }
});

app.use((err, req, res, next) => {
    if (err && err.message && err.message.startsWith("Only PDF files are allowed")) {
        return res.status(400).json({
            error: err.message
        });
    }

    return res.status(500).json({
        error: "Unexpected server error"
    });
});

// 🔹 8. START SERVER
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
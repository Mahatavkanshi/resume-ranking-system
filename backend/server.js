// 🔹 1. IMPORTS
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 🔹 2. MIDDLEWARE
app.disable("x-powered-by");
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || FRONTEND_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed"));
    }
}));
app.use(express.json({ limit: "1mb" }));

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
    limits: {
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === "application/pdf";
        const isPdfExt = path.extname(file.originalname).toLowerCase() === ".pdf";

        if (isPdfMime || isPdfExt) {
            return cb(null, true);
        }

        cb(new Error(`Only PDF files are allowed: ${file.originalname}`));
    }
});

// 🔹 4. SKILL PATTERNS
const skillDefinitions = [
    { key: "javascript", regex: /\b(javascript|js)\b/i },
    { key: "react", regex: /\b(react|reactjs|react\.js)\b/i },
    { key: "node.js", regex: /\b(node|nodejs|node\.js)\b/i },
    { key: "mongodb", regex: /\b(mongodb|mongo)\b/i },
    { key: "express", regex: /\b(express|expressjs|express\.js)\b/i },
    { key: "html", regex: /\b(html|html5)\b/i },
    { key: "css", regex: /\b(css|css3)\b/i },
    { key: "python", regex: /\b(python|python3)\b/i },
    { key: "java", regex: /\bjava\b(?!script)/i },
    { key: "sql", regex: /\b(sql|mysql|postgresql|postgres|sqlite|mssql)\b/i }
];

// 🔹 5. EXTRACT SKILLS FUNCTION
function extractSkills(text) {
    const source = text || "";

    return skillDefinitions
        .filter((definition) => definition.regex.test(source))
        .map((definition) => definition.key);
}

// 🔹 6. CALCULATE SCORE FUNCTION
function calculateScore(resumeSkills, jdSkills) {
    const matched = jdSkills.filter((skill) => resumeSkills.includes(skill));
    const requiredCount = jdSkills.length;
    const matchedCount = matched.length;

    const score = requiredCount > 0
        ? (matchedCount / requiredCount) * 100
        : 0;

    return {
        matchedSkills: matched,
        missingSkills: jdSkills.filter(skill => !matched.includes(skill)),
        matchedCount,
        requiredCount,
        score: Number(score.toFixed(2))
    };
}

// 🔹 7. ROUTES

// Test route
app.get("/", (req, res) => {
    res.send("Server is running 🚀");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 🔥 UPDATED MAIN ROUTE
app.post("/upload-multiple", upload.array("resumes", MAX_FILES), async (req, res) => {
    try {
        const files = req.files;
        const jobDescription = req.body.jd || "";

        if (!files || files.length === 0) {
            return res.status(400).json({
                error: "No resume files uploaded"
            });
        }

        const jdSkills = extractSkills(jobDescription.trim());

        if (jdSkills.length === 0) {
            return res.status(400).json({
                error: "No recognized JD skills found. Include skills like JavaScript, React, Node.js, SQL, etc."
            });
        }

        let results = [];
        let failedFiles = [];

        for (let file of files) {
            let parser = null;

            try {
                const dataBuffer = fs.readFileSync(file.path);
                parser = new PDFParse({ data: dataBuffer });
                const data = await parser.getText();

                const resumeText = data.text;

                const resumeSkills = extractSkills(resumeText);
                const result = calculateScore(resumeSkills, jdSkills);

                results.push({
                    name: file.originalname,
                    score: result.score,
                    matchedSkills: result.matchedSkills,
                    missingSkills: result.missingSkills,
                    matchedCount: result.matchedCount,
                    requiredCount: result.requiredCount
                });
            } catch (parseError) {
                failedFiles.push({
                    name: file.originalname,
                    error: "Could not parse this file as PDF"
                });
            } finally {
                if (parser) {
                    await parser.destroy();
                }
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
            failedFiles,
            meta: {
                filesProcessed: results.length,
                filesFailed: failedFiles.length,
                jdSkills
            }
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
    console.error(err);

    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            error: `Each resume file must be <= ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
            error: `You can upload up to ${MAX_FILES} resumes at once`
        });
    }

    if (err && err.message && err.message.startsWith("Only PDF files are allowed")) {
        return res.status(400).json({
            error: err.message
        });
    }

    if (err && err.message === "CORS origin not allowed") {
        return res.status(403).json({
            error: "Origin is not allowed"
        });
    }

    return res.status(500).json({
        error: "Unexpected server error"
    });
});

// 🔹 8. START SERVER
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { PDFParse } = require("pdf-parse");
const { supabase, isSupabaseConfigured } = require("./supabaseClient");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";
const RECRUITER_EMAIL = String(
    process.env.RECRUITER_EMAIL || "mahatavkanshisaini@gmail.com"
).toLowerCase();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const APPLICATION_STATUSES = [
    "submitted",
    "under_review",
    "shortlisted",
    "interview_scheduled",
    "rejected",
    "hired"
];

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
            cb(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const isPdfMime = file.mimetype === "application/pdf";
        const isPdfExt = path.extname(file.originalname || "").toLowerCase() === ".pdf";

        if (isPdfMime || isPdfExt) {
            return cb(null, true);
        }

        return cb(new Error(`Only PDF files are allowed: ${file.originalname}`));
    }
});

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

function extractSkills(text) {
    const source = text || "";

    return skillDefinitions
        .filter((definition) => definition.regex.test(source))
        .map((definition) => definition.key);
}

function parseSkillInput(input) {
    if (!input || typeof input !== "string") {
        return [];
    }

    const normalized = input
        .split(/\n|,|\|/g)
        .map((item) => item.trim())
        .filter(Boolean)
        .join(" ");

    return extractSkills(normalized);
}

function uniqueSkills(skills) {
    return Array.from(new Set(skills));
}

function calculateScore(resumeSkills, mustHaveSkills, niceToHaveSkills) {
    const mustHaveMatched = mustHaveSkills.filter((skill) => resumeSkills.includes(skill));
    const niceToHaveMatched = niceToHaveSkills.filter((skill) => resumeSkills.includes(skill));

    const mustHaveWeight = 2;
    const niceToHaveWeight = 1;

    const weightedMatched = (mustHaveMatched.length * mustHaveWeight) + (niceToHaveMatched.length * niceToHaveWeight);
    const weightedRequired = (mustHaveSkills.length * mustHaveWeight) + (niceToHaveSkills.length * niceToHaveWeight);

    const score = weightedRequired > 0
        ? (weightedMatched / weightedRequired) * 100
        : 0;

    return {
        score: Number(score.toFixed(2)),
        matchedSkills: uniqueSkills([...mustHaveMatched, ...niceToHaveMatched]),
        missingSkills: uniqueSkills([
            ...mustHaveSkills.filter((skill) => !mustHaveMatched.includes(skill)),
            ...niceToHaveSkills.filter((skill) => !niceToHaveMatched.includes(skill))
        ]),
        mustHaveMatchedCount: mustHaveMatched.length,
        mustHaveRequiredCount: mustHaveSkills.length,
        niceToHaveMatchedCount: niceToHaveMatched.length,
        niceToHaveRequiredCount: niceToHaveSkills.length
    };
}

async function authenticateUser(req, res, next) {
    if (!AUTH_REQUIRED) {
        req.user = {
            id: "local-dev",
            email: RECRUITER_EMAIL,
            role: "recruiter"
        };
        return next();
    }

    if (!isSupabaseConfigured || !supabase) {
        return res.status(500).json({
            error: "Auth is enabled but Supabase is not configured"
        });
    }

    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    if (!token) {
        return res.status(401).json({
            error: "Missing Bearer token"
        });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }

    const email = String(data.user.email || "").toLowerCase();
    const metadataRole = String(
        data.user.app_metadata?.role || data.user.user_metadata?.role || ""
    ).toLowerCase();

    const role = email === RECRUITER_EMAIL || metadataRole === "recruiter" || metadataRole === "admin"
        ? "recruiter"
        : "candidate";

    req.user = {
        id: data.user.id,
        email,
        role
    };
    req.accessToken = token;

    return next();
}

function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access denied for role '${req.user?.role || "unknown"}'`
            });
        }

        return next();
    };
}

function ensureSupabaseDataReady(res) {
    if (!isSupabaseConfigured || !supabase) {
        res.status(500).json({
            error: "Supabase is not configured"
        });
        return false;
    }

    return true;
}

function getRequestSupabase(req) {
    if (!req?.accessToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return supabase;
    }

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${req.accessToken}`
            }
        }
    });
}

function withSchemaHint(errorMessage) {
    if (!errorMessage) {
        return "Unknown Supabase error";
    }

    if (
        errorMessage.includes("schema cache") ||
        errorMessage.includes("Could not find the table")
    ) {
        return `${errorMessage}. Run backend/supabase_schema.sql in Supabase SQL Editor for this project.`;
    }

    return errorMessage;
}

function isValidApplicationStatus(status) {
    return APPLICATION_STATUSES.includes(status);
}

app.get("/", (req, res) => {
    res.send("Resume ranking backend is running");
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get("/auth/me", authenticateUser, (req, res) => {
    res.json({
        authRequired: AUTH_REQUIRED,
        recruiterEmail: RECRUITER_EMAIL,
        user: req.user
    });
});

app.post("/jobs", authenticateUser, requireRole(["recruiter"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();

    if (!title || !description) {
        return res.status(400).json({
            error: "title and description are required"
        });
    }

    const mustHaveSkills = uniqueSkills(parseSkillInput(req.body.mustHaveSkills || ""));
    const niceToHaveSkills = uniqueSkills(
        parseSkillInput(req.body.niceToHaveSkills || "")
            .filter((skill) => !mustHaveSkills.includes(skill))
    );

    const payload = {
        title,
        description,
        must_have_skills: mustHaveSkills,
        nice_to_have_skills: niceToHaveSkills,
        created_by_email: req.user.email
    };

    const { data, error } = await db
        .from("jobs")
        .insert(payload)
        .select("id,title,description,must_have_skills,nice_to_have_skills,created_by_email,created_at")
        .single();

    if (error) {
        return res.status(500).json({
            error: `Unable to create job: ${withSchemaHint(error.message)}`
        });
    }

    return res.status(201).json({
        message: "Job created",
        job: data
    });
});

app.get("/jobs", authenticateUser, async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const { data, error } = await db
        .from("jobs")
        .select("id,title,description,must_have_skills,nice_to_have_skills,created_by_email,created_at")
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(500).json({
            error: `Unable to load jobs: ${withSchemaHint(error.message)}`
        });
    }

    return res.json({ jobs: data || [] });
});

app.post("/candidate/submit", authenticateUser, requireRole(["candidate"]), upload.single("resume"), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const resumeFile = req.file;
    const jobId = String(req.body.jobId || "").trim();

    if (!jobId) {
        return res.status(400).json({
            error: "jobId is required"
        });
    }

    if (!resumeFile) {
        return res.status(400).json({
            error: "resume PDF is required"
        });
    }

    const { data: job, error: jobError } = await db
        .from("jobs")
        .select("id,title,description,must_have_skills,nice_to_have_skills")
        .eq("id", jobId)
        .single();

    if (jobError || !job) {
        return res.status(404).json({
            error: "Job not found"
        });
    }

    let parser = null;

    try {
        const dataBuffer = fs.readFileSync(resumeFile.path);
        parser = new PDFParse({ data: dataBuffer });
        const parsed = await parser.getText();
        const resumeText = parsed.text || "";

        const resumeSkills = extractSkills(resumeText);
        const mustHaveSkills = uniqueSkills(job.must_have_skills || []);
        const niceToHaveSkills = uniqueSkills(job.nice_to_have_skills || []);
        const result = calculateScore(resumeSkills, mustHaveSkills, niceToHaveSkills);

        const insertPayload = {
            job_id: job.id,
            candidate_user_id: req.user.id,
            candidate_email: req.user.email,
            file_name: resumeFile.originalname,
            file_storage_path: resumeFile.path,
            score: result.score,
            application_status: "submitted",
            status_updated_at: new Date().toISOString(),
            matched_skills: result.matchedSkills,
            missing_skills: result.missingSkills
        };

        const { data: submission, error: insertError } = await db
            .from("candidate_submissions")
            .insert(insertPayload)
            .select("id,job_id,candidate_email,file_name,score,application_status,recruiter_note,status_updated_at,matched_skills,missing_skills,created_at")
            .single();

        if (insertError) {
            return res.status(500).json({
                error: `Unable to save submission: ${withSchemaHint(insertError.message)}`
            });
        }

        const { error: historyInsertError } = await db
            .from("candidate_submission_history")
            .insert({
                submission_id: submission.id,
                candidate_user_id: req.user.id,
                candidate_email: req.user.email,
                application_status: "submitted",
                changed_by_email: req.user.email,
                note: "Resume submitted"
            });

        if (historyInsertError) {
            return res.status(500).json({
                error: `Unable to save submission timeline: ${withSchemaHint(historyInsertError.message)}`
            });
        }

        return res.status(201).json({
            message: "Resume submitted and scored",
            submission,
            scoring: {
                mustHaveMatchedCount: result.mustHaveMatchedCount,
                mustHaveRequiredCount: result.mustHaveRequiredCount,
                niceToHaveMatchedCount: result.niceToHaveMatchedCount,
                niceToHaveRequiredCount: result.niceToHaveRequiredCount
            }
        });
    } catch (parseError) {
        return res.status(400).json({
            error: "Could not parse this file as PDF"
        });
    } finally {
        if (parser) {
            await parser.destroy();
        }
    }
});

app.get("/candidate/submissions", authenticateUser, requireRole(["candidate"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const { data, error } = await db
        .from("candidate_submissions")
        .select("id,job_id,candidate_email,file_name,score,application_status,recruiter_note,status_updated_at,matched_skills,missing_skills,created_at")
        .eq("candidate_user_id", req.user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(500).json({
            error: `Unable to load submissions: ${withSchemaHint(error.message)}`
        });
    }

    return res.json({ submissions: data || [] });
});

app.get("/recruiter/candidates", authenticateUser, requireRole(["recruiter"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const jobId = String(req.query.jobId || "").trim();

    let query = db
        .from("candidate_submissions")
        .select("id,job_id,candidate_email,file_name,score,application_status,recruiter_note,status_updated_at,matched_skills,missing_skills,created_at")
        .order("score", { ascending: false });

    if (jobId) {
        query = query.eq("job_id", jobId);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({
            error: `Unable to load candidates: ${withSchemaHint(error.message)}`
        });
    }

    return res.json({ candidates: data || [] });
});

app.get("/recruiter/shortlist", authenticateUser, requireRole(["recruiter"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);
    const jobId = String(req.query.jobId || "").trim();

    let query = db
        .from("candidate_submissions")
        .select("id,job_id,candidate_email,file_name,score,application_status,recruiter_note,status_updated_at,matched_skills,missing_skills,created_at")
        .eq("application_status", "shortlisted")
        .order("score", { ascending: false });

    if (jobId) {
        query = query.eq("job_id", jobId);
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({
            error: `Unable to load shortlist: ${withSchemaHint(error.message)}`
        });
    }

    return res.json({ shortlist: data || [] });
});

app.post("/recruiter/submissions/:id/status", authenticateUser, requireRole(["recruiter"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);
    const submissionId = String(req.params.id || "").trim();
    const status = String(req.body.status || "").trim().toLowerCase();
    const note = String(req.body.note || "").trim();

    if (!submissionId) {
        return res.status(400).json({
            error: "Submission id is required"
        });
    }

    if (!isValidApplicationStatus(status)) {
        return res.status(400).json({
            error: `Invalid status. Allowed: ${APPLICATION_STATUSES.join(", ")}`
        });
    }

    const { data: existingSubmission, error: existingSubmissionError } = await db
        .from("candidate_submissions")
        .select("id,candidate_user_id,candidate_email")
        .eq("id", submissionId)
        .single();

    if (existingSubmissionError || !existingSubmission) {
        return res.status(404).json({
            error: "Submission not found"
        });
    }

    const updatePayload = {
        application_status: status,
        recruiter_note: note || null,
        status_updated_at: new Date().toISOString()
    };

    const { data: updatedSubmission, error: updateError } = await db
        .from("candidate_submissions")
        .update(updatePayload)
        .eq("id", submissionId)
        .select("id,job_id,candidate_email,file_name,score,application_status,recruiter_note,status_updated_at,matched_skills,missing_skills,created_at")
        .single();

    if (updateError || !updatedSubmission) {
        return res.status(500).json({
            error: `Unable to update submission status: ${withSchemaHint(updateError?.message)}`
        });
    }

    const { error: historyInsertError } = await db
        .from("candidate_submission_history")
        .insert({
            submission_id: submissionId,
            candidate_user_id: existingSubmission.candidate_user_id,
            candidate_email: existingSubmission.candidate_email,
            application_status: status,
            changed_by_email: req.user.email,
            note: note || `Status changed to ${status}`
        });

    if (historyInsertError) {
        return res.status(500).json({
            error: `Unable to update submission timeline: ${withSchemaHint(historyInsertError.message)}`
        });
    }

    return res.json({
        message: "Submission status updated",
        submission: updatedSubmission
    });
});

app.get("/candidate/timeline", authenticateUser, requireRole(["candidate"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const { data, error } = await db
        .from("candidate_submission_history")
        .select("id,submission_id,application_status,changed_by_email,note,created_at")
        .eq("candidate_user_id", req.user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return res.status(500).json({
            error: `Unable to load timeline: ${withSchemaHint(error.message)}`
        });
    }

    return res.json({ timeline: data || [] });
});

app.get("/recruiter/submissions/:id/download", authenticateUser, requireRole(["recruiter"]), async (req, res) => {
    if (!ensureSupabaseDataReady(res)) {
        return;
    }

    const db = getRequestSupabase(req);

    const submissionId = String(req.params.id || "").trim();

    const { data, error } = await db
        .from("candidate_submissions")
        .select("id,file_name,file_storage_path")
        .eq("id", submissionId)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: "Submission not found"
        });
    }

    const filePath = data.file_storage_path;
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({
            error: "Resume file not found"
        });
    }

    return res.download(filePath, data.file_name || "resume.pdf");
});

app.use((err, req, res, next) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            error: `Resume file must be <= ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        });
    }

    if (err?.message?.startsWith("Only PDF files are allowed")) {
        return res.status(400).json({
            error: err.message
        });
    }

    if (err?.message === "CORS origin not allowed") {
        return res.status(403).json({
            error: "Origin is not allowed"
        });
    }

    console.error(err);

    return res.status(500).json({
        error: "Unexpected server error"
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

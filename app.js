/**
 * CodeCraftHub - app.js
 * A beginner-friendly Express REST API that stores courses in a local JSON file (courses.json).
 *
 * Features:
 * - Full CRUD for /api/courses
 * - File-based storage (no database)
 * - Validation + clear error messages
 * - Auto-creates courses.json if missing
 * - Runs on port 5001
 */

const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
app.use(express.json()); // lets us read JSON request bodies

const cors = require("cors");
app.use(cors({ origin: ["http://127.0.0.1:5500", "http://localhost:5001"] }));


// ---- File location: same folder as this app.js ----
const DATA_FILE = path.join(__dirname, "courses.json");

// ---- Allowed status values (strict) ----
const ALLOWED_STATUSES = new Set(["Not Started", "In Progress", "Completed"]);

// ---- Helper: check date is YYYY-MM-DD and is a real calendar date ----
function isValidYYYYMMDD(dateStr) {
  if (typeof dateStr !== "string") return false;

  // 1) format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  // 2) real date check (rejects 2026-02-30)
  const d = new Date(dateStr + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return false;

  // Convert back to YYYY-MM-DD and compare (catches invalid days/months)
  const iso = d.toISOString().slice(0, 10);
  return iso === dateStr;
}

// ---- Helper: ensure the JSON file exists (create if missing) ----
async function ensureDataFileExists() {
  try {
    await fs.access(DATA_FILE);
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist -> create it with an empty array
      await fs.writeFile(DATA_FILE, "[]", "utf-8");
      return;
    }
    // Some other access error (permissions, etc.)
    throw err;
  }
}

// ---- Helper: read courses from file ----
async function readCourses() {
  try {
    await ensureDataFileExists();
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    // If file somehow ends up empty, treat as []
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    // We expect an array in the file
    if (!Array.isArray(parsed)) {
      throw new Error("Data file is corrupted: expected an array.");
    }
    return parsed;
  } catch (err) {
    // Turn file/JSON problems into a controlled error
    err.isFileError = true;
    throw err;
  }
}

// ---- Helper: write courses to file ----
async function writeCourses(courses) {
  try {
    const pretty = JSON.stringify(courses, null, 2);
    await fs.writeFile(DATA_FILE, pretty, "utf-8");
  } catch (err) {
    err.isFileError = true;
    throw err;
  }
}

// ---- Helper: generate next integer id starting from 1 ----
// We compute the next id by looking at the current max id in the file.
function getNextId(courses) {
  let maxId = 0;
  for (const c of courses) {
    if (typeof c.id === "number" && c.id > maxId) maxId = c.id;
  }
  return maxId + 1;
}

// ---- Helper: validate course payload ----
function validateCoursePayload(body) {
  const errors = [];

  const { name, description, target_date, status } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    errors.push("name is required (non-empty string)");
  }

  if (!description || typeof description !== "string" || !description.trim()) {
    errors.push("description is required (non-empty string)");
  }

  if (!target_date || typeof target_date !== "string" || !isValidYYYYMMDD(target_date)) {
    errors.push('target_date is required and must be a valid date in format "YYYY-MM-DD"');
  }

  if (!status || typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
    errors.push('status is required and must be: "Not Started", "In Progress", or "Completed"');
  }

  return errors;
}

// ---- Small wrapper to avoid repeating try/catch in every route ----
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ==========================================================
// ROUTES (CRUD)
// ==========================================================

/**
 * POST /api/courses
 * Add a new course
 */
app.post(
  "/api/courses",
  asyncHandler(async (req, res) => {
    const errors = validateCoursePayload(req.body);
    if (errors.length) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    const courses = await readCourses();

    const newCourse = {
      id: getNextId(courses), // auto-generated id (starting from 1)
      name: req.body.name.trim(),
      description: req.body.description.trim(),
      target_date: req.body.target_date,
      status: req.body.status,
      created_at: new Date().toISOString(), // auto timestamp
    };

    courses.push(newCourse);
    await writeCourses(courses);

    return res.status(201).json(newCourse);
  })
);

/**
 * GET /api/courses
 * Get all courses
 */
app.get(
  "/api/courses",
  asyncHandler(async (req, res) => {
    const courses = await readCourses();
    res.json(courses);
  })
);

/**
 * GET /api/courses/:id
 * Get a specific course
 */
app.get(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid course id. Must be a positive integer." });
    }

    const courses = await readCourses();
    const course = courses.find((c) => c.id === id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  })
);

/**
 * PUT /api/courses/:id
 * Update a course (replace fields)
 * Note: created_at stays the same.
 */
app.put(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid course id. Must be a positive integer." });
    }

    const errors = validateCoursePayload(req.body);
    if (errors.length) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    const courses = await readCourses();
    const idx = courses.findIndex((c) => c.id === id);

    if (idx === -1) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Keep created_at from the old record
    const existing = courses[idx];

    const updated = {
      ...existing,
      name: req.body.name.trim(),
      description: req.body.description.trim(),
      target_date: req.body.target_date,
      status: req.body.status,
      // created_at remains unchanged
    };

    courses[idx] = updated;
    await writeCourses(courses);

    res.json(updated);
  })
);

/**
 * DELETE /api/courses/:id
 * Delete a course
 */
app.delete(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid course id. Must be a positive integer." });
    }

    const courses = await readCourses();
    const idx = courses.findIndex((c) => c.id === id);

    if (idx === -1) {
      return res.status(404).json({ message: "Course not found" });
    }

    courses.splice(idx, 1);
    await writeCourses(courses);

    // 204 = success, no response body
    res.status(204).send();
  })
);

// ==========================================================
// GLOBAL ERROR HANDLER (must be after routes)
// ==========================================================
app.use((err, req, res, next) => {
  // If we tagged it as a file error, return a helpful message
  if (err && err.isFileError) {
    return res.status(500).json({
      message: "File read/write error",
      error: err.message,
    });
  }

  // Unknown/unexpected error
  return res.status(500).json({
    message: "Internal server error",
    error: err?.message || "Unknown error",
  });
});

// ==========================================================
// START SERVER (port 5001)
// ==========================================================
const PORT = 5001;

(async () => {
  // Ensure courses.json exists before we start accepting requests
  try {
    await ensureDataFileExists();
    app.listen(PORT, () => {
      console.log(`CodeCraftHub API running on http://localhost:${PORT}`);
      console.log(`API endpoints available at http://127.0.0.1:${PORT}/api/courses`);
    });
  } catch (err) {
    console.error("Failed to start server due to file system error:", err.message);
    process.exit(1);
  }
})();

module.exports = app;
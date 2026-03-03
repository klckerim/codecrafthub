# CodeCraftHub

## Project Overview

CodeCraftHub is a simple REST API built with Node.js and Express that allows developers to track personal learning goals.

The project is intentionally built without a database. Instead, it stores data inside a local JSON file (`courses.json`). This keeps the architecture simple and makes it ideal for learning:

- REST API fundamentals
- CRUD operations
- File-based data persistence
- Input validation
- Error handling

This project is designed for educational purposes and backend practice.

---

## Features

- Create, read, update, and delete courses
- JSON file-based storage (no database required)
- Automatic file creation if `courses.json` does not exist
- Auto-incrementing course IDs (starting from 1)
- Input validation with meaningful error messages
- Proper HTTP status codes
- Clean and beginner-friendly structure

Each course contains:

- `id` (auto-generated integer)
- `name` (required)
- `description` (required)
- `target_date` (required, format YYYY-MM-DD)
- `status` (required: "Not Started", "In Progress", or "Completed")
- `created_at` (auto-generated timestamp)

---

## Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd codecrafthub
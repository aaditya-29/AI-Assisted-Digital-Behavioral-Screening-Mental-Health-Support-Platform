# ASD Screening & Support Platform

> An AI-assisted behavioral screening and decision support system for Autism Spectrum Disorder research and assessment.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development](#development)
- [Implementation Status](#implementation-status)


## 🎯 Overview

This platform provides an integrated solution for behavioral screening and support monitoring. It combines:
- **Screening Module**: AQ-10 based autism spectrum assessment
- **Behavioral Tracking**: Task-based performance monitoring
- **Mood & Journal Analysis**: AI-powered sentiment and emotion recognition
- **Risk Analytics**: ML-driven risk assessment and trending
- **Recommendations**: Personalized resource suggestions
- **Professional Interface**: Mental health professional consultation tools

## ✨ Features

- 🔐 **Secure Authentication**: JWT-based auth with bcrypt password hashing
- 📊 **Risk Analysis**: ML-powered risk scoring and trend analysis
- 📝 **Journal & Mood Tracking**: Emotion detection and sentiment analysis
- 🎮 **Behavioral Tasks**: Interactive task-based performance metrics
- 👥 **Professional Dashboard**: Consultation and patient management
- 📱 **Responsive Design**: Mobile-friendly web interface
- 🔄 **Real-time Updates**: WebSocket support for live monitoring
- 📈 **Comprehensive Reporting**: Detailed risk assessment reports

## 🏗️ Architecture

```
┌─────────────────────┐
│   Frontend (React)  │
└──────────┬──────────┘
           │
     ┌─────▼─────┐
     │ FastAPI   │  (API Layer)
     └─────┬─────┘
           │
     ┌─────▼──────────┐
     │ Service Layer  │
     └─────┬──────────┘
           │
     ┌─────▼──────────────┐
     │ Repository Layer   │  (Data Abstraction)
     └─────┬──────────────┘
           │
     ┌─────▼────────┐
     │ MySQL Schema │
     └──────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18+, React Router, Axios, Vite |
| **Backend** | FastAPI, SQLAlchemy, Pydantic |
| **Database** | MySQL 8.0+ |
| **Authentication** | JWT, bcrypt |
| **ORM** | SQLAlchemy |
| **Validation** | Pydantic |
| **Build Tool** | Vite |

## 📁 Project Structure

```
AI_Assisted_Digital_Behavioral_Screening_Platform/
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # Application entry point
│   │   ├── config.py          # Settings & configuration
│   │   ├── database.py        # Database connection setup
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # Business logic layer
│   │   ├── repositories/      # Data access layer
│   │   └── utils/             # Helper utilities
│   ├── ml_models/             # ML model artifacts
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Test suite
│   ├── requirements.txt       # Python dependencies
│   └── .env.example           # Environment template
│
└── frontend/                   # React SPA application
    ├── src/
    │   ├── components/        # Reusable UI components
    │   ├── pages/             # Page-level components
    │   ├── services/          # API service clients
    │   ├── hooks/             # Custom React hooks
    │   ├── context/           # React Context setup
    │   └── index.css          # Global styles
    ├── package.json
    └── vite.config.js         # Vite configuration
```

## 📊 Database Schema

### Core Tables
- **Users** - User accounts (id, email, password_hash, first_name, last_name, role, is_active)
- **ScreeningSession** - Screening sessions (id, user_id, started_at, completed_at, raw_score, risk_level, ml_risk_score, model_version)
- **ScreeningResponse** - Responses (id, screening_id, question_id, selected_option_id, response_time_ms)
- **Question** - Screening questions (id, text, category)
- **Option** - Question options (id, question_id, text, score_value)
- **Task** - Behavioral tasks (id, name, type, description)
- **TaskSession** - Task sessions (id, user_id, task_id, started_at, completed_at)
- **TaskResult** - Task results (id, task_session_id, metric_name, metric_value)
- **JournalEntry** - Journal entries (id, user_id, content, mood_rating, stress_rating)
- **JournalAnalysis** - ML analysis (id, journal_id, sentiment_score, emotion_label, model_version)
- **UserAnalysisSnapshot** - Risk analysis (id, user_id, asd_risk_score, mood_trend_score, task_performance_score, overall_risk_index, model_version)
- **Resource** - Educational resources (id, title, type, content_or_url, target_risk_level)
- **Recommendation** - User recommendations (id, user_id, resource_id, analysis_snapshot_id, reason, status)
- **Professional** - Mental health professionals (id, name, specialization, email, verified)
- **ConsultationRequest** - Consultation requests (id, user_id, professional_id, status, scheduled_time)
- **ConsentLog** - User consent tracking (id, user_id, consent_type, timestamp)

---

## 🚀 Installation

### Prerequisites

Before you begin, ensure you have the following installed:
- **Python 3.10+**
- **Node.js 18+**
- **MySQL 8.0+**

### Installation Steps

#### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Create environment file
cp .env.example .env
# Then edit .env with your database credentials

# 5. Initialize database
python db_manage.py init

# 6. Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API Documentation:** Visit `http://localhost:8000/docs` after starting the server

#### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start development server
npm run dev
```

**Application:** Open `http://localhost:3000` in your browser

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/asd_platform

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API
API_V1_STR=/api/v1

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

### Database Migrations

```bash
# Check migration status
python db_manage.py status

# Run pending migrations
python db_manage.py migrate

# Create new migration (after model changes)
python db_manage.py generate -m "description of changes"

# Rollback last migration
python db_manage.py rollback

# Rollback multiple migrations
python db_manage.py rollback -s 3
```

---

## 🎯 Running the Application

### Step 1: Initialize Database

After running migrations, you need to seed the database with initial data:

```bash
cd backend

# Seed admin user (creates default admin account)
python seed_admin.py

# Seed AQ-10 screening questions and options
python seed_aq10_questions.py

# Seed behavioral tasks
python seed_tasks.py
```

**What gets seeded:**
- **Admin User** - Default admin account for platform management
- **AQ-10 Questions** - 10-item autism spectrum screening questionnaire with scoring options
- **Behavioral Tasks** - Pre-configured tasks for behavioral tracking and analysis

### Step 2: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

python -m pip install -r requirements.txt
python db_manage.py init      # Initialize database
python seed_admin.py          # Create admin user
python seed_aq10_questions.py # Load screening questions
python seed_tasks.py          # Load behavioral tasks

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Access the Application

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Documentation**: `http://localhost:8000/docs` (Interactive Swagger UI)

---

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user info |
| PUT | `/api/v1/auth/me` | Update user profile |
| POST | `/api/v1/auth/change-password` | Change password |

**Full API documentation available at:** `http://localhost:8000/docs` (interactive Swagger UI)

---

## 🔒 Security Features

-  **JWT Authentication** - Stateless token-based authentication
-  **Bcrypt Password Hashing** - Industry-standard password hashing
-  **Protected Routes** - Role-based access control
-  **Token Refresh** - Secure token refresh mechanism
-  **CORS Configuration** - Controlled cross-origin requests
-  **Input Validation** - Pydantic schema validation
-  **SQL Injection Protection** - Parameterized queries via ORM

---

## 📦 Development

### Project Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following code style guidelines
   - **Python**: PEP 8 conventions
   - **React**: Standard ESLint configuration

3. **Test your changes thoroughly** before committing

4. **Submit a pull request** with a clear description

---

## 📞 Support & Contact

For issues or questions:
1. Check the [Documentation](./README.md)
2. Review existing [Issues](../../issues)
3. Create a new issue with detailed information

---
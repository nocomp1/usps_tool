
# USPS Rate Analysis & Reporting Tool

Python/Flask backend and lightweight React UI for uploading USPS mailing data, calculating rate adjustments and promo savings, and exporting finance-ready summaries.

**Live stack (project history):** Flask on **AWS Elastic Beanstalk**, **Amazon RDS (MySQL)**, **Amazon S3** for file storage, CloudWatch logs.
**Repo:** [https://github.com/nocomp1/usps_tool](https://github.com/nocomp1/usps_tool)

## Features

* **XLSX/CSV ingestion** → validated, normalized records (project + transactions)
* **Reporting**

  * Detail, grouped **Summary by Entry & Category**
  * **Proposed Adjustments** (what-if) with recalculated totals/unit prices
* **Promo Savings** aggregation (Sustainability / Informed Delivery / TSI)
* **Exports**: CSV/XLSX summaries for Finance/Operations
* **Auth-ready** API structure (JWT-ready), OpenAPI-friendly routing

## Tech Stack

* **Backend:** Python, Flask, SQLAlchemy, marshmallow/pydantic (validation), pandas (ingestion)
* **DB:** MySQL (Amazon RDS)
* **Storage:** Amazon S3 (file uploads + embedded docs)
* **Hosting/Infra:** AWS Elastic Beanstalk (nginx proxy, CloudWatch logs)
* **Frontend:** React (filterable tables, CSV/XLSX export)
* **Tooling:** pip/virtualenv, (pytest-ready), GitHub Actions (easy to add)

---

## Getting Started (Local)

### 1) Prereqs

* Python 3.10+
* Node 18+ (if you’re running the React UI locally)
* MySQL 8+ (or use Docker for a local DB)

### 2) Clone

```bash
git clone https://github.com/nocomp1/usps_tool.git
cd usps_tool
```

### 3) Python env & deps

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4) Environment variables

Create a `.env` file in the project root:

```ini
# Flask
FLASK_ENV=development
SECRET_KEY=change_me

# Database (local)
DATABASE_URL=mysql+pymysql://user:pass@127.0.0.1:3306/usps_tool

# Or Elastic Beanstalk/RDS-style vars (used in prod)
RDS_HOSTNAME=your-rds-host.rds.amazonaws.com
RDS_PORT=3306
RDS_DB_NAME=usps_tool
RDS_USERNAME=youruser
RDS_PASSWORD=yourpass

# S3 for file upload / embedded docs
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Upload limits
MAX_CONTENT_LENGTH=104857600
```

> The app will prefer `DATABASE_URL` locally. In AWS EB, the standard `RDS_*` vars are used.

### 5) Initialize DB (local)

```bash
python -c "from app import db; db.create_all()"
```

*(If you add Flask-Migrate later, swap this for migrations.)*

### 6) Run API

```bash
# Either:
python app.py

# Or, if using Flask CLI:
export FLASK_APP=app.py
flask run
```

API defaults to `http://127.0.0.1:5000`.

### 7) Run UI (if included in repo)

```bash
cd client
npm install
npm run dev   # or npm start
```

---

## API (High-Level)

> Path names may vary a bit in code; these are representative.

### Projects

* `POST /api/projects` — create project (metadata + initial settings)
* `GET  /api/projects` — list
* `GET  /api/projects/:id` — detail

### Transactions / Import

* `POST /api/projects/:id/import` — upload XLSX/CSV (S3-backed), parse with pandas, persist transactions
* `GET  /api/projects/:id/transactions` — list/filter

### Reporting

* `GET /api/projects/:id/report/detail`
* `GET /api/projects/:id/report/summary` — grouped by Entry & Price Category
* `POST /api/projects/:id/report/adjustments` — body includes proposed % deltas → returns recomputed totals/unit prices

### Promo Savings

* `GET /api/projects/:id/promo/summary` — aggregates Sustainability / Informed Delivery / TSI credits
* `GET /api/projects/:id/promo/export` — CSV/XLSX

### Auth (optional scaffold)

* JWT-ready structure; add your provider and `@auth_required` decorators as needed.

---

## AWS Deployment (Elastic Beanstalk)

1. **RDS (MySQL)**: create DB, capture host/port/db/user/pass.
2. **S3**: create a bucket for file uploads and embedded docs.
3. **EB App + Env**:

   ```bash
   eb init         # choose Python platform
   eb create usps-tool-api
   eb setenv FLASK_ENV=production SECRET_KEY=xxx \
     RDS_HOSTNAME=... RDS_PORT=3306 RDS_DB_NAME=... RDS_USERNAME=... RDS_PASSWORD=... \
     AWS_REGION=us-east-1 S3_BUCKET=your-bucket
   eb deploy
   ```
4. **Logs**: use Elastic Beanstalk console or CloudWatch to inspect `web.stdout.log` / `web.error.log`.

> EB’s default nginx proxy serves Flask via WSGI. Static docs/assets can be pulled from S3.

---

## Data Model (Conceptual)

* **Project**: id, name, created_at, import metadata (date range, qualification, etc.)
* **Transaction**: id, project_id, entry, category, format, pieces, weight, postage, credits/adjustments
* **Derived**: summary tables for grouped reporting and promo credits

*(If you’re using migrations: add `alembic` or `Flask-Migrate`.)*

---

## Testing

* Add tests in `tests/` (pytest).
* Seed a small XLSX in `/samples` and verify:

  * import → `/report/summary` totals
  * `/report/adjustments` math with a known % delta
  * `/promo/summary` line-item credit sums

---

## Common Tasks

**Recompute report after changing adjustments**

```bash
curl -X POST http://localhost:5000/api/projects/1/report/adjustments \
  -H "Content-Type: application/json" \
  -d '{"entryDeltaPct": 2.5, "categoryDeltaPct": -1.0}'
```

**Export promo savings**

```bash
curl -O http://localhost:5000/api/projects/1/promo/export
```

---

## Roadmap

* Swagger/OpenAPI schema + Redoc
* Role-based auth (JWT)
* Background jobs (import/aggregation) via SQS/Lambda or EB worker tier
* Fine-grained audit logging

---

## License

Private, internal tooling for Lithographix. Contact the maintainer for reuse permissions.

---


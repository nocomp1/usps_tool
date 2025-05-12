import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text, func, and_, desc


app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# ─── Read database credentials from environment ────────────────────────────
DB_USER     = os.getenv("RDS_USERNAME") or os.getenv("DB_USER")
DB_PASSWORD = os.getenv("RDS_PASSWORD") or os.getenv("DB_PASSWORD")
DB_HOST     = os.getenv("RDS_HOSTNAME") or os.getenv("DB_HOST")
DB_PORT     = os.getenv("RDS_PORT", "3306")
DB_NAME     = os.getenv("RDS_DB_NAME") or os.getenv("DB_NAME")

# ─── Configure SQLAlchemy URL ──────────────────────────────────────────────
if DB_USER and DB_PASSWORD and DB_HOST and DB_NAME:
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        "sqlite:///" + os.path.join(basedir, "mailings.db")
    )

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ─── Models ─────────────────────────────────────────────────────────────────
class Project(db.Model):
    __tablename__ = "projects"
    id                  = db.Column(db.Integer, primary_key=True)
    project_description = db.Column(db.String(255), nullable=False)
    product_type        = db.Column(db.String(50), nullable=False)
    piece_weight        = db.Column(db.Float, nullable=False)
    quantity            = db.Column(db.Integer, nullable=False)
    total_postage       = db.Column(db.Float, nullable=False)
    net_postage         = db.Column(db.Float, nullable=False)
    discount            = db.Column(db.Float, nullable=True)
    job_id              = db.Column(db.String(100), nullable=True)
    project_id          = db.Column(db.String(100), nullable=True)
    format              = db.Column(db.String(50), nullable=True)
    page_count          = db.Column(db.Integer, nullable=True)
    date                = db.Column(db.String(10), nullable=True)  # YYYY/MM/DD

    def to_dict(self):
        return {
            "id":                   self.id,
            "project_description":  self.project_description,
            "product_type":         self.product_type,
            "piece_weight":         self.piece_weight,
            "quantity":             self.quantity,
            "total_postage":        self.total_postage,
            "net_postage":          self.net_postage,
            "discount":             self.discount,
            "job_id":               self.job_id,
            "project_id":           self.project_id,
            "format":               self.format,
            "page_count":           self.page_count,
            "date":                 self.date,
        }



class TransactionDetail(db.Model):
    __tablename__ = "transaction_details"
    id               = db.Column(db.Integer, primary_key=True)
    project_id       = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False)
    category         = db.Column(db.String(20), nullable=False)
    product          = db.Column(db.String(50), nullable=False)
    entry            = db.Column(db.String(20), nullable=False)
    price_category   = db.Column(db.String(20), nullable=False)
    line_price       = db.Column(db.Float, nullable=False)
    number_of_pieces = db.Column(db.Integer, nullable=False)
    total_postage    = db.Column(db.Float, nullable=False)
    discount         = db.Column(db.Float, nullable=False)
    net_postage      = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id":                self.id,
            "project_id":        self.project_id,
            "category":          self.category,
            "product":           self.product,
            "entry":             self.entry,
            "price_category":    self.price_category,
            "line_price":        self.line_price,
            "number_of_pieces":  self.number_of_pieces,
            "total_postage":     self.total_postage,
            "discount":          self.discount,
            "net_postage":       self.net_postage,
        }

# ─── Error handlers ─────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Server error"}), 500

# ─── API Routes ─────────────────────────────────────────────────────────────
@app.route("/mailings", methods=["GET"])
def list_projects():
    return jsonify([p.to_dict() for p in Project.query.all()])

@app.route("/mailings/<int:id>", methods=["PUT"])
def update_project(id):
    proj = Project.query.get_or_404(id)
    data = request.get_json() or {}

    casts = {
        "piece_weight":   float,
        "quantity":       int,
        "total_postage":  float,
        "net_postage":    float,
        "discount":       float,
        "page_count":     int,
        "date":           lambda v: v  # keep string YYYY/MM/DD
    }
    for key, caster in casts.items():
        if key in data:
            setattr(proj, key, caster(data[key]))
    for key in ("project_description", "product_type", "job_id", "project_id", "format"):  
        if key in data:
            setattr(proj, key, data[key])

    db.session.commit()
    return jsonify(proj.to_dict())

@app.route("/mailings", methods=["POST"])
def create_project():
    data = request.get_json() or {}
    required = [
        "project_description", "product_type", "piece_weight",
        "quantity", "total_postage", "net_postage",
    ]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    proj = Project(
        project_description = data["project_description"],
        product_type        = data["product_type"],
        piece_weight        = float(data["piece_weight"]),
        quantity            = int(data["quantity"]),
        total_postage       = float(data["total_postage"]),
        net_postage         = float(data["net_postage"]),
        discount            = float(data.get("discount") or 0.0),
        job_id              = data.get("job_id"),
        project_id          = data.get("project_id"),
        format              = data.get("format"),
        page_count          = data.get("page_count"),
        date                = data.get("date")
    )
    db.session.add(proj)
    db.session.commit()
    return jsonify(proj.to_dict()), 201

@app.route("/mailings/<int:id>", methods=["DELETE"])
def delete_project(id):
    proj = Project.query.get_or_404(id)
    TransactionDetail.query.filter_by(project_id=id).delete()
    db.session.delete(proj)
    db.session.commit()
    return "", 204

@app.route("/transactions", methods=["GET"])
def list_transactions():
    return jsonify([t.to_dict() for t in TransactionDetail.query.all()])

@app.route("/transactions", methods=["POST"])
def create_transaction():
    data = request.get_json() or {}
    required = [
        "project_id", "category", "product", "entry",
        "price_category", "line_price", "number_of_pieces",
        "total_postage", "net_postage",
    ]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    proj = Project.query.get(data["project_id"])
    if not proj:
        return jsonify({"error": "Invalid project_id"}), 400

    # default category to "None" if missing or null
    category_val = data.get("category") or "None"

    tx = TransactionDetail(
        project_id        = int(data["project_id"]),
        category          = category_val,
        product           = data["product"],
        entry             = data["entry"],
        price_category    = data["price_category"],
        line_price        = float(data["line_price"]),
        number_of_pieces  = int(data["number_of_pieces"]),
        total_postage     = float(data["total_postage"]),
        discount          = float(data.get("discount", 0.0)),
        net_postage       = float(data["net_postage"]),
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(tx.to_dict()), 201

@app.route("/transactions/<int:id>", methods=["PUT"])
def update_transaction(id):
    tx = TransactionDetail.query.get_or_404(id)
    data = request.get_json() or {}
    casts = {
        "line_price":       float,
        "number_of_pieces": int,
        "total_postage":    float,
        "discount":         float,
        "net_postage":      float,
    }
    for key, val in data.items():
        if key in casts:
            setattr(tx, key, casts[key](val))
        elif hasattr(tx, key):
            setattr(tx, key, val)
    db.session.commit()
    return jsonify(tx.to_dict())

@app.route("/transactions/<int:id>", methods=["DELETE"])
def delete_transaction(id):
    tx = TransactionDetail.query.get_or_404(id)
    db.session.delete(tx)
    db.session.commit()
    return "", 204

# ──────────────────────────────────────────────────────────────────────────────
# Reporting Endpoints
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/reports/lookup_formats', methods=['GET'])
def lookup_formats():
    rows = db.session.query(Project.format, Project.page_count).distinct().all()
    lookup = {}
    for fmt, pc in rows:
        lookup.setdefault(fmt, []).append(pc)
    return jsonify(lookup)

@app.route('/reports/project_summary', methods=['GET'])
def project_summary():
    fmt      = request.args.get('format')
    page_ct  = request.args.get('page_count', type=int)
    start    = request.args.get('start_date')   # YYYY-MM-DD
    end      = request.args.get('end_date')     # YYYY-MM-DD

    # build base filter
    filters = [Project.format == fmt, Project.page_count == page_ct]
    if start:
        filters.append(Project.date >= start)
    if end:
        filters.append(Project.date <= end)

    projects = (
        Project.query
            .filter(and_(*filters))
            .order_by(Project.project_description)
            .all()
    )
    result = [{
        'project_description': p.project_description,
        'project_id':          p.id,
        'format':              p.format,
        'page_count':          p.page_count,
        'job_id':              p.job_id,
        'piece_weight':        p.piece_weight,
        'quantity':            p.quantity
    } for p in projects]
    return jsonify(result)


@app.route('/reports/summary_by_entry', methods=['GET'])
def summary_by_entry():
    fmt     = request.args.get('format')
    page_ct = request.args.get('page_count', type=int)
    start   = request.args.get('start_date')
    end     = request.args.get('end_date')

    # base join + group filters
    proj_filters = [Project.format == fmt, Project.page_count == page_ct]
    if start:
        proj_filters.append(Project.date >= start)
    if end:
        proj_filters.append(Project.date <= end)

    q = (
        db.session.query(
            TransactionDetail.entry,
            TransactionDetail.price_category,
            func.sum(TransactionDetail.number_of_pieces).label('pieces'),
            func.sum(TransactionDetail.net_postage).label('total')
        )
        .join(Project, Project.id == TransactionDetail.project_id)
        .filter(and_(*proj_filters))
        .group_by(TransactionDetail.entry, TransactionDetail.price_category)
        .order_by(TransactionDetail.entry, desc(func.sum(TransactionDetail.net_postage)))
        .all()
    )
    result = [{
        'entry':          row.entry,
        'price_category': row.price_category,
        'pieces':         int(row.pieces),
        'total':          float(row.total)
    } for row in q]
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)


# ─── Serve React build ──────────────────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react_app(path):
    full_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

# ─── Initialize DB on startup and auto-migrate new columns ─────────────────
with app.app_context():
    # Create tables if they don’t exist
    db.create_all()

    # Reflect existing table schema
    inspector = inspect(db.engine)
    existing_cols = {col['name'] for col in inspector.get_columns('projects')}

    # Add format column if missing
    if 'format' not in existing_cols:
        # use session.execute for SQLAlchemy 2.x compatibility
        db.session.execute(
            text("ALTER TABLE projects ADD COLUMN format VARCHAR(50)")
        )

    # Add page_count column if missing
    if 'page_count' not in existing_cols:
        db.session.execute(
            text("ALTER TABLE projects ADD COLUMN page_count INTEGER")
        )
        
    if 'date' not in existing_cols:
        db.session.execute(
            text("ALTER TABLE projects ADD COLUMN date VARCHAR(10)")
            )
        
    # Persist the schema changes
    db.session.commit()


from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
CORS(app)

# Database config (SQLite)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'mailings.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ──────────────────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────────────────
class Project(db.Model):
    __tablename__ = 'projects'
    id                   = db.Column(db.Integer, primary_key=True)
    project_description  = db.Column(db.String(255), nullable=False)
    product_type         = db.Column(db.String(50),  nullable=False)
    piece_weight         = db.Column(db.Float,       nullable=False)
    quantity             = db.Column(db.Integer,     nullable=False)
    total_postage        = db.Column(db.Float,       nullable=False)
    net_postage          = db.Column(db.Float,       nullable=False)
    discount             = db.Column(db.Float,       nullable=True)
    job_id               = db.Column(db.String(100), nullable=True)
    project_id           = db.Column(db.String(100), nullable=True)

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
        }

class TransactionDetail(db.Model):
    __tablename__ = 'transaction_details'
    id               = db.Column(db.Integer, primary_key=True)
    project_id       = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
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
            "id": self.id,
            "project_id": self.project_id,
            "category": self.category,
            "product": self.product,
            "entry": self.entry,
            "price_category": self.price_category,
            "line_price": self.line_price,
            "number_of_pieces": self.number_of_pieces,
            "total_postage": self.total_postage,
            "discount": self.discount,
            "net_postage": self.net_postage,
        }



# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/')
def hello():
    return 'Hello, this is your Python API!'

# Projects endpoints
@app.route('/mailings', methods=['GET'])
def list_projects():
    projects = Project.query.all()
    return jsonify([p.to_dict() for p in projects])

@app.route('/mailings', methods=['POST'])
def create_project():
    data = request.get_json() or {}
    required = [
        'project_description', 'product_type', 'piece_weight',
        'quantity', 'total_postage', 'net_postage'
    ]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    proj = Project(
        project_description = data['project_description'],
        product_type        = data['product_type'],
        piece_weight        = float(data['piece_weight']),
        quantity            = int(data['quantity']),
        total_postage       = float(data['total_postage']),
        net_postage         = float(data['net_postage']),
        discount            = float(data.get('discount') or 0.0),
        job_id              = data.get('job_id'),
        project_id          = data.get('project_id'),
    )
    db.session.add(proj)
    db.session.commit()
    return jsonify(proj.to_dict()), 201

# Transaction details endpoints
@app.route('/transactions', methods=['GET'])
def list_transactions():
    txs = TransactionDetail.query.all()
    return jsonify([t.to_dict() for t in txs])

@app.route('/transactions', methods=['POST'])
def create_transaction():
    data = request.get_json() or {}
    req = ['project_id', 'category', 'product', 'entry', 'price_category', 'line_price', 'number_of_pieces']
    for f in req:
        if f not in data:
            return jsonify({"error": f"Missing field: {f}"}), 400
    # For simplicity, compute totals as example or fetch from Project
    proj = Project.query.get(data['project_id'])
    if not proj:
        return jsonify({"error": "Invalid project_id"}), 400

    tx = TransactionDetail(
        project_id       = data['project_id'],
        category         = data['category'],
        product          = data['product'],
        entry            = data['entry'],
        price_category   = data['price_category'],
        line_price       = float(data['line_price']),
        number_of_pieces = int(data['number_of_pieces']),
        total_postage    = proj.total_postage,
        discount         = proj.discount or 0.0,
        net_postage      = proj.net_postage
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(tx.to_dict()), 201


# ──────────────────────────────────────────────────────────────────────────────
# Initialize DB
# ──────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Create all tables within the Flask application context
    with app.app_context():
        db.create_all()
    app.run(host='127.0.0.1', port=8000, debug=True)
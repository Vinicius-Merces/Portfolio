import sqlite3
import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_aqui'  # Mude para algo seguro

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Função para conectar ao banco
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Inicializar banco se não existir
if not os.path.exists('database.db'):
    conn = get_db_connection()
    with open('schema.sql') as f:
        conn.executescript(f.read())
    # Adicionar usuário de teste (username: vendedor1, senha: 123)
    hashed_pw = generate_password_hash('123')
    conn.execute('INSERT INTO users (username, password) VALUES (?, ?)', ('vendedor1', hashed_pw))
    conn.commit()
    conn.close()

# Classe User para Flask-Login
class User(UserMixin):
    def __init__(self, id, username):
        self.id = id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    if user:
        return User(user['id'], user['username'])
    return None

# Rota de login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if user and check_password_hash(user['password'], password):
            user_obj = User(user['id'], username)
            login_user(user_obj)
            return redirect(url_for('dashboard'))
        flash('Credenciais inválidas')
    return render_template('login.html')

# Rota de logout
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# Dashboard (área de trabalho)
@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    conn = get_db_connection()
    clients = conn.execute('SELECT * FROM clients WHERE user_id = ?', (current_user.id,)).fetchall()
    conn.close()
    return render_template('dashboard.html', clients=clients)

# Upload de CSV
@app.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo'})
    file = request.files['file']
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
        conn = get_db_connection()
        for _, row in df.iterrows():
            conn.execute('INSERT INTO clients (user_id, name, email, phone, city, notes) VALUES (?, ?, ?, ?, ?, ?)',
                         (current_user.id, row.get('name'), row.get('email'), row.get('phone'), row.get('city'), row.get('notes')))
        conn.commit()
        conn.close()
        return jsonify({'success': 'Planilha importada!'})
    return jsonify({'error': 'Formato inválido'})

# API para atualizar cliente (auto-save)
@app.route('/update_client/<int:client_id>', methods=['POST'])
@login_required
def update_client(client_id):
    data = request.json
    conn = get_db_connection()
    conn.execute('UPDATE clients SET name = ?, email = ?, phone = ?, city = ?, notes = ? WHERE id = ? AND user_id = ?',
                 (data['name'], data['email'], data['phone'], data['city'], data['notes'], client_id, current_user.id))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Alteração salva'})

# API para adicionar linha
@app.route('/add_client', methods=['POST'])
@login_required
def add_client():
    conn = get_db_connection()
    conn.execute('INSERT INTO clients (user_id, name, email, phone, city, notes) VALUES (?, "", "", "", "", "")', (current_user.id,))
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({'id': new_id})

# API para excluir linha
@app.route('/delete_client/<int:client_id>', methods=['POST'])
@login_required
def delete_client(client_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM clients WHERE id = ? AND user_id = ?', (client_id, current_user.id))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Cliente excluído'})

# Rota inicial
@app.route('/')
def index():
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)
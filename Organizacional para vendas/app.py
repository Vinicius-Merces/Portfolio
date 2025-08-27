import sqlite3
import os
import json
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd

app = Flask(__name__)
app.secret_key = 'sua_chave_secreta_aqui'

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Inicializar banco
if not os.path.exists('database.db'):
    conn = get_db_connection()
    with open('schema.sql') as f:
        conn.executescript(f.read())
    hashed_pw = generate_password_hash('123')
    conn.execute('INSERT INTO users (username, password) VALUES (?, ?)', ('vendedor1', hashed_pw))
    # Colunas iniciais vazias (JSON array vazio)
    conn.execute('INSERT INTO user_columns (user_id, columns) VALUES (?, ?)', (1, json.dumps([])))
    conn.commit()
    conn.close()

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

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    conn = get_db_connection()
    columns_row = conn.execute('SELECT columns FROM user_columns WHERE user_id = ?', (current_user.id,)).fetchone()
    columns = json.loads(columns_row['columns']) if columns_row else []
    clients = conn.execute('SELECT * FROM clients WHERE user_id = ?', (current_user.id,)).fetchall()
    clients_data = [{**row, 'data': json.loads(row['data'])} for row in clients]
    conn.close()
    return render_template('dashboard.html', columns=columns, clients=clients_data)

# Upload CSV (detecta colunas e salva como JSON)
@app.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo'})
    file = request.files['file']
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
        conn = get_db_connection()
        columns_row = conn.execute('SELECT columns FROM user_columns WHERE user_id = ?', (current_user.id,)).fetchone()
        user_columns = json.loads(columns_row['columns']) if columns_row else []
        
        # Se usuário não tem colunas, usa as do CSV
        csv_columns = list(df.columns)
        if not user_columns:
            user_columns = csv_columns
            conn.execute('UPDATE user_columns SET columns = ? WHERE user_id = ?', (json.dumps(user_columns), current_user.id))
        
        # Salva dados como JSON (mapeia apenas colunas existentes)
        for _, row in df.iterrows():
            data = {col: row.get(col, '') for col in user_columns if col in df.columns}
            conn.execute('INSERT INTO clients (user_id, data) VALUES (?, ?)', (current_user.id, json.dumps(data)))
        conn.commit()
        conn.close()
        return jsonify({'success': 'Planilha importada!', 'columns': user_columns})
    return jsonify({'error': 'Formato inválido'})

# Atualizar cliente (JSON)
@app.route('/update_client/<int:client_id>', methods=['POST'])
@login_required
def update_client(client_id):
    data = request.json
    conn = get_db_connection()
    conn.execute('UPDATE clients SET data = ? WHERE id = ? AND user_id = ?', (json.dumps(data), client_id, current_user.id))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Alteração salva'})

# Adicionar linha (com dados vazios baseados nas colunas)
@app.route('/add_client', methods=['POST'])
@login_required
def add_client():
    conn = get_db_connection()
    columns_row = conn.execute('SELECT columns FROM user_columns WHERE user_id = ?', (current_user.id,)).fetchone()
    columns = json.loads(columns_row['columns']) if columns_row else []
    data = {col: '' for col in columns}
    conn.execute('INSERT INTO clients (user_id, data) VALUES (?, ?)', (current_user.id, json.dumps(data)))
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({'id': new_id, 'data': data})

# Excluir linha
@app.route('/delete_client/<int:client_id>', methods=['POST'])
@login_required
def delete_client(client_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM clients WHERE id = ? AND user_id = ?', (client_id, current_user.id))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Cliente excluído'})

# Adicionar coluna
@app.route('/add_column', methods=['POST'])
@login_required
def add_column():
    column_name = request.json['name']
    if not column_name:
        return jsonify({'error': 'Nome inválido'})
    conn = get_db_connection()
    columns_row = conn.execute('SELECT columns FROM user_columns WHERE user_id = ?', (current_user.id,)).fetchone()
    columns = json.loads(columns_row['columns']) if columns_row else []
    if column_name not in columns:
        columns.append(column_name)
        conn.execute('UPDATE user_columns SET columns = ? WHERE user_id = ?', (json.dumps(columns), current_user.id))
        # Adiciona campo vazio em todos os clients existentes
        clients = conn.execute('SELECT id, data FROM clients WHERE user_id = ?', (current_user.id,)).fetchall()
        for client in clients:
            data = json.loads(client['data'])
            data[column_name] = ''
            conn.execute('UPDATE clients SET data = ? WHERE id = ?', (json.dumps(data), client['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Coluna adicionada', 'columns': columns})

# Remover coluna
@app.route('/remove_column', methods=['POST'])
@login_required
def remove_column():
    column_name = request.json['name']
    conn = get_db_connection()
    columns_row = conn.execute('SELECT columns FROM user_columns WHERE user_id = ?', (current_user.id,)).fetchone()
    columns = json.loads(columns_row['columns']) if columns_row else []
    if column_name in columns:
        columns.remove(column_name)
        conn.execute('UPDATE user_columns SET columns = ? WHERE user_id = ?', (json.dumps(columns), current_user.id))
        # Remove campo de todos os clients
        clients = conn.execute('SELECT id, data FROM clients WHERE user_id = ?', (current_user.id,)).fetchall()
        for client in clients:
            data = json.loads(client['data'])
            data.pop(column_name, None)
            conn.execute('UPDATE clients SET data = ? WHERE id = ?', (json.dumps(data), client['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': 'Coluna removida', 'columns': columns})

@app.route('/')
def index():
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)
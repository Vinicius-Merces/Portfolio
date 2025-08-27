DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

DROP TABLE IF EXISTS user_columns;
CREATE TABLE user_columns (
    user_id INTEGER PRIMARY KEY,
    columns TEXT NOT NULL,  -- JSON array, ex: ["nome", "email", "telefone"]
    FOREIGN KEY (user_id) REFERENCES users (id)
);

DROP TABLE IF EXISTS clients;
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    data TEXT NOT NULL,  -- JSON object, ex: {"nome": "João", "email": "joao@example.com"}
    FOREIGN KEY (user_id) REFERENCES users (id)
);
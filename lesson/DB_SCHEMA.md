# Datenbank-Schema: llm_forum.db

Kurzbeschreibung

Diese Datei fasst die Struktur der lokalen SQLite-Datenbank `llm_forum.db` zusammen (Tabellen, Spalten, Typen, Primary Keys, Zeilenanzahlen und Beispielzeilen).

Hinweis: Die Informationen wurden programmgesteuert aus der DB extrahiert (PRAGMA table_info, COUNT(*), SELECT ... LIMIT 5).

---

## Übersicht der Tabellen

- classification — 45 Zeilen
- conversation — 45 Zeilen
- feedback — 45 Zeilen
- models — 45 Zeilen


## Tabelle: classification
- Zeilen: 45
- Spalten:
  - uuid — TEXT — PRIMARY KEY
  - topic — TEXT
  - query_type — TEXT
  - speech — TEXT
  - revealed_answer — TEXT
  - broken_response — TEXT

- Beispiel (erste Zeile):
  - ["0b2fe79f-edc7-4f46-b883-440db1951141", "Math", "Task Help", "Verbose texts", "Yes", "Token Limit/Cutoff"]

- CREATE TABLE (rekonstruiert):

```sql
CREATE TABLE classification (
    uuid TEXT PRIMARY KEY,
    topic TEXT,
    query_type TEXT,
    speech TEXT,
    revealed_answer TEXT,
    broken_response TEXT
);
```


## Tabelle: conversation
- Zeilen: 45
- Spalten:
  - uuid — TEXT — PRIMARY KEY
  - conversation_text_ChatML_style — TEXT
  - start_timestamp — TEXT
  - end_timestamp — TEXT

- Beispiel (erste Zeile):
  - ["0b2fe79f-edc7-4f46-b883-440db1951141", "2025-10-08 10:57:18.223980", "2025-10-08 10:58:03.643992"]

- CREATE TABLE (rekonstruiert):

```sql
CREATE TABLE conversation (
    uuid TEXT PRIMARY KEY,
    start_timestamp TEXT,
    end_timestamp TEXT
);
```


## Tabelle: feedback
- Zeilen: 45
- Spalten:
  - uuid — TEXT — PRIMARY KEY
  - clear_explanation — INTEGER
  - helpful_steps — INTEGER
  - adapt_learning_style — INTEGER
  - motivating_encouraging — INTEGER
  - accurate_reliable — INTEGER
  - relevant_question — INTEGER
  - natural_conversational — INTEGER
  - trust_assistant — INTEGER

- Beispiel (erste Zeile):
  - ["0b2fe79f-edc7-4f46-b883-440db1951141", 3, 3, 2, 4, 6, 5, 7, 4]

- CREATE TABLE (rekonstruiert):

```sql
CREATE TABLE feedback (
    uuid TEXT PRIMARY KEY,
    clear_explanation INTEGER,
    helpful_steps INTEGER,
    adapt_learning_style INTEGER,
    motivating_encouraging INTEGER,
    accurate_reliable INTEGER,
    relevant_question INTEGER,
    natural_conversational INTEGER,
    trust_assistant INTEGER
);
```


## Tabelle: models
- Zeilen: 45
- Spalten:
  - uuid — TEXT — PRIMARY KEY
  - model_name — TEXT

- Beispiel (erste Zeile):
  - ["0b2fe79f-edc7-4f46-b883-440db1951141", "Base"]

- CREATE TABLE (rekonstruiert):

```sql
CREATE TABLE models (
    uuid TEXT PRIMARY KEY,
    model_name TEXT
);
```
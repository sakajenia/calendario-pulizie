-- Archivio condiviso di ProProManager.
--
-- Due tabelle sole: chi puo' entrare, e i dati. I dati stanno per riga, non in
-- un documento unico: cosi' due persone che lavorano insieme non si
-- sovrascrivono a vicenda: ognuno riscrive solo le righe che ha toccato.

CREATE TABLE IF NOT EXISTS utente (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  username      TEXT,
  password_hash TEXT NOT NULL,
  ruolo         TEXT NOT NULL,
  nome          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS record (
  -- Che cosa e': appartamenti, richieste, controlli, interventi, spese, utenti.
  tipo       TEXT NOT NULL,
  id         TEXT NOT NULL,
  -- Il record in JSON. Vuoto quando la riga e' solo la traccia di un'eliminazione.
  dati       TEXT,
  eliminato  INTEGER NOT NULL DEFAULT 0,
  -- Millisecondi del server: e' il filo con cui ogni dispositivo chiede
  -- "cos'e' cambiato da quando mi sono collegato l'ultima volta".
  aggiornato INTEGER NOT NULL,
  PRIMARY KEY (tipo, id)
);

CREATE INDEX IF NOT EXISTS idx_record_aggiornato ON record (aggiornato);

-- Gli accessi: le password non si salvano in chiaro, si salva la loro impronta.
INSERT OR REPLACE INTO utente (id, email, username, password_hash, ruolo, nome) VALUES
  ('u-admin', 'm2ab.srl@gmail.com', NULL,
   'f0ef41d929da406ca215396b37ac6998c4a5c209ce37c2275c773795b3b6824e', 'admin', 'ProProManager'),
  ('u-pulizie-angela', 'angela@propromanager.it', 'Angela',
   '0d4caf2c36bd87799d0e49b82f2efc5a9e45cbcccb941e02df51f5e9aad146fc', 'operator', 'Angela');

-- L'accesso Comfy e' stato revocato: se resta da un'installazione precedente,
-- va tolto. Le case e le pulizie non si toccano.
DELETE FROM utente WHERE id = 'u-pulizie-comfy';

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
  nome          TEXT NOT NULL,
  -- Per le ditte di pulizie: quale ditta ('angela', 'comfy'). Decide quali
  -- case e quali pulizie quella persona vede e puo' toccare.
  company       TEXT,
  -- 0 = sospeso dall'amministratore: non entra piu', nemmeno con un accesso
  -- gia' aperto.
  attivo        INTEGER NOT NULL DEFAULT 1
);

-- Negli archivi creati prima di queste due colonne la tabella c'e' gia' e la
-- riga sopra non la tocca. Le aggiunge il Worker da solo al primo avvio; a
-- mano, una volta sola:
--   ALTER TABLE utente ADD COLUMN company TEXT;
--   ALTER TABLE utente ADD COLUMN attivo INTEGER NOT NULL DEFAULT 1;

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
-- Solo se mancano: rilanciare questo file su un archivio in uso non deve
-- riattivare chi l'amministratore ha sospeso, ne' rimettere la ditta di
-- partenza a chi e' stata cambiata.
INSERT OR IGNORE INTO utente (id, email, username, password_hash, ruolo, nome, company) VALUES
  ('u-admin', 'm2ab.srl@gmail.com', NULL,
   'f0ef41d929da406ca215396b37ac6998c4a5c209ce37c2275c773795b3b6824e', 'admin', 'ProProManager', NULL),
  ('u-pulizie-angela', 'angela@propromanager.it', 'Angela',
   '0d4caf2c36bd87799d0e49b82f2efc5a9e45cbcccb941e02df51f5e9aad146fc', 'operator', 'Angela', 'angela');

-- Negli archivi nati prima della colonna company la riga di Angela c'e' gia',
-- senza ditta: la si mette solo se manca, come fa il Worker all'avvio.
UPDATE utente SET company = 'angela' WHERE id = 'u-pulizie-angela' AND company IS NULL;

-- L'accesso Comfy e' stato revocato: se resta da un'installazione precedente,
-- va tolto. Le case e le pulizie non si toccano.
DELETE FROM utente WHERE id = 'u-pulizie-comfy';

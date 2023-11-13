-- This is just a script so I can test performance against sqlite
-- will delete before beta
.mode csv

CREATE TABLE employee (
    id INTEGER PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    email TEXT
);
.import ./data/csv/employee.csv employee

CREATE TABLE contact (
    id INTEGER PRIMARY KEY,
    type TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone_number TEXT,
    date_of_birth TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    mailing_list BOOLEAN
);
.import ./data/csv/contact.csv contact

CREATE TABLE matters (
    id INTEGER PRIMARY KEY,
    type TEXT,
    name TEXT,
    contact INTEGER,
    employee INTEGER,
    client_position TEXT,
    date TEXT,
    close_date TEXT,
    notes TEXT,
    FOREIGN KEY (contact) REFERENCES contact(id),
    FOREIGN KEY (employee) REFERENCES employee(id)
);
.import ./data/csv/matter.csv matter

CREATE TABLE payment (
    id INTEGER PRIMARY KEY,
    contact INTEGER,
    cost REAL,
    minutes INTEGER,
    date TEXT,
    invoice_id TEXT,
    FOREIGN KEY (contact) REFERENCES contact(id)
);
.import ./data/csv/payment.csv payment

CREATE TABLE time_entry (
    id INTEGER PRIMARY KEY,
    matter INTEGER,
    employee INTEGER,
    minutes INTEGER,
    date TEXT,
    billable BOOLEAN,
    FOREIGN KEY (matter) REFERENCES matters(id),
    FOREIGN KEY (employee) REFERENCES employees(id)
);
.import ./data/csv/time_entry.csv time_entry

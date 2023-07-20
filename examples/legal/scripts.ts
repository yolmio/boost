import "./app.js";
import { modify, saveDb } from "@yolm/boost/procHelpers";
import { addScript } from "@yolm/boost/modelHelpers";
import { stringLiteral } from "../../dist/utils/sqlHelpers.js";
import { faker } from "@faker-js/faker";

faker.seed(123);

const employees: {
  firstName: string;
  lastName: string;
  email: string;
  uuid: string;
}[] = [];

for (let i = 0; i < 10; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  employees.push({
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }),
    uuid: faker.string.uuid(),
  });
}

const contacts: {
  type: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  mailingList: boolean;
}[] = [];

for (let i = 0; i < 200; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  contacts.push({
    type: faker.helpers.arrayElement(["client", "prospect", "lead", "other"]),
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }),
    phoneNumber: faker.phone.number(),
    dateOfBirth: faker.date.birthdate().toISOString().split("T")[0],
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    country: faker.location.country(),
    zip: faker.location.zipCode(),
    mailingList: faker.datatype.boolean(0.33),
  });
}

const clients = contacts.filter((c) => c.type === "client");

const matters: {
  type: string;
  name: string;
  contact: number;
  employee: number;
  clientPosition: string;
  date: string;
  closeDate?: string;
  notes: string;
}[] = [];

for (const client of clients) {
  const matterCount = faker.number.int({ min: 0, max: 5 });
  const contactId = contacts.indexOf(client);
  for (let i = 0; i < matterCount; i++) {
    matters.push({
      type: faker.helpers.arrayElement([
        "civil",
        "corporate",
        "criminal",
        "family",
        "other",
      ]),
      clientPosition: faker.helpers.arrayElement([
        "plaintiff",
        "defendant",
        "appellant",
        "co_defendant",
        "petitioner",
        "petitioned_against",
        "respondent",
      ]),
      contact: contactId,
      date: faker.date.past().toISOString().split("T")[0],
      closeDate: faker.datatype.boolean()
        ? faker.date.past().toISOString().split("T")[0]
        : undefined,
      name: faker.lorem.words({ min: 3, max: 5 }),
      notes: faker.lorem.paragraph(),
      employee: faker.number.int({ min: 0, max: 9 }),
    });
  }
}

const payments: {
  contact: number;
  cost: number;
  minutes: number;
  date: string;
  invoiceId: string;
}[] = [];
const entries: {
  contact: number;
  matter: number;
  employee: number;
  date: string;
  minutes: number;
  billable: boolean;
}[] = [];

for (let matterId = 0; matterId < matters.length; matterId++) {
  const matter = matters[matterId];
  const contactId = matter.contact;
  const paymentCount = faker.number.int({ min: 0, max: 5 });
  for (let i = 0; i < paymentCount; i++) {
    const cost = faker.number.float({ min: 0, max: 1000, precision: 2 });
    const minutes = faker.number.int({ min: 500, max: 1200 });
    const date = faker.date.past().toISOString().split("T")[0];
    payments.push({
      contact: contactId,
      cost,
      minutes,
      date,
      invoiceId: faker.string.uuid(),
    });
  }
  const entryCount = faker.number.int({ min: 1, max: 15 });
  for (let i = 0; i < entryCount; i++) {
    const minutes = faker.number.int({ min: 10, max: 300 });
    const date = faker.date.past().toISOString().split("T")[0];
    const billable = faker.datatype.boolean(0.95);
    entries.push({
      contact: contactId,
      matter: matterId,
      employee: matter.employee,
      minutes,
      date,
      billable,
    });
  }
}

addScript({
  name: "init-dev-db",
  procedure: [
    modify(
      `insert into db.employee (first_name, last_name, email, global_id, disabled) values ${employees
        .map((r) => {
          const values = [
            stringLiteral(r.firstName),
            stringLiteral(r.lastName),
            stringLiteral(r.email),
            `cast(${stringLiteral(r.uuid)} as uuid)`,
          ];
          return `(${values.join(",")}, false)`;
        })
        .join(",")}`
    ),
    modify(
      `insert into db.employee_role (employee, role) values (0, 'sys_admin')`
    ),
    modify(
      `insert into db.contact (type, first_name, last_name, email, phone_number, date_of_birth, street, city, state, zip, country, mailing_list) values ${contacts.map(
        (r) => {
          const values = [
            stringLiteral(r.type),
            stringLiteral(r.firstName),
            stringLiteral(r.lastName),
            stringLiteral(r.email),
            stringLiteral(r.phoneNumber),
            `DATE '${r.dateOfBirth}'`,
            stringLiteral(r.street),
            stringLiteral(r.city),
            stringLiteral(r.state),
            stringLiteral(r.zip),
            stringLiteral(r.country),
            r.mailingList,
          ];
          return `(${values.join(",")})`;
        }
      )}`
    ),
    modify(
      `insert into db.matter (type, name, contact, employee, client_position, date, close_date, notes) values ${matters.map(
        (r) => {
          const values = [
            stringLiteral(r.type),
            stringLiteral(r.name),
            r.contact,
            r.employee,
            stringLiteral(r.clientPosition),
            `DATE '${r.date}'`,
            r.closeDate ? `DATE '${r.closeDate}'` : "null",
            stringLiteral(r.notes),
          ];
          return `(${values.join(",")})`;
        }
      )}`
    ),
    modify(
      `insert into db.matter_start (matter, contact, date) values ${matters.map(
        (r, i) => {
          const values = [i, r.contact, `DATE '${r.date}'`];
          return `(${values.join(",")})`;
        }
      )}`
    ),
    modify(
      `insert into db.matter_start (matter, contact, date) values ${matters
        .filter((r) => r.closeDate)
        .map((r, i) => {
          const values = [i, r.contact, `DATE '${r.closeDate}'`];
          return `(${values.join(",")})`;
        })}`
    ),
    modify(
      `insert into db.payment (contact, cost, minutes, date, invoice_id) values ${payments.map(
        (r) => {
          const values = [
            r.contact,
            r.cost,
            r.minutes,
            `DATE '${r.date}'`,
            stringLiteral(r.invoiceId),
          ];
          return `(${values.join(",")})`;
        }
      )}`
    ),
    modify(
      `insert into db.time_entry (contact, matter, employee, date, minutes, billable) values ${entries.map(
        (r) => {
          const values = [
            r.contact,
            r.matter,
            r.employee,
            `DATE '${r.date}'`,
            r.minutes,
            r.billable,
          ];
          return `(${values.join(",")})`;
        }
      )}`
    ),
    saveDb(`data/dev`),
  ],
});
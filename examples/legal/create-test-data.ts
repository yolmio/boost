import { faker } from "@faker-js/faker";
import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";

fs.mkdirSync("./data/csv", { recursive: true });

faker.seed(123);

const employees: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}[] = [];

for (let i = 0; i < 200; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  employees.push({
    id: i,
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }),
  });
}

await createObjectCsvWriter({
  path: "./data/csv/employee.csv",
  header: [
    { id: "id", title: "id" },
    { id: "firstName", title: "first_name" },
    { id: "lastName", title: "last_name" },
    { id: "email", title: "email" },
  ],
}).writeRecords(employees);

const contacts: {
  id: number;
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

for (let i = 0; i < 500_000; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  contacts.push({
    id: i,
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

await createObjectCsvWriter({
  path: "./data/csv/contact.csv",
  header: [
    { id: "id", title: "id" },
    { id: "type", title: "type" },
    { id: "firstName", title: "first_name" },
    { id: "lastName", title: "last_name" },
    { id: "email", title: "email" },
    { id: "phoneNumber", title: "phone_number" },
    { id: "dateOfBirth", title: "date_of_birth" },
    { id: "street", title: "street" },
    { id: "city", title: "city" },
    { id: "state", title: "state" },
    { id: "zip", title: "zip" },
    { id: "country", title: "country" },
    { id: "mailingList", title: "mailing_list" },
  ],
}).writeRecords(contacts);

const clients = contacts.filter((c) => c.type === "client");

const matters: {
  id: number;
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
  const matterCount = faker.number.int({ min: 0, max: 75 });
  const contactId = contacts.indexOf(client);
  let lastMatterDate = faker.date.past({ years: 15 });
  for (let i = 0; i < matterCount; i++) {
    if (lastMatterDate > new Date()) {
      continue;
    }
    const startDate = new Date(
      lastMatterDate.getTime() +
        faker.number.int({ min: 1, max: 5 }) * 1000 * 60 * 60 * 24,
    );
    if (startDate > new Date()) {
      continue;
    }
    const endDate = faker.date.between({
      from: startDate,
      to: new Date(
        Math.max(startDate.getTime() + 1000 * 60 * 60 * 24 * 60, Date.now()),
      ),
    });
    lastMatterDate = endDate;
    const hasClosed = faker.datatype.boolean(0.9);
    matters.push({
      id: matters.length,
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
      date: startDate.toISOString().split("T")[0],
      closeDate: hasClosed ? endDate.toISOString().split("T")[0] : undefined,
      name: faker.lorem.words({ min: 3, max: 5 }),
      notes: faker.lorem.paragraph(),
      employee: faker.number.int({ min: 0, max: employees.length - 1 }),
    });
    if (!hasClosed) {
      break;
    }
  }
}

await createObjectCsvWriter({
  path: "./data/csv/matter.csv",
  header: [
    { id: "id", title: "id" },
    { id: "name", title: "name" },
    { id: "type", title: "type" },
    { id: "contact", title: "contact" },
    { id: "employee", title: "employee" },
    { id: "clientPosition", title: "client_position" },
    { id: "date", title: "date" },
    { id: "close_date", title: "close_date" },
    { id: "notes", title: "notes" },
  ],
}).writeRecords(matters);

const payments: {
  id: number;
  contact: number;
  cost: number;
  minutes: number;
  date: string;
  invoiceId: string;
}[] = [];
const entries: {
  id: number;
  matter: number;
  employee: number;
  date: string;
  minutes: number;
  billable: boolean;
}[] = [];
let nextPaymentId = 0;
let nextEntryId = 0;
const paymentsWriter = createObjectCsvWriter({
  path: "./data/csv/payment.csv",
  header: [
    { id: "id", title: "id" },
    { id: "contact", title: "contact" },
    { id: "cost", title: "cost" },
    { id: "minutes", title: "minutes" },
    { id: "date", title: "date" },
    { id: "invoiceId", title: "invoice_id" },
  ],
});
const entriesWriter = createObjectCsvWriter({
  path: "./data/csv/time_entry.csv",
  header: [
    { id: "id", title: "id" },
    { id: "matter", title: "matter" },
    { id: "employee", title: "employee" },
    { id: "minutes", title: "minutes" },
    { id: "date", title: "date" },
    { id: "billable", title: "billable" },
  ],
});

for (let matterId = 0; matterId < matters.length; matterId++) {
  const matter = matters[matterId];
  const contactId = matter.contact;
  const entryCount = faker.number.int({ min: 1, max: 200 });
  const paymentCount = faker.number.int({
    min: 1,
    max: Math.max(1, Math.floor(entryCount / 3)),
  });
  for (let i = 0; i < paymentCount; i++) {
    const cost = faker.number.float({ min: 0, max: 1000, precision: 2 });
    const minutes = faker.number.int({ min: 500, max: 1200 });
    const date = faker.date
      .between({
        from: matter.date,
        to: matter.closeDate ?? Date.now(),
      })
      .toISOString()
      .split("T")[0];
    payments.push({
      id: nextPaymentId,
      contact: contactId,
      cost,
      minutes,
      date,
      invoiceId: faker.string.uuid(),
    });
    nextPaymentId++;
  }
  if (payments.length > 10_000) {
    await paymentsWriter.writeRecords(payments);
    payments.length = 0;
  }
  for (let i = 0; i < entryCount; i++) {
    const minutes = faker.number.int({ min: 10, max: 300 });
    const date = faker.date
      .between({
        from: matter.date,
        to: matter.closeDate ?? Date.now(),
      })
      .toISOString()
      .split("T")[0];
    const billable = faker.datatype.boolean(0.95);
    entries.push({
      id: nextEntryId,
      matter: matterId,
      employee: matter.employee,
      minutes,
      date,
      billable,
    });
    nextEntryId++;
  }
  if (entries.length > 10_000) {
    await entriesWriter.writeRecords(entries);
    entries.length = 0;
  }
}
await paymentsWriter.writeRecords(payments);
await entriesWriter.writeRecords(entries);

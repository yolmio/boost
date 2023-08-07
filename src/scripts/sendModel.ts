import fetch from "node-fetch";
import { getAppModel } from "./utils";
import * as dns from "dns";

dns.setDefaultResultOrder("ipv4first");

const app = await getAppModel();

try {
  const res = await fetch("http://localhost:3000/api/update_app_model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(app),
  });
  if (!res.ok) {
    const errorMessage = await res.text();
    console.log(errorMessage);
  }
} catch (e) {
  console.error("Unable to send new model to dev server", e);
}

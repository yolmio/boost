import { runAppTs } from "./utils";
import { app } from "../dist/index";
import * as dns from "dns";

dns.setDefaultResultOrder("ipv4first");

await runAppTs();

try {
  const res = await fetch("http://localhost:3000/api/update_app_model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(app.generateYom()),
  });
  if (!res.ok) {
    const errorMessage = await res.text();
    console.log(errorMessage);
  }
} catch (e) {
  console.error("Unable to send new model to dev server", e);
}

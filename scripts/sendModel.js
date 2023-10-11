import { getAppModel } from "./utils.js";

const model = await getAppModel();

try {
  const res = await fetch("http://127.0.0.1:3000/api/update_app_model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(model),
  });
  if (!res.ok) {
    const errorMessage = await res.text();
    console.log(errorMessage);
  }
} catch (e) {
  console.error("Unable to send new model to dev server", e);
}

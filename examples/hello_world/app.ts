import { app } from "@yolm/boost";
const { ui } = app;

app.name = "hello_world";
app.title = "Hello World App";
app.displayName = "Hello World";
app.dbRunMode = "BrowserSync";

// ui

ui.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports"],
});

ui.pages.push({
  path: "/",
  content: "'hello world!'",
});

ui.pages.push({
  path: "/contacts",
  content: "'No contacts yet'",
});

ui.pages.push({
  path: "/reports",
  content: "'No reports yet'",
});

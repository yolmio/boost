import { hub } from "@yolm/boost";

hub.name = "hello_world";

// ui

const app = hub.addApp("hello_world", "Hello World");

app.useNavbarShell({
  color: "primary",
  variant: "solid",
  links: ["/contacts", "/reports"],
});

app.pages.push({
  path: "/",
  content: "'hello world!'",
});

app.pages.push({
  path: "/contacts",
  content: "'No contacts yet'",
});

app.pages.push({
  path: "/reports",
  content: "'No reports yet'",
});

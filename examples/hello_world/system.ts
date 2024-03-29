import { system } from "@yolm/boost";

system.name = "hello_world";
system.region = "us-miami";

// ui

const app = system.apps.add("hello_world", "Hello World");

app.shells.navbar({
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

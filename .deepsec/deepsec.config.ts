import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "port-swap", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});

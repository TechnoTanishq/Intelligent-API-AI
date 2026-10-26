import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// IntelliAPI AI traffic simulator (separate app, port 5174)
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        strictPort: true,
    },
});

import { defineConfig, loadEnv } from "vite"; // <-- 1. Import loadEnv
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 2. Load environment variables
  const env = loadEnv(mode, process.cwd(), "");

  return { // 3. Return the config object
    server: {
      host: "::",
      port: 8080,
      proxy: { // 4. Add this proxy configuration
        "/.auth": {
          target: env.VITE_CONVEX_URL, // Use the VITE_CONVEX_URL from your .env
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
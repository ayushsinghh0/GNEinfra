// pm2 process config for the single-box deployment.
//
// Sized for a small instance (e.g. AWS t3.micro, ~1 GB RAM). The key safety
// levers for a low-memory box:
//   - run the Next server binary DIRECTLY (not via `npm start`) so pm2 watches
//     the real node process — otherwise max_memory_restart watches the npm
//     wrapper and never fires.
//   - cap the V8 old-space heap well below total RAM.
//   - max_memory_restart restarts the process if RSS runs away, instead of
//     letting the Linux OOM killer take down node (and Caddy) with it.
//   - autorestart + min_uptime/max_restarts so a crash self-heals but a crash
//     LOOP (e.g. bad env) backs off instead of spinning forever.
module.exports = {
  apps: [
    {
      name: "gne-erp",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "550M",
      min_uptime: "20s",
      max_restarts: 15,
      restart_delay: 2000,
      kill_timeout: 8000, // give in-flight requests time to finish on restart
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Cap the heap so a leak triggers a self-restart (via max_memory_restart)
        // long before it can OOM the box. NOT the build setting — `next build`
        // gets its own higher limit in the deploy scripts.
        NODE_OPTIONS: "--max-old-space-size=400",
      },
    },
  ],
};

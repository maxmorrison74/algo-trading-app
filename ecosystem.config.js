module.exports = {
  apps: [
    {
      name: "algotrading-api",
      script: "venv/bin/python",
      args: "-m uvicorn api:app --host 0.0.0.0 --port 80",
      cwd: "./backend",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      error_file: "../logs/api-error.log",
      out_file: "../logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm Z"
    }
  ]
};

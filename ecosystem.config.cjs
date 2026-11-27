const path = require('path');

module.exports = {
  apps: [
    {
      name: 'part-finder',
      cwd: __dirname,
      script: path.join(__dirname, '.venv', 'bin', 'uvicorn'),
      args: 'main:app --app-dir backend --host 0.0.0.0 --port 3230',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
};

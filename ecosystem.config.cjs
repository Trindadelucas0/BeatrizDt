const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'beatriz-dt',
      cwd: path.join(__dirname),
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3454,
        STORAGE_BACKEND: 'postgres',
      },
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
    },
  ],
};

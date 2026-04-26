module.exports = {
  apps: [
    {
      name: 'housing-api',
      script: 'npm',
      args: 'run start -w api',
      cwd: './', // Root directory
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};

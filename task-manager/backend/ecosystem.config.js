module.exports = {
    apps: [{
        name: 'rental-backend',
        script: './server.js',
        instances: 2,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'production',
            PORT: 3001
        }
    }]
};
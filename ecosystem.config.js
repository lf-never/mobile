module.exports = {
    apps: [{
        name: 'MV Mobile',
        script: 'bin/www',
        instances: 2,
        exec_mode : 'cluster',
        out_file: "/dev/null",
        error_file: "/dev/null",
    }]
}
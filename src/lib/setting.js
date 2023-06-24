function load_env(key) {
    if (process.env[key]) {
        return process.env[key]
    }
    throw new Error(`${key} not loaded`)
}

module.exports = {
    ENS_GATEWAY_PORT: load_env('ENS_GATEWAY_PORT'),
    RDS_HOSTNAME: load_env('RDS_HOSTNAME'),
    RDS_USERNAME: load_env('RDS_USERNAME'),
    RDS_PASSWORD: load_env('RDS_PASSWORD'),
    RDS_PORT: load_env('RDS_PORT'),
    RDS_DATABASE: load_env('RDS_DATABASE'),
    ENS_OFFCHAIN_REGISTRY_PRIVATE_KEY: load_env('ENS_OFFCHAIN_REGISTRY_PRIVATE_KEY'),
}
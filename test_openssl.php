<?php

echo "Testing OpenSSL key generation...\n";

// Set temporary config
$tempConfig = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'openssl.cnf';
$configContent = '[req]
distinguished_name = req_distinguished_name
[req_distinguished_name]
';

file_put_contents($tempConfig, $configContent);
putenv("OPENSSL_CONF=$tempConfig");

echo "Using temporary config at: $tempConfig\n";

// Try without config first
echo "Trying default configuration...\n";
$res = openssl_pkey_new();
if (!$res) {
    echo "Default config failed, trying custom config...\n";
    
    $config = [
        "digest_alg" => "sha256",
        "private_key_bits" => 2048,
        "private_key_type" => OPENSSL_KEYTYPE_RSA,
        "config" => $tempConfig
    ];
    
    $res = openssl_pkey_new($config);
}
if (!$res) {
    echo "Failed to generate key\n";
    echo "OpenSSL Error: " . openssl_error_string() . "\n";
    exit(1);
}

echo "Key generated successfully!\n";

// Export private key with config
$success = openssl_pkey_export($res, $privKey, null, ["config" => $tempConfig]);
if (!$success) {
    echo "Failed to export private key\n";
    echo "OpenSSL Error: " . openssl_error_string() . "\n";
    exit(1);
}

echo "Private key exported successfully\n";
echo "Private key length: " . strlen($privKey) . " characters\n";

// Get public key
$pubKeyDetails = openssl_pkey_get_details($res);
if (!$pubKeyDetails) {
    echo "Failed to get public key\n";
    exit(1);
}

$pubKey = $pubKeyDetails["key"];
echo "Public key length: " . strlen($pubKey) . " characters\n";

echo "OpenSSL test completed successfully!\n";
<?php

namespace App\Services;

use App\Models\EncryptionKey;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Log;

class EncryptionService
{
    /**
     * Generate RSA key pair for user
     */
    public function generateKeyPair(User $user, ?string $passphrase = null): EncryptionKey
    {
        Log::info('Starting key generation for user', ['user_id' => $user->id]);
        
        // Create temporary OpenSSL config for Windows compatibility
        $tempConfig = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'openssl_' . uniqid() . '.cnf';
        $configContent = '[req]
distinguished_name = req_distinguished_name
[req_distinguished_name]
';
        file_put_contents($tempConfig, $configContent);
        
        // Generate private key with explicit config
        $config = [
            "digest_alg" => "sha256",
            "private_key_bits" => 2048,
            "private_key_type" => OPENSSL_KEYTYPE_RSA,
            "config" => $tempConfig
        ];

        // Create the private and public key
        $res = openssl_pkey_new($config);
        if (!$res) {
            $error = openssl_error_string() ?: 'Unknown OpenSSL error';
            Log::error('OpenSSL key generation failed', ['error' => $error]);
            @unlink($tempConfig);
            throw new Exception('Failed to generate private key: ' . $error);
        }

        // Extract the private key from $res to $privKey
        if ($passphrase) {
            $exportSuccess = openssl_pkey_export($res, $privKey, $passphrase, ["config" => $tempConfig]);
        } else {
            // No passphrase - generate unencrypted private key
            $exportSuccess = openssl_pkey_export($res, $privKey, null, ["config" => $tempConfig]);
        }
        if (!$exportSuccess) {
            $error = openssl_error_string() ?: 'Unknown export error';
            Log::error('OpenSSL key export failed', ['error' => $error]);
            @unlink($tempConfig);
            throw new Exception('Failed to export private key: ' . $error);
        }

        // Extract the public key from $res to $pubKey
        $pubKey = openssl_pkey_get_details($res);
        if (!$pubKey) {
            Log::error('Failed to get public key details');
            @unlink($tempConfig);
            throw new Exception('Failed to extract public key');
        }
        
        $publicKey = $pubKey["key"];
        
        // Clean up temporary config
        @unlink($tempConfig);

        // Check if user already has keys
        $existingKey = EncryptionKey::where('userId', $user->id)->first();
        
        if ($existingKey) {
            // Update existing keys
            $existingKey->update([
                'publicKey' => $publicKey,
                'privateKey' => $privKey,
            ]);
            return $existingKey;
        }

        // Create new encryption key record
        $encryptionKey = EncryptionKey::create([
            'userId' => $user->id,
            'publicKey' => $publicKey,
            'privateKey' => $privKey,
        ]);

        \Log::info('Encryption key created', [
            'user_id' => $user->id,
            'key_id' => $encryptionKey->id,
            'public_key_length' => strlen($publicKey),
            'private_key_length' => strlen($privKey)
        ]);

        return $encryptionKey;
    }

    /**
     * Get user's public key
     */
    public function getPublicKey(User $user): ?string
    {
        $encryptionKey = EncryptionKey::where('userId', $user->id)->first();
        return $encryptionKey?->publicKey;
    }

    /**
     * Get user's private key
     */
    public function getPrivateKey(User $user): ?string
    {
        $encryptionKey = EncryptionKey::where('userId', $user->id)->first();
        return $encryptionKey?->privateKey;
    }

    /**
     * Sign data with private key
     */
    public function signData(string $data, string $privateKey, ?string $passphrase = null): string
    {
        if ($passphrase) {
            $privateKeyResource = openssl_pkey_get_private($privateKey, $passphrase);
        } else {
            $privateKeyResource = openssl_pkey_get_private($privateKey);
        }
        if (!$privateKeyResource) {
            throw new Exception('Invalid private key or passphrase');
        }

        openssl_sign($data, $signature, $privateKeyResource, OPENSSL_ALGO_SHA256);
        
        return base64_encode($signature);
    }

    /**
     * Verify signature with public key
     */
    public function verifySignature(string $data, string $signature, string $publicKey): bool
    {
        $publicKeyResource = openssl_pkey_get_public($publicKey);
        if (!$publicKeyResource) {
            throw new Exception('Invalid public key');
        }

        $signatureData = base64_decode($signature);
        
        return openssl_verify($data, $signatureData, $publicKeyResource, OPENSSL_ALGO_SHA256) === 1;
    }

    /**
     * Encrypt data with public key
     */
    public function encryptData(string $data, string $publicKey): string
    {
        $publicKeyResource = openssl_pkey_get_public($publicKey);
        if (!$publicKeyResource) {
            throw new Exception('Invalid public key');
        }

        if (!openssl_public_encrypt($data, $encrypted, $publicKeyResource)) {
            throw new Exception('Failed to encrypt data');
        }

        return base64_encode($encrypted);
    }

    /**
     * Decrypt data with private key
     */
    public function decryptData(string $encryptedData, string $privateKey, ?string $passphrase = null): string
    {
        $privateKeyResource = openssl_pkey_get_private($privateKey, $passphrase);
        if (!$privateKeyResource) {
            throw new Exception('Invalid private key or passphrase');
        }

        $encryptedData = base64_decode($encryptedData);
        
        if (!openssl_private_decrypt($encryptedData, $decrypted, $privateKeyResource)) {
            throw new Exception('Failed to decrypt data');
        }

        return $decrypted;
    }

    /**
     * Check if user has encryption keys
     */
    public function hasKeys(User $user): bool
    {
        return EncryptionKey::where('userId', $user->id)->exists();
    }

    /**
     * Get key information for user
     */
    public function getKeyInfo(User $user): ?array
    {
        $encryptionKey = EncryptionKey::where('userId', $user->id)->first();
        
        if (!$encryptionKey) {
            return null;
        }

        // Get key details
        $publicKeyResource = openssl_pkey_get_public($encryptionKey->publicKey);
        $keyDetails = openssl_pkey_get_details($publicKeyResource);

        return [
            'created_at' => $encryptionKey->created_at,
            'key_size' => $keyDetails['bits'],
            'key_type' => 'RSA',
            'algorithm' => 'SHA256withRSA',
            'public_key_fingerprint' => md5($encryptionKey->publicKey),
        ];
    }

    /**
     * Export public key for sharing
     */
    public function exportPublicKey(User $user): ?string
    {
        $publicKey = $this->getPublicKey($user);
        
        if (!$publicKey) {
            return null;
        }

        return base64_encode($publicKey);
    }

    /**
     * Import public key from base64
     */
    public function importPublicKey(string $base64PublicKey): string
    {
        $publicKey = base64_decode($base64PublicKey);
        
        // Validate the key
        $publicKeyResource = openssl_pkey_get_public($publicKey);
        if (!$publicKeyResource) {
            throw new Exception('Invalid public key format');
        }

        return $publicKey;
    }
}
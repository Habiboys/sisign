<?php

namespace App\Http\Controllers;

use App\Services\EncryptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class EncryptionController extends Controller
{
    protected EncryptionService $encryptionService;

    public function __construct(EncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
    }

    /**
     * Show encryption keys management page
     */
    public function index()
    {
        $user = Auth::user();
        
        // Only pimpinan can access encryption keys
        if (!$user->isPimpinan()) {
            abort(403, 'Hanya pimpinan yang dapat mengakses kunci enkripsi');
        }
        
        $hasKeys = $this->encryptionService->hasKeys($user);
        $keyInfo = $hasKeys ? $this->encryptionService->getKeyInfo($user) : null;

        return Inertia::render('Encryption/Index', [
            'hasKeys' => $hasKeys,
            'keyInfo' => $keyInfo,
            'publicKey' => $hasKeys ? $this->encryptionService->exportPublicKey($user) : null,
        ]);
    }

    /**
     * Generate new key pair
     */
    public function generateKeys(Request $request)
    {
        $user = Auth::user();
        
        // Only pimpinan can generate encryption keys
        if (!$user->isPimpinan()) {
            return redirect()->route('encryption.index')
                ->with('error', 'Hanya pimpinan yang dapat membuat kunci enkripsi');
        }
        
        $request->validate([
            'passphrase' => 'nullable|string|min:6',
            'confirm_passphrase' => 'nullable|string|same:passphrase',
        ]);

        try {
            
            // Log the attempt
            Log::info('Starting key generation via web interface', [
                'user_id' => $user->id,
                'has_passphrase' => !empty($request->passphrase)
            ]);
            
            $encryptionKey = $this->encryptionService->generateKeyPair(
                $user, 
                !empty($request->passphrase) ? $request->passphrase : null
            );
            
            Log::info('Key generation completed via web interface', [
                'user_id' => $user->id,
                'key_id' => $encryptionKey->id
            ]);

            // Use redirect with success message
            return redirect()->route('encryption.index')
                ->with('success', 'Encryption keys generated successfully!');
                
        } catch (\Exception $e) {
            Log::error('Key generation failed via web interface', [
                'user_id' => Auth::user()->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Use redirect with error message
            return redirect()->route('encryption.index')
                ->with('error', 'Failed to generate keys: ' . $e->getMessage());
        }
    }

    /**
     * Export public key
     */
    public function exportPublicKey()
    {
        try {
            $user = Auth::user();
            $publicKey = $this->encryptionService->exportPublicKey($user);

            if (!$publicKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'No public key found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'publicKey' => $publicKey,
                'keyInfo' => $this->encryptionService->getKeyInfo($user),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export public key: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download public key as file
     */
    public function downloadPublicKey()
    {
        try {
            $user = Auth::user();
            $publicKey = $this->encryptionService->getPublicKey($user);

            if (!$publicKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'No public key found',
                ], 404);
            }

            $filename = 'sisign_' . $user->name . '_public_key.pem';
            
            return response($publicKey)
                ->header('Content-Type', 'application/x-pem-file')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
                
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to download public key: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test encryption/decryption
     */
    public function testEncryption(Request $request)
    {
        $request->validate([
            'test_data' => 'required|string|max:200',
            'passphrase' => 'nullable|string',
        ]);

        try {
            $user = Auth::user();
            $testData = $request->test_data;
            
            // Get keys
            $publicKey = $this->encryptionService->getPublicKey($user);
            $privateKey = $this->encryptionService->getPrivateKey($user);

            if (!$publicKey || !$privateKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'Encryption keys not found',
                ], 404);
            }

            // Test encryption
            $encrypted = $this->encryptionService->encryptData($testData, $publicKey);
            
            // Test decryption
            $decrypted = $this->encryptionService->decryptData(
                $encrypted, 
                $privateKey, 
                $request->passphrase
            );

            // Test signing
            $signature = $this->encryptionService->signData(
                $testData, 
                $privateKey, 
                $request->passphrase
            );

            // Test verification
            $isValid = $this->encryptionService->verifySignature($testData, $signature, $publicKey);

            return response()->json([
                'success' => true,
                'test_results' => [
                    'original_data' => $testData,
                    'encrypted_data' => substr($encrypted, 0, 50) . '...',
                    'decrypted_data' => $decrypted,
                    'encryption_success' => $testData === $decrypted,
                    'signature' => substr($signature, 0, 50) . '...',
                    'signature_valid' => $isValid,
                    'all_tests_passed' => $testData === $decrypted && $isValid,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Test failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete encryption keys
     */
    public function deleteKeys(Request $request)
    {
        $request->validate([
            'confirmation' => 'required|string|in:DELETE',
        ]);

        try {
            $user = Auth::user();
            $encryptionKey = \App\Models\EncryptionKey::where('userId', $user->id)->first();

            if (!$encryptionKey) {
                return response()->json([
                    'success' => false,
                    'message' => 'No encryption keys found',
                ], 404);
            }

            $encryptionKey->delete();

            return response()->json([
                'success' => true,
                'message' => 'Encryption keys deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete keys: ' . $e->getMessage(),
            ], 500);
        }
    }
}
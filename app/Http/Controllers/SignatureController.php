<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\EncryptionKey;
use App\Models\Signature;
use App\Models\User;
use App\Services\EncryptionService;
use App\Services\SignatureService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class SignatureController extends Controller
{
    protected SignatureService $signatureService;

    protected EncryptionService $encryptionService;

    public function __construct(SignatureService $signatureService, EncryptionService $encryptionService)
    {
        $this->signatureService = $signatureService;
        $this->encryptionService = $encryptionService;
    }

    public function index()
    {
        $signatures = Signature::with(['document', 'user'])
            ->latest('signedAt')
            ->paginate(10);

        return Inertia::render('Signatures/Index', [
            'signatures' => $signatures,
            'user' => Auth::user(),
        ]);
    }

    public function create(Request $request)
    {
        $documentId = $request->get('document_id');
        $templateId = $request->get('template_id');

        if ($documentId) {
            // Redirect to new sign page
            return redirect()->route('documents.sign', $documentId);
        }

        if ($templateId) {
            // For templates, redirect to template sign page
            return redirect()->route('templates.sign', $templateId);
        }

        abort(404);
    }

    /**
     * Show signature page for a document
     */
    public function show(Document $document)
    {
        $user = Auth::user();

        // Only pimpinan can access signature page
        if ($user->role !== 'pimpinan') {
            abort(403, 'Hanya pimpinan yang dapat mengakses halaman tanda tangan');
        }

        $document->load(['user', 'signatures.user', 'signers.user']);
        $hasEncryptionKeys = EncryptionKey::where('userId', Auth::id())->exists();

        return Inertia::render('Signature/Show', [
            'document' => $document,
            'existingSignatures' => $this->signatureService->getSignaturePositions($document),
            'canSign' => $document->canUserSign($user),
            'hasEncryptionKeys' => $hasEncryptionKeys,
            'user' => $user,
        ]);
    }

    /**
     * Create physical signature (canvas-based)
     */
    public function storePhysical(Request $request, Document $document)
    {
        $user = Auth::user();

        // Only pimpinan can create signatures
        if ($user->role !== 'pimpinan') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pimpinan yang dapat membuat tanda tangan',
            ], 403);
        }

        // Check if user is a designated signer
        $signer = $document->signerFor($user);
        if (! $signer) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak terdaftar sebagai penanda tangan untuk dokumen ini.',
            ], 403);
        }

        // Check if user already signed
        if ($signer->is_signed) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah menandatangani dokumen ini.',
            ], 403);
        }

        // Enforce sign order
        if (! $document->canSignNow($signer)) {
            return response()->json([
                'success' => false,
                'message' => 'Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.',
            ], 403);
        }

        $request->validate([
            'signatureData' => 'required|string',
            'position' => 'array',
            'position.x' => 'nullable|integer|min:0',
            'position.y' => 'nullable|integer|min:0',
            'position.width' => 'nullable|integer|min:50|max:300',
            'position.height' => 'nullable|integer|min:25|max:150',
            'position.page' => 'nullable|integer|min:1',
        ]);

        try {
            $signature = DB::transaction(function () use ($document, $user, $request) {
                // Lock the document row so concurrent signing requests for this
                // document (which read-modify-write the same cumulative PDF) are serialized.
                $lockedDocument = Document::whereKey($document->id)->lockForUpdate()->first();
                $signer = $lockedDocument->signerFor($user);

                if (! $signer || $signer->is_signed) {
                    throw new \RuntimeException('Anda sudah menandatangani dokumen ini.');
                }

                if (! $lockedDocument->canSignNow($signer)) {
                    throw new \RuntimeException('Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.');
                }

                $signature = $this->signatureService->createPhysicalSignature([
                    'documentId' => $document->id,
                    'userId' => $user->id,
                    'signatureData' => $request->signatureData,
                    'position' => $request->position ?? [],
                ]);

                $signer->update(['is_signed' => true]);

                return $signature;
            });

            return response()->json([
                'success' => true,
                'message' => 'Physical signature created successfully',
                'signature' => $signature->load('user'),
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create physical signature: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create digital signature (cryptographic)
     */
    public function storeDigital(Request $request, Document $document)
    {
        $user = Auth::user();

        // Only pimpinan can create signatures
        if ($user->role !== 'pimpinan') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pimpinan yang dapat membuat tanda tangan',
            ], 403);
        }

        // Check if user is a designated signer
        $signer = $document->signerFor($user);
        if (! $signer) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak terdaftar sebagai penanda tangan untuk dokumen ini.',
            ], 403);
        }

        // Check if user already signed
        if ($signer->is_signed) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah menandatangani dokumen ini.',
            ], 403);
        }

        // Enforce sign order
        if (! $document->canSignNow($signer)) {
            return response()->json([
                'success' => false,
                'message' => 'Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.',
            ], 403);
        }

        $request->validate([
            'position' => 'array',
            'position.x' => 'nullable|integer|min:0',
            'position.y' => 'nullable|integer|min:0',
            'position.width' => 'nullable|integer|min:100|max:400',
            'position.height' => 'nullable|integer|min:50|max:200',
            'position.page' => 'nullable|integer|min:1',
            'pin' => 'required|string|digits:6',
        ]);

        if (! Hash::check($request->pin, $user->pin)) {
            return response()->json([
                'success' => false,
                'message' => 'PIN salah',
            ], 403);
        }

        try {
            $signature = DB::transaction(function () use ($document, $user, $request) {
                // Lock the document row so concurrent signing requests for this
                // document are serialized and can't both pass the "already signed" check.
                $lockedDocument = Document::whereKey($document->id)->lockForUpdate()->first();
                $signer = $lockedDocument->signerFor($user);

                if (! $signer || $signer->is_signed) {
                    throw new \RuntimeException('Anda sudah menandatangani dokumen ini.');
                }

                if (! $lockedDocument->canSignNow($signer)) {
                    throw new \RuntimeException('Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.');
                }

                $signature = $this->signatureService->createDigitalSignature([
                    'documentId' => $document->id,
                    'userId' => $user->id,
                    'position' => $request->position ?? [],
                    'passphrase' => $request->pin, // Use PIN as passphrase
                ]);

                $signer->update(['is_signed' => true]);

                return $signature;
            });

            return response()->json([
                'success' => true,
                'message' => 'Digital signature created successfully',
                'signature' => $signature->load('user'),
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create combined signature (physical + digital)
     */
    public function storeCombined(Request $request, Document $document)
    {
        $user = Auth::user();

        // Only pimpinan can create signatures
        if ($user->role !== 'pimpinan') {
            return redirect()->back()->withErrors(['error' => 'Hanya pimpinan yang dapat membuat tanda tangan']);
        }

        // Check if user is a designated signer
        $signer = $document->signerFor($user);
        if (! $signer) {
            return redirect()->back()->withErrors(['error' => 'Anda tidak terdaftar sebagai penanda tangan untuk dokumen ini.']);
        }

        // Check if user already signed
        if ($signer->is_signed) {
            return redirect()->back()->withErrors(['error' => 'Anda sudah menandatangani dokumen ini.']);
        }

        // Enforce sign order
        if (! $document->canSignNow($signer)) {
            return redirect()->back()->withErrors(['error' => 'Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.']);
        }

        $request->validate([
            'signatureData' => 'required|string',
            'position' => 'required|array',
            'position.x' => 'required|integer|min:0',
            'position.y' => 'required|integer|min:0',
            'position.width' => 'nullable|integer|min:50|max:300',
            'position.height' => 'nullable|integer|min:25|max:150',
            'position.page' => 'nullable|integer|min:1',
            'pin' => 'required|string|digits:6',
            'signedPdfBase64' => 'nullable|string',
        ]);

        if (! Hash::check($request->pin, $user->pin)) {
            return redirect()->back()->withErrors(['error' => 'PIN salah']);
        }

        try {
            DB::transaction(function () use ($document, $user, $request) {
                // Lock the document row so concurrent signing requests for this
                // document (which read-modify-write the same cumulative signed PDF)
                // are serialized instead of racing to overwrite each other's output.
                $lockedDocument = Document::whereKey($document->id)->lockForUpdate()->first();
                $signer = $lockedDocument->signerFor($user);

                if (! $signer || $signer->is_signed) {
                    throw new \RuntimeException('Anda sudah menandatangani dokumen ini.');
                }

                if (! $lockedDocument->canSignNow($signer)) {
                    throw new \RuntimeException('Tunggu penanda tangan sebelumnya menyelesaikan tanda tangan terlebih dahulu.');
                }

                // Create physical signature
                $this->signatureService->createPhysicalSignature([
                    'documentId' => $document->id,
                    'userId' => $user->id,
                    'signatureData' => $request->signatureData, // Frontend should send image data or null if using saved image? Handled by frontend sending logic.
                    'position' => $request->position,
                ]);

                // Create digital signature (for verification, not displayed in PDF)
                $this->signatureService->createDigitalSignature([
                    'documentId' => $document->id,
                    'userId' => $user->id,
                    'position' => [
                        'x' => $request->position['x'],
                        'y' => $request->position['y'] + ($request->position['height'] ?? 75) + 10,
                        'width' => 200,
                        'height' => 60,
                        'page' => $request->position['page'] ?? 1,
                    ],
                    'passphrase' => $request->pin, // Use PIN
                ]);

                // Save signed PDF if provided
                if ($request->signedPdfBase64) {
                    Log::info('Attempting to save signed PDF', [
                        'document_id' => $document->id,
                        'data_length' => strlen($request->signedPdfBase64),
                    ]);

                    $this->signatureService->saveSignedPDF($document, $request->signedPdfBase64);

                    Log::info('Signed PDF saved successfully');
                } else {
                    Log::warning('No signed PDF data provided');
                }

                $signer->update(['is_signed' => true]);
            });

            return redirect()->route('documents.show', $document->id)->with('success', 'Tanda tangan berhasil ditambahkan (Fisik + Digital)');
        } catch (\RuntimeException $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    /**
     * Preview signed PDF in browser
     */
    public function previewSignedPDF(Document $document)
    {
        try {
            // If document already has a signed file, use that instead of generating new one
            if ($document->signed_file && Storage::disk('public')->exists($document->signed_file)) {
                $signedFilePath = storage_path('app/public/'.$document->signed_file);
                $file = file_get_contents($signedFilePath);
            } else {
                // Otherwise, generate signed PDF dynamically
                $signedPdfPath = $this->signatureService->applySignaturesToPDF($document);
                $file = file_get_contents($signedPdfPath);

                // Clean up temporary file
                unlink($signedPdfPath);
            }

            return response($file, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="signed_'.basename($document->files).'"',
                'Accept-Ranges' => 'none', // Try to discourage IDM
            ]);
        } catch (\Exception $e) {
            return response('Error generating signed PDF: '.$e->getMessage(), 500);
        }
    }

    /**
     * Generate signed PDF with all signatures
     */
    public function generateSignedPDF(Document $document)
    {
        try {
            // If document already has a signed file, use that instead of generating new one
            if ($document->signed_file && Storage::disk('public')->exists($document->signed_file)) {
                $signedFilePath = storage_path('app/public/'.$document->signed_file);

                return Response::download($signedFilePath, 'signed_'.basename($document->files));
            }

            // Otherwise, generate signed PDF dynamically
            $signedPdfPath = $this->signatureService->applySignaturesToPDF($document);

            return Response::download($signedPdfPath, 'signed_'.basename($document->files))
                ->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate signed PDF: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify digital signature
     */
    public function verifyDigital(Signature $signature)
    {
        if ($signature->type !== 'digital') {
            return response()->json([
                'success' => false,
                'message' => 'This is not a digital signature',
            ], 400);
        }

        try {
            $isValid = $this->signatureService->verifyDigitalSignature($signature);

            return response()->json([
                'success' => true,
                'valid' => $isValid,
                'message' => $isValid ? 'Signature is valid' : 'Signature is invalid or tampered',
                'signature_info' => [
                    'signer' => $signature->user->name,
                    'signed_at' => $signature->signedAt,
                    'certificate_info' => json_decode($signature->certificate_info, true),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to verify signature: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update signature position
     */
    public function updatePosition(Request $request, Signature $signature)
    {
        $request->validate([
            'position_x' => 'required|integer|min:0',
            'position_y' => 'required|integer|min:0',
            'width' => 'nullable|integer|min:50',
            'height' => 'nullable|integer|min:25',
            'page_number' => 'nullable|integer|min:1',
        ]);

        if ($signature->userId !== Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to update this signature',
            ], 403);
        }

        try {
            $signature->update([
                'position_x' => $request->position_x,
                'position_y' => $request->position_y,
                'width' => $request->width ?? $signature->width,
                'height' => $request->height ?? $signature->height,
                'page_number' => $request->page_number ?? $signature->page_number,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Signature position updated successfully',
                'signature' => $signature->fresh(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update signature position: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete the authenticated user's signature(s) (physical + digital together)
     * from a document, then rebuild the cumulative signed PDF from what remains.
     */
    public function destroy(Document $document)
    {
        $user = Auth::user();

        try {
            DB::transaction(function () use ($document, $user) {
                // Lock the document row to keep this in sync with concurrent signing requests.
                $lockedDocument = Document::whereKey($document->id)->lockForUpdate()->first();

                if ($lockedDocument->isCompleted()) {
                    throw new \RuntimeException('Dokumen sudah lengkap ditandatangani semua pihak, tidak dapat menghapus tanda tangan.');
                }

                $signatures = Signature::where('documentId', $lockedDocument->id)
                    ->where('userId', $user->id)
                    ->get();

                if ($signatures->isEmpty()) {
                    throw new \RuntimeException('Anda belum menandatangani dokumen ini.');
                }

                foreach ($signatures as $signature) {
                    if ($signature->signatureFile) {
                        Storage::delete($signature->signatureFile);
                    }
                    $signature->delete();
                }

                $signer = $lockedDocument->signerFor($user);
                $signer?->update(['is_signed' => false]);

                $this->signatureService->reconstructSignedDocument($lockedDocument);
            });

            return back()->with('success', 'Tanda tangan (fisik + digital) berhasil dihapus');
        } catch (\RuntimeException $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        } catch (\Exception $e) {
            return back()->withErrors([
                'error' => 'Failed to delete signature: '.$e->getMessage(),
            ]);
        }
    }

    /**
     * Verify document signature (public access)
     */
    public function verifyDocument(Document $document)
    {
        try {
            // Get all signatures for this document
            $signatures = $document->signatures()->with('user')->get();

            // Get all required signers
            $signers = $document->signers()->get();

            // Get document info
            $documentInfo = [
                'id' => $document->id,
                'title' => $document->title,
                'number' => $document->number,
                'created_at' => $document->created_at,
                'status' => $document->review->status ?? 'pending',
            ];

            // Get signature info
            $signatureInfo = $signatures->map(function ($signature) {
                return [
                    'id' => $signature->id,
                    'type' => $signature->type,
                    'user_name' => $signature->user->name ?? 'Unknown',
                    'signed_at' => $signature->signedAt,
                    'position' => [
                        'x' => $signature->position_x,
                        'y' => $signature->position_y,
                        'width' => $signature->width,
                        'height' => $signature->height,
                        'page' => $signature->page_number,
                    ],
                ];
            });

            // Get signer info with status
            $signerInfo = $signers->map(function ($signer) {
                $user = User::find($signer->user_id);

                return [
                    'user_id' => $signer->user_id,
                    'name' => $user ? $user->name : 'Unknown',
                    'is_signed' => $signer->is_signed,
                    'sign_order' => $signer->sign_order,
                ];
            });

            // Check if all signers have signed
            $allSigned = $signers->every(function ($signer) {
                return $signer->is_signed;
            });

            // Bandingkan hash aktual file PDF signed_file saat ini dengan content_hash
            // yang tersimpan saat proses tanda tangan terakhir, untuk deteksi tampering.
            $integrityStatus = 'unknown';
            if ($document->content_hash) {
                $signedPath = $document->signed_file
                    ? storage_path('app/public/'.$document->signed_file)
                    : null;
                $currentHash = $signedPath ? $this->signatureService->hashFile($signedPath) : null;

                $integrityStatus = $currentHash === null
                    ? 'file_missing'
                    : ($currentHash === $document->content_hash ? 'valid' : 'tampered');
            }

            $verificationStatus = ! $allSigned
                ? 'unsigned'
                : ($integrityStatus === 'tampered' ? 'tampered' : 'signed');
            $isVerified = $allSigned && $integrityStatus !== 'tampered';

            $message = match (true) {
                ! $allSigned => 'Dokumen belum lengkap ditandatangani',
                $integrityStatus === 'tampered' => 'PERINGATAN: File dokumen telah diubah sejak ditandatangani. Hash tidak cocok.',
                $integrityStatus === 'file_missing' => 'Dokumen ditandatangani, namun file PDF tidak ditemukan di server.',
                default => 'Dokumen berhasil diverifikasi',
            };

            return Inertia::render('Verification/Show', [
                'document' => $documentInfo,
                'signatures' => $signatureInfo,
                'signers' => $signerInfo,
                'verification_status' => $verificationStatus,
                'integrity_status' => $integrityStatus,
                'verified_at' => now()->toISOString(),
                'success' => $isVerified,
                'message' => $message,
            ]);
        } catch (\Exception $e) {
            return Inertia::render('Verification/Show', [
                'document' => [
                    'id' => $document->id,
                    'title' => $document->title ?? 'Unknown Document',
                    'number' => $document->number ?? 'N/A',
                    'created_at' => $document->created_at ?? now(),
                    'status' => 'error',
                ],
                'signatures' => [],
                'signers' => [],
                'verification_status' => 'error',
                'verified_at' => now()->toISOString(),
                'success' => false,
                'message' => 'Gagal memverifikasi dokumen: '.$e->getMessage(),
            ]);
        }
    }
}

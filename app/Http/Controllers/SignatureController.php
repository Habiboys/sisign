<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\EncryptionKey;
use App\Models\Signature;
use App\Models\TemplateSertif;
use App\Services\EncryptionService;
use App\Services\SignatureService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'user' => Auth::user()
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
            // For templates, redirect to templates show page
            return redirect()->route('templates.show', $templateId);
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
        if (!$user->isPimpinan()) {
            abort(403, 'Hanya pimpinan yang dapat mengakses halaman tanda tangan');
        }

        $document->load(['user', 'signatures.user']);
        $hasEncryptionKeys = EncryptionKey::where('userId', Auth::id())->exists();

        return Inertia::render('Signature/Show', [
            'document' => $document,
            'existingSignatures' => $this->signatureService->getSignaturePositions($document),
            'canSign' => $this->canUserSign($document),
            'hasEncryptionKeys' => $hasEncryptionKeys,
        ]);
    }

    /**
     * Create physical signature (canvas-based)
     */
    public function storePhysical(Request $request, Document $document)
    {
        $user = Auth::user();

        // Only pimpinan can create signatures
        if (!$user->isPimpinan()) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pimpinan yang dapat membuat tanda tangan',
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
            $signature = $this->signatureService->createPhysicalSignature([
                'documentId' => $document->id,
                'userId' => Auth::id(),
                'signatureData' => $request->signatureData,
                'position' => $request->position ?? [],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Physical signature created successfully',
                'signature' => $signature->load('user'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create physical signature: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create digital signature (cryptographic)
     */
    public function storeDigital(Request $request, Document $document)
    {
        $request->validate([
            'position' => 'array',
            'position.x' => 'nullable|integer|min:0',
            'position.y' => 'nullable|integer|min:0',
            'position.width' => 'nullable|integer|min:100|max:400',
            'position.height' => 'nullable|integer|min:50|max:200',
            'position.page' => 'nullable|integer|min:1',
            'passphrase' => 'nullable|string',
        ]);

        try {
            $signature = $this->signatureService->createDigitalSignature([
                'documentId' => $document->id,
                'userId' => Auth::id(),
                'position' => $request->position ?? [],
                'passphrase' => $request->passphrase,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Digital signature created successfully',
                'signature' => $signature->load('user'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create digital signature: ' . $e->getMessage(),
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
        if (!$user->isPimpinan()) {
            return redirect()->back()->withErrors(['error' => 'Hanya pimpinan yang dapat membuat tanda tangan']);
        }

        $request->validate([
            'signatureData' => 'required|string',
            'position' => 'required|array',
            'position.x' => 'required|integer|min:0',
            'position.y' => 'required|integer|min:0',
            'position.width' => 'nullable|integer|min:50|max:300',
            'position.height' => 'nullable|integer|min:25|max:150',
            'position.page' => 'nullable|integer|min:1',
            'passphrase' => 'nullable|string',
            'signedPdfBase64' => 'nullable|string',
        ]);

        try {
            // Create physical signature
            $physicalSignature = $this->signatureService->createPhysicalSignature([
                'documentId' => $document->id,
                'userId' => Auth::id(),
                'signatureData' => $request->signatureData,
                'position' => $request->position,
            ]);

            // Create digital signature (for verification, not displayed in PDF)
            $digitalSignature = $this->signatureService->createDigitalSignature([
                'documentId' => $document->id,
                'userId' => Auth::id(),
                'position' => [
                    'x' => $request->position['x'],
                    'y' => $request->position['y'] + ($request->position['height'] ?? 75) + 10,
                    'width' => 200,
                    'height' => 60,
                    'page' => $request->position['page'] ?? 1,
                ],
                'passphrase' => $request->passphrase,
            ]);

            // Save signed PDF if provided
            if ($request->signedPdfBase64) {
                \Log::info('Attempting to save signed PDF', [
                    'document_id' => $document->id,
                    'data_length' => strlen($request->signedPdfBase64)
                ]);

                $this->signatureService->saveSignedPDF($document, $request->signedPdfBase64);

                \Log::info('Signed PDF saved successfully');
            } else {
                \Log::warning('No signed PDF data provided');
            }

            return redirect()->route('documents.show', $document->id)->with('success', 'Tanda tangan berhasil ditambahkan (Fisik + Digital)');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => 'Gagal menambahkan tanda tangan: ' . $e->getMessage()]);
        }
    }

    /**
     * Preview signed PDF in browser
     */
    public function previewSignedPDF(Document $document)
    {
        try {
            $signedPdfPath = $this->signatureService->applySignaturesToPDF($document);

            $file = file_get_contents($signedPdfPath);

            // Clean up temporary file
            unlink($signedPdfPath);

            return response($file, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="signed_' . basename($document->files) . '"',
            ]);
        } catch (\Exception $e) {
            return response('Error generating signed PDF: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate signed PDF with all signatures
     */
    public function generateSignedPDF(Document $document)
    {
        try {
            $signedPdfPath = $this->signatureService->applySignaturesToPDF($document);

            return Response::download($signedPdfPath, 'signed_' . basename($document->files))
                ->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate signed PDF: ' . $e->getMessage(),
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
                'message' => 'Failed to verify signature: ' . $e->getMessage(),
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
                'message' => 'Failed to update signature position: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Signature $signature)
    {
        if ($signature->userId !== Auth::id()) {
            return back()->withErrors([
                'error' => 'Unauthorized to delete this signature',
            ]);
        }

        try {
            if ($signature->signatureFile) {
                Storage::delete($signature->signatureFile);
            }

            $document = $signature->document;
            $signature->delete();

            // Check if this was the last signature for this document
            $remainingSignatures = Signature::where('documentId', $document->id)->count();

            if ($remainingSignatures === 0) {
                // Delete the signed file if no signatures remain
                if ($document->signed_file) {
                    Storage::delete('public/' . $document->signed_file);
                    $document->signed_file = null;
                    $document->save();
                }
            }

            return back()->with('success', 'Signature deleted successfully');
        } catch (\Exception $e) {
            return back()->withErrors([
                'error' => 'Failed to delete signature: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * Check if current user can sign the document
     */
    private function canUserSign(Document $document): bool
    {
        $user = Auth::user();

        // Only pimpinan can sign documents
        if (!$user->isPimpinan()) {
            return false;
        }

        // Check if user is the recipient (pimpinan who should sign)
        if ($document->to !== $user->id) {
            return false;
        }

        // Check if user already signed
        $existingSignature = $document->signatures()
            ->where('userId', $user->id)
            ->exists();

        return !$existingSignature;
    }

    /**
     * Verify document signature (public access)
     */
    public function verifyDocument(Document $document)
    {
        try {
            // Get all signatures for this document
            $signatures = $document->signatures()->with('user')->get();

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

            $verificationStatus = $signatures->count() > 0 ? 'signed' : 'unsigned';
            $isVerified = $verificationStatus === 'signed';

            return Inertia::render('Verification/Show', [
                'document' => $documentInfo,
                'signatures' => $signatureInfo,
                'verification_status' => $verificationStatus,
                'verified_at' => now()->toISOString(),
                'success' => $isVerified,
                'message' => $isVerified ? 'Dokumen berhasil diverifikasi' : 'Dokumen belum ditandatangani',
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
                'verification_status' => 'error',
                'verified_at' => now()->toISOString(),
                'success' => false,
                'message' => 'Gagal memverifikasi dokumen: ' . $e->getMessage(),
            ]);
        }
    }
}

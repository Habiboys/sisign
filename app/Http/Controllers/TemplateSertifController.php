<?php

namespace App\Http\Controllers;

use App\Models\TemplateSertif;
use App\Models\Signature;
use App\Models\Review;
use App\Services\SignatureService;
use App\Services\EncryptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class TemplateSertifController extends Controller
{
    protected SignatureService $signatureService;
    protected EncryptionService $encryptionService;

    public function __construct(
        SignatureService $signatureService,
        EncryptionService $encryptionService
    ) {
        $this->signatureService = $signatureService;
        $this->encryptionService = $encryptionService;
    }

    public function index()
    {
        $templates = TemplateSertif::with('review')
            ->latest('created_at')
            ->paginate(10);

        return Inertia::render('Templates/Index', [
            'templates' => $templates,
            'user' => Auth::user()
        ]);
    }

    public function create()
    {
        $user = Auth::user();

        // Pimpinan tidak bisa membuat template
        if ($user->isPimpinan()) {
            return redirect()->route('templates.index')
                ->with('error', 'Pimpinan hanya dapat menandatangani dokumen, tidak dapat membuat template.');
        }

        return Inertia::render('Templates/Create', [
            'user' => $user
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        // Pimpinan tidak bisa membuat template
        if ($user->isPimpinan()) {
            return redirect()->route('templates.index')
                ->with('error', 'Pimpinan hanya dapat menandatangani dokumen, tidak dapat membuat template.');
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240'
        ]);

        $file = $request->file('file');
        $filename = time() . '_' . $file->getClientOriginalName();
        $file->storeAs('templates', $filename, 'public');

        // Jika admin yang membuat, langsung disetujui
        $reviewStatus = $user->role === 'admin' ? 'approved' : 'pending';
        $disetujuiBy = $user->role === 'admin' ? Auth::id() : null;

        $review = Review::create([
            'status' => $reviewStatus,
            'disetujui' => $disetujuiBy,
            'komentar' => $user->role === 'admin' ? 'Template dibuat oleh admin, otomatis disetujui.' : null
        ]);

        TemplateSertif::create([
            'title' => $request->title,
            'description' => $request->description,
            'files' => $filename,
            'reviewId' => $review->id
        ]);

        $successMessage = $user->role === 'admin' ?
            'Template berhasil dibuat dan otomatis disetujui.' :
            'Template berhasil dibuat';

        return redirect()->route('templates.index')->with('success', $successMessage);
    }

    public function show(TemplateSertif $template)
    {
        $template->load(['review.disetujuiBy', 'sertifikats.certificateRecipients.user']);

        return Inertia::render('Templates/Show', [
            'template' => $template,
            'user' => Auth::user()
        ]);
    }

    public function sign(TemplateSertif $template)
    {
        $user = Auth::user();

        // Only pimpinan can access template sign page
        if ($user->role !== 'pimpinan') {
            abort(403, 'Hanya pimpinan yang dapat mengakses halaman tanda tangan template');
        }

        // Template must be approved
        if ($template->review->status !== 'approved') {
            return redirect()->route('templates.show', $template->id)
                ->with('error', 'Template harus disetujui terlebih dahulu sebelum dapat ditandatangani.');
        }

        $template->load(['review.disetujuiBy']);

        return Inertia::render('Templates/Sign', [
            'template' => $template,
            'user' => $user
        ]);
    }

    public function downloadSigned(TemplateSertif $template)
    {
        if (!$template->signed_template_path) {
            return redirect()->back()->with('error', 'Template yang sudah ditandatangani tidak ditemukan.');
        }

        $fullPath = storage_path('app/public/' . $template->signed_template_path);
        if (!file_exists($fullPath)) {
            return redirect()->back()->with('error', 'File template yang sudah ditandatangani tidak ditemukan.');
        }

        return response()->download($fullPath, 'signed_' . $template->files);
    }

    public function preview(TemplateSertif $template)
    {
        // Jika template sudah ditandatangani, gunakan file yang sudah ditandatangani
        if ($template->signed_template_path) {
            $templatePath = storage_path('app/public/' . $template->signed_template_path);
            $filename = 'signed_' . $template->files;
        } else {
            // Jika belum ditandatangani, gunakan file template asli
            $templatePath = storage_path('app/public/templates/' . $template->files);
            $filename = $template->files;
        }

        if (!file_exists($templatePath)) {
            abort(404, 'File template tidak ditemukan');
        }

        $file = file_get_contents($templatePath);

        return response($file, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"'
        ]);
    }

    public function verifyTemplate(TemplateSertif $template)
    {
        try {
            $template->load(['review.disetujuiBy']);

            // Get template info
            $templateInfo = [
                'id' => $template->id,
                'title' => $template->title,
                'description' => $template->description,
                'created_at' => $template->created_at,
                'review_status' => $template->review->status ?? 'pending',
                'is_signed' => !empty($template->signed_template_path),
                'signed_at' => $template->signed_template_path ?
                    filemtime(storage_path('app/public/' . $template->signed_template_path)) : null,
            ];

            // Get review info if available
            $reviewInfo = null;
            if ($template->review) {
                $reviewInfo = [
                    'status' => $template->review->status,
                    'approved_by' => $template->review->disetujuiBy->name ?? null,
                    'comments' => $template->review->komentar,
                    'reviewed_at' => $template->review->created_at,
                ];
            }

            return Inertia::render('Templates/Verify', [
                'success' => true,
                'template' => $templateInfo,
                'review' => $reviewInfo,
                'verification_time' => now(),
                'message' => 'Template verification successful'
            ]);
        } catch (\Exception $e) {
            return Inertia::render('Templates/Verify', [
                'success' => false,
                'template' => null,
                'review' => null,
                'verification_time' => now(),
                'message' => 'Template verification failed: ' . $e->getMessage()
            ]);
        }
    }

    public function removeSignature(TemplateSertif $template)
    {
        $user = Auth::user();

        // Only pimpinan can remove signature
        if ($user->role !== 'pimpinan') {
            return redirect()->back()->with('error', 'Hanya pimpinan yang dapat menghapus tanda tangan template.');
        }

        try {
            // Delete the signed template file if it exists
            if ($template->signed_template_path) {
                $fullPath = storage_path('app/public/' . $template->signed_template_path);
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                }
            }

            // Clear the signed template path from database
            $template->update(['signed_template_path' => null]);

            return redirect()->route('templates.show', $template->id)
                ->with('success', 'Tanda tangan template berhasil dihapus.');
        } catch (\Exception $e) {
            return redirect()->back()
                ->with('error', 'Gagal menghapus tanda tangan template: ' . $e->getMessage());
        }
    }

    public function review(Request $request, TemplateSertif $template)
    {
        $request->validate([
            'status' => 'required|in:approved,rejected',
            'komentar' => 'nullable|string'
        ]);

        $template->review->update([
            'status' => $request->status,
            'disetujui' => Auth::id(),
            'komentar' => $request->komentar
        ]);

        return redirect()->back()->with('success', 'Review berhasil disimpan');
    }

    public function destroy(TemplateSertif $template)
    {
        if (Storage::disk('public')->exists('templates/' . $template->files)) {
            Storage::disk('public')->delete('templates/' . $template->files);
        }

        $template->delete();

        return redirect()->route('templates.index')->with('success', 'Template berhasil dihapus');
    }
}

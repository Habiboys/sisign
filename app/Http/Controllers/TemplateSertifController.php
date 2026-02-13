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

    public function index(Request $request)
    {
        $query = TemplateSertif::with('review')
            ->latest('created_at');

        // Search filter
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Filter by Review Status
        if ($request->filled('review_status') && $request->review_status !== 'all') {
            $status = $request->review_status;
            $query->whereHas('review', function ($q) use ($status) {
                $q->where('status', $status);
            });
        }

        // Filter by Signed Status
        if ($request->filled('signed_status') && $request->signed_status !== 'all') {
            $status = $request->signed_status;
            if ($status === 'signed') {
                $query->whereNotNull('signed_template_path');
            } elseif ($status === 'unsigned') {
                $query->whereNull('signed_template_path')
                      ->whereDoesntHave('signers', function ($q) {
                          $q->where('is_signed', true);
                      });
            } elseif ($status === 'partial') {
                 $query->whereNull('signed_template_path')
                       ->whereHas('signers', function ($q) {
                           $q->where('is_signed', true);
                       });
            }
        }

        // Pagination
        $perPage = $request->input('per_page', 10);
        if ($perPage === 'all') {
            $templates = $query->paginate(9999);
        } else {
            $templates = $query->paginate((int) $perPage);
        }

        return Inertia::render('Templates/Index', [
            'templates' => $templates,
            'user' => Auth::user(),
            'search' => $request->search ?? '',
            'review_status' => $request->review_status ?? 'all',
            'signed_status' => $request->signed_status ?? 'all',
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

        $users = \App\Models\User::where('role', 'pimpinan')->get();

        return Inertia::render('Templates/Create', [
            'user' => $user,
            'users' => $users
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
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240',
            'signers' => 'required|array|min:1',
            'signers.*' => 'exists:users,id'
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

        $template = TemplateSertif::create([
            'title' => $request->title,
            'description' => $request->description,
            'files' => $filename,
            'reviewId' => $review->id
        ]);

        // Create signers
        foreach ($request->signers as $index => $signerId) {
            \App\Models\TemplateSigner::create([
                'template_id' => $template->id,
                'user_id' => $signerId,
                'sign_order' => $index + 1,
                'is_signed' => false
            ]);
        }

        $successMessage = $user->role === 'admin' ?
            'Template berhasil dibuat dan otomatis disetujui.' :
            'Template berhasil dibuat';

        return redirect()->route('templates.index')->with('success', $successMessage);
    }

    public function show(TemplateSertif $template)
    {
        $template->load(['review.disetujuiBy', 'sertifikats.certificateRecipients.user', 'signers.user']);

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

        // Check if user is a designated signer
        $isSigner = $template->signers()
            ->where('user_id', $user->id)
            ->exists();

        if (!$isSigner) {
            return redirect()->route('templates.show', $template->id)
                ->with('error', 'Anda tidak terdaftar sebagai penanda tangan untuk template ini.');
        }

        // Check if user already signed
        $hasSigned = $template->signers()
            ->where('user_id', $user->id)
            ->where('is_signed', true)
            ->exists();

        if ($hasSigned) {
             return redirect()->route('templates.show', $template->id)
                ->with('error', 'Anda sudah menandatangani template ini.');
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
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
            'Accept-Ranges' => 'none', // Try to discourage IDM
        ]);
    }

    public function viewSignedPDF(TemplateSertif $template)
    {
        if (!$template->signed_template_path) {
            abort(404, 'Template yang sudah ditandatangani tidak ditemukan');
        }

        $filePath = $template->signed_template_path;
        $fullPath = storage_path('app/public/' . $filePath);

        if (!file_exists($fullPath)) {
            abort(404, 'File template tidak ditemukan');
        }

        $file = file_get_contents($fullPath);

        return response($file, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . basename($filePath) . '"',
            'Access-Control-Allow-Origin' => '*',
            'Accept-Ranges' => 'none', // Try to discourage IDM
        ]);
    }

    public function verifyTemplate(TemplateSertif $template)
    {
        try {
            $template->load(['review.disetujuiBy', 'signers.user']);

            // Get signers info
            $signers = $template->signers->map(function ($signer) {
                return [
                    'name' => $signer->user->name,
                    'role' => $signer->user->role, // Assuming role is relevant
                    'is_signed' => $signer->is_signed,
                    'order' => $signer->sign_order
                ];
            });

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
                'signers' => $signers
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
            // Find the signer record for this user
            $signer = $template->signers()->where('user_id', $user->id)->first();
            
            if (!$signer || !$signer->is_signed) {
                return redirect()->back()->with('error', 'Anda belum menandatangani template ini.');
            }

            // Remove physical signature record
            Signature::where('templateSertifId', $template->id)
                ->where('userId', $user->id)
                ->delete();

            // Update signer status
            $signer->update(['is_signed' => false]);

            // Reconstruct the signed PDF from original + remaining signatures
            $this->signatureService->reconstructSignedTemplate($template);

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

    public function mapVariables(TemplateSertif $template)
    {
        // Template harus sudah ditandatangani oleh SEMUA penanda tangan
        if (!$template->isCompleted()) {
            return redirect()->route('templates.show', $template->id)
                ->with('error', 'Template harus ditandatangani oleh semua pihak terlebih dahulu sebelum dapat mapping variabel.');
        }

        if ($template->review->status !== 'approved') {
            return redirect()->route('templates.show', $template->id)
                ->with('error', 'Template harus disetujui terlebih dahulu.');
        }

        return Inertia::render('Templates/MapVariables', [
            'template' => $template,
            'user' => Auth::user()
        ]);
    }

    public function saveVariablePositions(Request $request, TemplateSertif $template)
    {
        // Template harus sudah ditandatangani oleh SEMUA penanda tangan
        if (!$template->isCompleted()) {
            return back()->with('error', 'Template harus ditandatangani oleh semua pihak terlebih dahulu.');
        }

        $request->validate([
            'variable_positions' => 'required|array',
            'variable_positions.*.name' => 'required|string|max:255',
            'variable_positions.*.x' => 'required|numeric',
            'variable_positions.*.y' => 'required|numeric',
            'variable_positions.*.x_pct' => 'nullable|numeric|between:0,1',
            'variable_positions.*.y_pct' => 'nullable|numeric|between:0,1',
            'variable_positions.*.fontSize' => 'nullable|numeric|min:8|max:72',
            'variable_positions.*.fontFamily' => 'nullable|string|max:50',
            'variable_positions.*.alignment' => 'nullable|in:L,C,R',
        ]);

        $template->update([
            'variable_positions' => $request->variable_positions
        ]);

        // Refresh template untuk memastikan data ter-update
        $template->refresh();

        // Return success response (Inertia akan handle ini sebagai success)
        return back()->with('success', 'Posisi variabel berhasil disimpan.');
    }
}

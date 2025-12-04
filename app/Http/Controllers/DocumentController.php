<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $query = Document::with(['user', 'toUser', 'review', 'signatures.user', 'signers']);

        if ($user->isAdmin()) {
            $documents = $query->latest('created_at')->paginate(10);
        } elseif ($user->isPimpinan()) {
            // Show documents where user is a signer
            $documents = $query->whereHas('signers', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })->latest('created_at')->paginate(10);
        } else {
            $documents = $query->where('userId', $user->id)->latest('created_at')->paginate(10);
        }
        // dd(Document::with('toUser')->first()->toUser);
        //         $documents = \App\Models\Document::with('toUser', 'user')->get();
        // dd($documents->toArray());



        // Transform documents data to ensure proper serialization
        $documents->getCollection()->transform(function ($document) {
            return [
                'id' => $document->id,
                'title' => $document->title,
                'files' => $document->files,
                'signed_file' => $document->signed_file,
                'number' => $document->number,
                'to' => $document->to,
                'created_at' => $document->created_at,
                'updated_at' => $document->updated_at,
                'user' => $document->user->toArray(),
                'toUser' => $document->toUser ? $document->toUser->toArray() : null,
                'review' => $document->review->toArray(),
                'signatures' => $document->signatures->map(function ($signature) {
                    return [
                        'id' => $signature->id,
                        'type' => $signature->type,
                        'signedAt' => $signature->signedAt,
                        'user' => $signature->user ? $signature->user->toArray() : null,
                    ];
                })->toArray(),
                'signers' => $document->signers->map(function ($signer) {
                    return [
                        'id' => $signer->id,
                        'user_id' => $signer->user_id,
                        'is_signed' => $signer->is_signed,
                        'sign_order' => $signer->sign_order,
                    ];
                })->toArray(),
            ];
        });

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'user' => $user
        ]);
    }

    public function create()
    {
        $user = Auth::user();

        // Pimpinan tidak bisa mengajukan dokumen
        if ($user->isPimpinan()) {
            return redirect()->route('documents.index')
                ->with('error', 'Pimpinan hanya dapat menandatangani dokumen, tidak dapat mengajukan dokumen.');
        }

        if ($user->isAdmin()) {
            $users = User::where('role', 'pimpinan')->get();
        } else {
            $users = User::where('role', 'pimpinan')->get();
        }

        return Inertia::render('Documents/Create', [
            'users' => $users,
            'user' => $user
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        // Pimpinan tidak bisa mengajukan dokumen
        if ($user->isPimpinan()) {
            return redirect()->route('documents.index')
                ->with('error', 'Pimpinan hanya dapat menandatangani dokumen, tidak dapat mengajukan dokumen.');
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240',
            'to' => 'required|array|min:1',
            'to.*' => 'exists:users,id',
            'number' => 'required|string|max:100'
        ]);

        $file = $request->file('file');
        $filename = time() . '_' . $file->getClientOriginalName();
        $file->storeAs('documents', $filename, 'public');

        // Jika admin yang membuat, langsung disetujui
        $reviewStatus = $user->isAdmin() ? 'approved' : 'pending';
        $disetujuiBy = $user->isAdmin() ? Auth::id() : null;

        $review = Review::create([
            'status' => $reviewStatus,
            'disetujui' => $disetujuiBy,
            'komentar' => $user->isAdmin() ? 'Dokumen dibuat oleh admin, otomatis disetujui.' : null
        ]);

        $document = Document::create([
            'userId' => Auth::id(),
            'title' => $request->title,
            'files' => $filename,
            'number' => $request->number,
            'to' => $request->to[0], // Keep first signer as primary 'to' for backward compatibility
            'reviewId' => $review->id,
        ]);

        // Create signers
        foreach ($request->to as $index => $signerId) {
            \App\Models\DocumentSigner::create([
                'document_id' => $document->id,
                'user_id' => $signerId,
                'sign_order' => $index + 1,
                'is_signed' => false
            ]);
        }

        $successMessage = $user->isAdmin() ?
            'Dokumen berhasil dibuat dan otomatis disetujui.' :
            'Dokumen berhasil diajukan';

        return redirect()->route('documents.index')->with('success', $successMessage);
    }

    public function show(Document $document)
    {
        $document->load(['user', 'toUser', 'review', 'signatures.user', 'signers.user']);

        return Inertia::render('Documents/Show', [
            'document' => $document,
            'user' => Auth::user()
        ]);
    }

    public function review(Request $request, Document $document)
    {
        $request->validate([
            'status' => 'required|in:approved,rejected',
            'komentar' => 'nullable|string'
        ]);

        $document->review->update([
            'status' => $request->status,
            'disetujui' => Auth::id(),
            'komentar' => $request->komentar
        ]);

        return redirect()->back()->with('success', 'Review berhasil disimpan');
    }

    public function destroy(Document $document)
    {
        if (Storage::disk('public')->exists('documents/' . $document->files)) {
            Storage::disk('public')->delete('documents/' . $document->files);
        }

        $document->delete();

        return redirect()->route('documents.index')->with('success', 'Dokumen berhasil dihapus');
    }

    public function viewPDF(Document $document)
    {
        $filePath = 'documents/' . $document->files;

        if (!Storage::disk('public')->exists($filePath)) {
            abort(404, 'File not found');
        }

        $file = Storage::disk('public')->get($filePath);
        $mimeType = Storage::disk('public')->mimeType($filePath);

        return response($file, 200, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline',
            'Access-Control-Allow-Origin' => '*',
            'Accept-Ranges' => 'none', // Try to discourage IDM
        ]);
    }
}

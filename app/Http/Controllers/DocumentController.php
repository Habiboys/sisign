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
        $query = Document::with(['user', 'toUser', 'review']);

        if ($user->isAdmin()) {
            $documents = $query->latest('created_at')->paginate(10);
        } elseif ($user->isPimpinan()) {
            $documents = $query->where('to', $user->id)->latest('created_at')->paginate(10);
        } else {
            $documents = $query->where('userId', $user->id)->latest('created_at')->paginate(10);
        }
        // dd(Document::with('toUser')->first()->toUser);
//         $documents = \App\Models\Document::with('toUser', 'user')->get();
// dd($documents->toArray());

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'user' => $user
        ]);
    }

    public function create()
    {
        $user = Auth::user();

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
        $request->validate([
            'title' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240',
            'to' => 'required|exists:users,id',
            'number' => 'required|string|max:100'
        ]);

        $file = $request->file('file');
        $filename = time() . '_' . $file->getClientOriginalName();
        $file->storeAs('documents', $filename, 'public');

        $review = Review::create([
            'status' => 'pending'
        ]);

        Document::create([
            'userId' => Auth::id(),
            'title' => $request->title,
            'files' => $filename,
            'number' => $request->number,
            'to' => $request->to,
            'reviewId' => $review->id,
        ]);

        return redirect()->route('documents.index')->with('success', 'Dokumen berhasil diajukan');
    }

    public function show(Document $document)
    {
        $document->load(['user', 'toUser', 'review', 'signatures.user']);

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
}

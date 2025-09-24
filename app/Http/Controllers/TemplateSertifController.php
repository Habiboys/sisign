<?php

namespace App\Http\Controllers;

use App\Models\TemplateSertif;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class TemplateSertifController extends Controller
{
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
        return Inertia::render('Templates/Create', [
            'user' => Auth::user()
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'file' => 'required|file|mimes:pdf,doc,docx|max:10240'
        ]);

        $file = $request->file('file');
        $filename = time() . '_' . $file->getClientOriginalName();
        $file->storeAs('templates', $filename, 'public');

        $review = Review::create([
            'status' => 'pending'
        ]);

        TemplateSertif::create([
            'title' => $request->title,
            'description' => $request->description,
            'files' => $filename,
            'reviewId' => $review->id
        ]);

        return redirect()->route('templates.index')->with('success', 'Template berhasil dibuat');
    }

    public function show(TemplateSertif $template)
    {
        $template->load(['review.disetujui', 'sertifikats.certificateRecipients.user']);

        return Inertia::render('Templates/Show', [
            'template' => $template,
            'user' => Auth::user()
        ]);
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

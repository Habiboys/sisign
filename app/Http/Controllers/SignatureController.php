<?php

namespace App\Http\Controllers;

use App\Models\Signature;
use App\Models\Document;
use App\Models\TemplateSertif;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class SignatureController extends Controller
{
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
            $document = Document::findOrFail($documentId);
            return Inertia::render('Signatures/Create', [
                'document' => $document,
                'type' => 'document',
                'user' => Auth::user()
            ]);
        }

        if ($templateId) {
            $template = TemplateSertif::findOrFail($templateId);
            return Inertia::render('Signatures/Create', [
                'template' => $template,
                'type' => 'template',
                'user' => Auth::user()
            ]);
        }

        abort(404);
    }

    public function store(Request $request)
    {
        $request->validate([
            'type' => 'required|in:physical,digital',
            'signature_type' => 'required|in:document,template',
            'signature_data' => 'required_if:type,digital|string',
            'signature_hash' => 'required_if:type,digital|string',
            'document_id' => 'required_if:signature_type,document|uuid|exists:document,id',
            'template_id' => 'required_if:signature_type,template|uuid|exists:template_sertif,id',
        ]);

        $signatureData = [
            'userId' => Auth::id(),
            'type' => $request->type,
            'signedAt' => now(),
            'isUnique' => true
        ];

        if ($request->signature_type === 'document') {
            $signatureData['documentId'] = $request->document_id;
        } else {
            $signatureData['templateSertifId'] = $request->template_id;
        }

        if ($request->type === 'digital') {
            $signatureData['signatureData'] = $request->signature_data;
            $signatureData['signatureHash'] = $request->signature_hash;

            // Generate unique hash for this signature
            $uniqueHash = hash('sha256', $signatureData['signatureData'] . $signatureData['userId'] . now());
            $signatureData['signatureHash'] = $uniqueHash;
        }

        Signature::create($signatureData);

        if ($request->signature_type === 'document') {
            return redirect()->route('documents.show', $request->document_id)->with('success', 'Tanda tangan berhasil ditambahkan');
        } else {
            return redirect()->route('templates.show', $request->template_id)->with('success', 'Tanda tangan berhasil ditambahkan');
        }
    }

    public function show(Signature $signature)
    {
        $signature->load(['document', 'user']);

        return Inertia::render('Signatures/Show', [
            'signature' => $signature,
            'user' => Auth::user()
        ]);
    }

    public function destroy(Signature $signature)
    {
        if ($signature->signatureFile && Storage::disk('public')->exists('signatures/' . $signature->signatureFile)) {
            Storage::disk('public')->delete('signatures/' . $signature->signatureFile);
        }

        $signature->delete();

        return redirect()->back()->with('success', 'Tanda tangan berhasil dihapus');
    }
}

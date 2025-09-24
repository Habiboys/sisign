<?php

namespace App\Http\Controllers;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\CertificateRecipient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class SertifikatController extends Controller
{
    public function index()
    {
        $sertifikats = Sertifikat::with(['templateSertif', 'certificateRecipients.user'])
            ->latest('created_at')
            ->paginate(10);

        return Inertia::render('Certificates/Index', [
            'sertifikats' => $sertifikats,
            'user' => Auth::user()
        ]);
    }

    public function create()
    {
        $templates = TemplateSertif::whereHas('review', function ($query) {
            $query->where('status', 'approved');
        })->get();

        return Inertia::render('Certificates/Create', [
            'templates' => $templates,
            'user' => Auth::user()
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'templateSertifId' => 'required|exists:template_sertif,id',
            'nomor_sertif' => 'required|string|max:100|unique:sertifikat,nomor_sertif',
            'recipients' => 'required|array|min:1',
            'recipients.*.userId' => 'required|exists:users,id',
            'recipients.*.issuedAt' => 'required|date'
        ]);

        $sertifikat = Sertifikat::create([
            'templateSertifId' => $request->templateSertifId,
            'nomor_sertif' => $request->nomor_sertif
        ]);

        foreach ($request->recipients as $recipient) {
            CertificateRecipient::create([
                'sertifikatId' => $sertifikat->id,
                'userId' => $recipient['userId'],
                'issuedAt' => $recipient['issuedAt']
            ]);
        }

        return redirect()->route('certificates.index')->with('success', 'Sertifikat berhasil dibuat');
    }

    public function bulkCreate()
    {
        $templates = TemplateSertif::whereHas('review', function ($query) {
            $query->where('status', 'approved');
        })->get();

        return Inertia::render('Certificates/BulkCreate', [
            'templates' => $templates,
            'user' => Auth::user()
        ]);
    }

    public function bulkStore(Request $request)
    {
        $request->validate([
            'templateSertifId' => 'required|exists:template_sertif,id',
            'excel_file' => 'required|file|mimes:csv,xlsx,xls|max:10240'
        ]);

        $file = $request->file('excel_file');

        // Baca file Excel menggunakan maatwebsite/excel
        $rows = Excel::toArray([], $file);
        $rows = $rows[0]; // Ambil sheet pertama

        $errors = [];
        $success = 0;

        foreach ($rows as $index => $row) {
            if ($index === 0) continue; // Skip header

            $nomorSertif = $row[0] ?? null;
            $userEmail = $row[1] ?? null;
            $issuedAt = $row[2] ?? now()->format('Y-m-d');

            if (!$nomorSertif || !$userEmail) {
                $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat dan email wajib diisi";
                continue;
            }

            $user = User::where('email', $userEmail)->first();
            if (!$user) {
                $errors[] = "Baris " . ($index + 1) . ": User dengan email $userEmail tidak ditemukan";
                continue;
            }

            if (Sertifikat::where('nomor_sertif', $nomorSertif)->exists()) {
                $errors[] = "Baris " . ($index + 1) . ": Nomor sertifikat $nomorSertif sudah ada";
                continue;
            }

            try {
                $sertifikat = Sertifikat::create([
                    'templateSertifId' => $request->templateSertifId,
                    'nomor_sertif' => $nomorSertif
                ]);

                CertificateRecipient::create([
                    'sertifikatId' => $sertifikat->id,
                    'userId' => $user->id,
                    'issuedAt' => $issuedAt
                ]);

                $success++;
            } catch (\Exception $e) {
                $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
            }
        }

        $message = "Berhasil membuat $success sertifikat";
        if (!empty($errors)) {
            $message .= ". Error: " . implode(', ', $errors);
        }

        return redirect()->route('certificates.index')->with('success', $message);
    }

    public function show(Sertifikat $sertifikat)
    {
        $sertifikat->load(['templateSertif', 'certificateRecipients.user']);

        return Inertia::render('Certificates/Show', [
            'sertifikat' => $sertifikat,
            'user' => Auth::user()
        ]);
    }

    public function destroy(Sertifikat $sertifikat)
    {
        $sertifikat->delete();
        return redirect()->route('certificates.index')->with('success', 'Sertifikat berhasil dihapus');
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\CertificateRecipient;
use App\Models\User;
use App\Services\CertificateService;
use App\Services\ExcelTemplateService;
use App\Services\EmailService;
use App\Services\SignatureService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use ZipArchive;

class SertifikatController extends Controller
{
    protected CertificateService $certificateService;
    protected ExcelTemplateService $excelTemplateService;
    protected EmailService $emailService;
    protected SignatureService $signatureService;

    public function __construct(
        CertificateService $certificateService,
        ExcelTemplateService $excelTemplateService,
        EmailService $emailService,
        SignatureService $signatureService
    ) {
        $this->certificateService = $certificateService;
        $this->excelTemplateService = $excelTemplateService;
        $this->emailService = $emailService;
        $this->signatureService = $signatureService;
    }
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
        })->whereNotNull('signed_template_path')->get();

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
        Log::info('BulkCreate method called', [
            'user_id' => Auth::id(),
            'user_role' => Auth::user()->role ?? 'no_role'
        ]);

        $templates = TemplateSertif::whereHas('review', function ($query) {
            $query->where('status', 'approved');
        })->whereNotNull('signed_template_path')->get();

        Log::info('Templates found for bulk create', [
            'count' => $templates->count(),
            'template_ids' => $templates->pluck('id')->toArray(),
            'signed_paths' => $templates->pluck('signed_template_path')->toArray(),
        ]);

        Log::info('Attempting to render BulkCreate view');

        try {
            $result = Inertia::render('Certificates/BulkCreate', [
                'templates' => $templates,
                'user' => Auth::user()
            ]);

            Log::info('BulkCreate view rendered successfully');
            return $result;
        } catch (\Exception $e) {
            Log::error('Failed to render BulkCreate view', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    public function bulkStore(Request $request)
    {
        $request->validate([
            'templateSertifId' => 'required|exists:template_sertif,id',
            'excel_file' => 'required|file|mimes:csv,xlsx,xls|max:10240'
        ]);

        $file = $request->file('excel_file');

        // Baca file Excel menggunakan maatwebsite/excel
        $rows = Excel::toArray(new \stdClass(), $file);
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

    public function signTemplate(Request $request, TemplateSertif $template)
    {
        $request->validate([
            'signatureData' => 'required|string',
            'passphrase' => 'nullable|string',
            'signedPdfBase64' => 'nullable|string',
            'position' => 'nullable|array',
        ]);

        try {
            $user = Auth::user();

            Log::info('Template signing attempt', [
                'template_id' => $template->id,
                'user_id' => $user->id,
                'user_role' => $user->role,
                'has_signed_pdf' => $request->has('signedPdfBase64'),
                'has_position' => $request->has('position'),
                'position_data' => $request->position,
            ]);

            // Only pimpinan can sign templates
            if ($user->role !== 'pimpinan') {
                return redirect()->back()
                    ->with('error', 'Hanya pimpinan yang dapat menandatangani template.');
            }

            // If we have signedPdfBase64, that means the signature was created with canvas
            if ($request->has('signedPdfBase64') && $request->signedPdfBase64) {
                Log::info('Creating physical signature record...');

                try {
                    // Create physical signature record in database
                    $physicalSignature = $this->signatureService->createPhysicalSignature([
                        'templateSertifId' => $template->id,
                        'userId' => Auth::id(),
                        'signatureData' => $request->signatureData,
                        'position' => $request->position,
                    ]);

                    Log::info('Physical signature created', ['id' => $physicalSignature->id]);
                } catch (\Exception $e) {
                    Log::error('Failed to create physical signature', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    throw $e;
                }

                // Create digital signature record for verification (always create like document)
                Log::info('Creating digital signature record...');

                try {
                    $digitalSignature = $this->signatureService->createDigitalSignature([
                        'templateSertifId' => $template->id,
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

                    Log::info('Digital signature created', ['id' => $digitalSignature->id]);
                } catch (\Exception $e) {
                    Log::error('Failed to create digital signature', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    throw $e;
                }

                // Save the signed PDF file using SignatureService like document
                Log::info('Attempting to save signed PDF template', [
                    'template_id' => $template->id,
                    'data_length' => strlen($request->signedPdfBase64)
                ]);

                try {
                    $this->signatureService->saveSignedPDFTemplate($template, $request->signedPdfBase64);
                    Log::info('Signed PDF template saved successfully');
                } catch (\Exception $e) {
                    Log::error('Failed to save signed PDF template', [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                    throw $e;
                }

                Log::info('Template signed successfully', [
                    'template_id' => $template->id,
                ]);

                return redirect()->route('templates.show', $template->id)
                    ->with('success', 'Template berhasil ditandatangani!');
            } else {
                // Fallback to old method if no PDF provided
                $signedPath = $this->certificateService->signTemplate(
                    $template,
                    $user,
                    $request->only(['signatureData'])
                );

                return redirect()->route('templates.show', $template->id)
                    ->with('success', 'Template berhasil ditandatangani!');
            }
        } catch (\Exception $e) {
            Log::error('Template signing failed', [
                'template_id' => $template->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->with('error', 'Gagal menandatangani template: ' . $e->getMessage());
        }
    }

    public function generateBulkCertificates(Request $request)
    {
        $request->validate([
            'templateSertifId' => 'required|exists:template_sertif,id',
            'recipients' => 'required|array|min:1',
            'recipients.*.userId' => 'required|exists:users,id',
            'recipients.*.nomor_sertif' => 'required|string|unique:sertifikat,nomor_sertif',
            'recipients.*.issuedAt' => 'nullable|date'
        ]);

        try {
            $result = $this->certificateService->generateBulkCertificates($request->all());

            $message = "Berhasil generate {$result['success_count']} sertifikat";
            if (!empty($result['errors'])) {
                $message .= ". Error: " . implode(', ', $result['errors']);
            }

            return redirect()->route('certificates.index')->with('success', $message);
        } catch (\Exception $e) {
            return redirect()->route('certificates.bulk.create')
                ->with('error', 'Gagal generate sertifikat: ' . $e->getMessage());
        }
    }

    public function downloadCertificate(Sertifikat $sertifikat)
    {
        try {
            $certificatePath = $this->certificateService->downloadCertificate($sertifikat);

            return response()->download($certificatePath, 'Sertifikat_' . $sertifikat->nomor_sertif . '.pdf')
                ->deleteFileAfterSend(false);
        } catch (\Exception $e) {
            return redirect()->route('certificates.index')
                ->with('error', 'Gagal download sertifikat: ' . $e->getMessage());
        }
    }

    public function downloadBulkCertificates(Request $request)
    {
        $request->validate([
            'sertifikat_ids' => 'required|array|min:1',
            'sertifikat_ids.*' => 'exists:sertifikat,id'
        ]);

        try {
            $zipPath = $this->certificateService->downloadBulkCertificates($request->sertifikat_ids);

            return response()->download($zipPath, 'Sertifikat_Bulk_' . date('Y-m-d_H-i-s') . '.zip')
                ->deleteFileAfterSend(true);
        } catch (\Exception $e) {
            return redirect()->route('certificates.index')
                ->with('error', 'Gagal download sertifikat bulk: ' . $e->getMessage());
        }
    }

    public function checkTemplateSigned(TemplateSertif $template)
    {
        $isSigned = $this->certificateService->isTemplateSigned($template);

        return response()->json([
            'is_signed' => $isSigned,
            'template' => $template
        ]);
    }

    public function downloadExcelTemplate(TemplateSertif $template)
    {
        try {
            return $this->excelTemplateService->downloadTemplateExcel($template);
        } catch (\Exception $e) {
            return redirect()->route('certificates.bulk.create')
                ->with('error', 'Gagal download template Excel: ' . $e->getMessage());
        }
    }

    public function generateBulkFromExcel(Request $request)
    {
        Log::info('generateBulkFromExcel method called', [
            'user_id' => Auth::id(),
            'request_data' => $request->except(['excel_file']),
            'has_file' => $request->hasFile('excel_file')
        ]);

        $request->validate([
            'templateSertifId' => 'required|exists:template_sertif,id',
            'excel_file' => 'required|file|mimes:xlsx,xls|max:10240'
        ]);

        Log::info('Validation passed, processing file');

        try {
            $file = $request->file('excel_file');
            $rows = Excel::toArray(new \stdClass(), $file);
            $rows = $rows[0];

            Log::info('Excel data parsed', ['total_rows' => count($rows)]);

            $excelData = [];
            foreach ($rows as $index => $row) {
                if ($index === 0) {
                    Log::info('Header row', ['header' => $row]);
                    continue; // Skip header
                }

                Log::info('Processing data row', ['index' => $index, 'raw_row' => $row]);

                $excelData[] = [
                    'nomor_sertif' => $row[0] ?? null,
                    'email' => $row[1] ?? null,
                    'issued_at' => $row[2] ?? now()->format('Y-m-d'),
                    'nama_lengkap' => $row[3] ?? null,
                    'jabatan' => $row[4] ?? null,
                    'departemen' => $row[5] ?? null,
                ];
            }

            Log::info('Final excel data for processing', ['excelData' => $excelData]);

            $result = $this->certificateService->generateBulkCertificatesFromExcel([
                'templateSertifId' => $request->templateSertifId,
                'excelData' => $excelData
            ]);

            $message = "Berhasil generate {$result['success_count']} sertifikat";
            if (!empty($result['errors'])) {
                $message .= ". Error: " . implode(', ', $result['errors']);
            }

            return redirect()->route('certificates.index')->with('success', $message);
        } catch (\Exception $e) {
            return redirect()->route('certificates.bulk.create')
                ->with('error', 'Gagal generate sertifikat: ' . $e->getMessage());
        }
    }

    public function sendCertificateEmails(Request $request)
    {
        $request->validate([
            'sertifikat_ids' => 'required|array|min:1',
            'sertifikat_ids.*' => 'exists:sertifikat,id'
        ]);

        try {
            $certificates = [];
            foreach ($request->sertifikat_ids as $sertifikatId) {
                $sertifikat = Sertifikat::with(['templateSertif', 'certificateRecipients.user'])->findOrFail($sertifikatId);
                $certificatePath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');

                if (file_exists($certificatePath)) {
                    foreach ($sertifikat->certificateRecipients as $recipient) {
                        $certificates[] = [
                            'sertifikat' => $sertifikat,
                            'recipient' => $recipient->user,
                            'pdf_path' => $certificatePath,
                            'email' => $recipient->user->email
                        ];
                    }
                }
            }

            $result = $this->emailService->sendBulkCertificateEmails($certificates);

            $message = "Email berhasil dikirim ke {$result['sent']} penerima";
            if ($result['failed'] > 0) {
                $message .= ". Gagal mengirim ke {$result['failed']} penerima";
            }

            return redirect()->route('certificates.index')->with('success', $message);
        } catch (\Exception $e) {
            return redirect()->route('certificates.index')
                ->with('error', 'Gagal mengirim email: ' . $e->getMessage());
        }
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

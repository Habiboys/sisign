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
        $sertifikats = Sertifikat::with([
            'templateSertif' => function ($query) {
                $query->withTrashed(); // Include soft deleted templates
            },
            'certificateRecipients.user'
        ])
            ->latest('created_at')
            ->paginate(10);

        // Log untuk debugging
        Log::info('Sertifikat index - Raw query result', [
            'total_count' => $sertifikats->total(),
            'data_count' => $sertifikats->count(),
            'current_page' => $sertifikats->currentPage(),
            'has_data' => $sertifikats->count() > 0
        ]);

        if ($sertifikats->count() > 0) {
            $first = $sertifikats->first();
            Log::info('Sertifikat index - First item details', [
                'id' => $first->id,
                'nomor_sertif' => $first->nomor_sertif,
                'file_path' => $first->file_path,
                'templateSertifId' => $first->templateSertifId,
                'has_templateSertif' => $first->templateSertif !== null,
                'templateSertif_title' => $first->templateSertif?->title,
                'certificateRecipients_count' => $first->certificateRecipients?->count() ?? 0
            ]);
        }

        // Ensure data is properly serialized
        $sertifikats->getCollection()->transform(function ($sertifikat) {
            // Get email from sertifikat or from first recipient if available
            $email = $sertifikat->email;
            if (!$email && $sertifikat->certificateRecipients && $sertifikat->certificateRecipients->count() > 0) {
                $firstRecipient = $sertifikat->certificateRecipients->first();
                $email = $firstRecipient->user->email ?? null;
            }

            return [
                'id' => $sertifikat->id,
                'nomor_sertif' => $sertifikat->nomor_sertif,
                'email' => $email,
                'file_path' => $sertifikat->file_path,
                'created_at' => $sertifikat->created_at,
                'email_sent_at' => $sertifikat->email_sent_at,
                'email_sent_status' => $sertifikat->email_sent_status ?? 'pending',
                'email_sent_error' => $sertifikat->email_sent_error,
                'templateSertif' => $sertifikat->templateSertif ? [
                    'id' => $sertifikat->templateSertif->id,
                    'title' => $sertifikat->templateSertif->title,
                ] : null,
                'certificateRecipients' => $sertifikat->certificateRecipients ? $sertifikat->certificateRecipients->map(function ($recipient) {
                    return [
                        'id' => $recipient->id,
                        'user' => $recipient->user ? [
                            'id' => $recipient->user->id,
                            'name' => $recipient->user->name,
                            'email' => $recipient->user->email,
                        ] : null,
                    ];
                }) : null,
            ];
        });

        return Inertia::render('Certificates/Index', [
            'sertifikats' => $sertifikats,
            'user' => Auth::user()
        ]);
    }

    // Method create dan store dihapus karena menggunakan bulk generation

    public function bulkCreate()
    {
        Log::info('BulkCreate method called', [
            'user_id' => Auth::id(),
            'user_role' => Auth::user()->role ?? 'no_role'
        ]);

        $templates = TemplateSertif::whereHas('review', function ($query) {
            $query->where('status', 'approved');
        })
            ->whereNotNull('signed_template_path')
            ->with('review')
            ->get()
            ->map(function ($template) {
                return [
                    'id' => $template->id,
                    'title' => $template->title,
                    'description' => $template->description,
                    'signed_template_path' => $template->signed_template_path,
                    'variable_positions' => $template->variable_positions,
                    'has_variables_mapped' => !empty($template->variable_positions),
                ];
            });

        Log::info('Templates found for bulk create', [
            'count' => $templates->count(),
            'template_ids' => $templates->pluck('id')->toArray(),
            'signed_paths' => $templates->pluck('signed_template_path')->toArray(),
        ]);

        Log::info('Attempting to render BulkCreate view');

        try {
            $result = Inertia::render('Certificates/BulkCreateWizard', [
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

    public function downloadCertificate(Request $request, $certificate)
    {
        try {
            // Handle both UUID string and model binding
            if ($certificate instanceof Sertifikat) {
                $sertifikat = $certificate;
            } else {
                // Find by ID (UUID)
                $sertifikat = Sertifikat::findOrFail($certificate);
            }

            $certificatePath = $this->certificateService->downloadCertificate($sertifikat);

            return response()->download($certificatePath, 'Sertifikat_' . ($sertifikat->nomor_sertif ?? 'certificate') . '.pdf')
                ->deleteFileAfterSend(false);
        } catch (\Exception $e) {
            return redirect()->route('certificates.index')
                ->with('error', 'Gagal download sertifikat: ' . $e->getMessage());
        }
    }

    public function viewCertificate(Request $request, $certificate)
    {
        try {
            // Handle both UUID string and model binding
            if ($certificate instanceof Sertifikat) {
                $sertifikat = $certificate;
            } else {
                // Find by ID (UUID)
                $sertifikat = Sertifikat::findOrFail($certificate);
            }

            $certificatePath = $this->certificateService->downloadCertificate($sertifikat);

            if (!file_exists($certificatePath)) {
                abort(404, 'File sertifikat tidak ditemukan');
            }

            $file = file_get_contents($certificatePath);

            return response($file, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'inline; filename="Sertifikat_' . ($sertifikat->nomor_sertif ?? 'certificate') . '.pdf"',
                'Access-Control-Allow-Origin' => '*',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to view certificate', [
                'certificate_id' => is_string($certificate) ? $certificate : ($certificate->id ?? 'unknown'),
                'error' => $e->getMessage()
            ]);
            abort(404, 'Gagal memuat sertifikat: ' . $e->getMessage());
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
            // Refresh template untuk memastikan variable_positions ter-update
            $template->refresh();

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
            'has_file' => $request->hasFile('excel_file'),
            'templateSertifId' => $request->templateSertifId,
            'excel_file_name' => $request->file('excel_file') ? $request->file('excel_file')->getClientOriginalName() : 'no_file'
        ]);

        try {
            $request->validate([
                'templateSertifId' => 'required|exists:template_sertif,id',
                'excel_file' => 'required|file|mimes:xlsx,xls|max:10240',
                'passphrase' => 'required|string'
            ]);

            Log::info('Validation passed successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed', [
                'errors' => $e->errors(),
                'request_data' => $request->except(['excel_file'])
            ]);
            throw $e;
        }

        Log::info('Validation passed, processing file');

        try {
            $file = $request->file('excel_file');
            $rows = Excel::toArray(new \stdClass(), $file);
            $rows = $rows[0];

            Log::info('Excel data parsed', ['total_rows' => count($rows)]);

            // Get template to check variable positions
            $template = \App\Models\TemplateSertif::findOrFail($request->templateSertifId);
            $variablePositions = $template->variable_positions ?? [];

            $excelData = [];
            foreach ($rows as $index => $row) {
                if ($index === 0) {
                    Log::info('Header row', ['header' => $row]);
                    continue; // Skip header
                }

                Log::info('Processing data row', ['index' => $index, 'raw_row' => $row]);

                // Parse Excel row as simple array (column order matches variable positions)
                // Excel row is already an array, just use it directly
                $excelData[] = $row;
            }

            Log::info('Final excel data for processing', ['excelData' => $excelData]);

            $result = $this->certificateService->generateBulkCertificatesFromExcel([
                'templateSertifId' => $request->templateSertifId,
                'excelData' => $excelData,
                'passphrase' => $request->passphrase
            ]);

            $message = "Berhasil generate {$result['success_count']} sertifikat";
            if (!empty($result['errors'])) {
                $message .= ". Error: " . implode(', ', $result['errors']);
            }

            Log::info('Certificate generation completed successfully', [
                'success_count' => $result['success_count'],
                'error_count' => count($result['errors']),
                'message' => $message
            ]);

            return redirect()->route('certificates.index')->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Failed to generate certificates from Excel', [
                'user_id' => Auth::id(),
                'template_id' => $request->templateSertifId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->route('certificates.bulk.create')
                ->with('error', 'Gagal generate sertifikat: ' . $e->getMessage());
        }
    }

    public function sendCertificateEmails(Request $request)
    {
        $request->validate([
            'sertifikat_ids' => 'required|array|min:1',
            'sertifikat_ids.*' => 'exists:sertifikat,id',
            'template_id' => 'nullable|exists:template_sertif,id', // Optional: filter by template
        ]);

        try {
            $certificates = [];
            $sertifikatIds = $request->sertifikat_ids;

            // Jika template_id diberikan, filter sertifikat berdasarkan template
            $query = Sertifikat::with(['templateSertif', 'certificateRecipients.user'])
                ->whereIn('id', $sertifikatIds);

            if ($request->template_id) {
                $query->where('templateSertifId', $request->template_id);
            }

            $sertifikats = $query->get();

            foreach ($sertifikats as $sertifikat) {
                // Gunakan email dari sertifikat langsung (untuk bulk generation)
                if ($sertifikat->email) {
                    $certificatePath = null;
                    if ($sertifikat->file_path) {
                        $certificatePath = storage_path('app/' . ltrim($sertifikat->file_path, '/'));
                    } else {
                        // Fallback ke path lama
                        $certificatePath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');
                    }

                    if (file_exists($certificatePath)) {
                        $certificates[] = [
                            'sertifikat' => $sertifikat,
                            'recipient' => null, // Akan di-handle oleh EmailService
                            'pdf_path' => $certificatePath,
                            'email' => $sertifikat->email
                        ];
                    }
                } else {
                    // Fallback ke certificateRecipients (untuk sertifikat lama)
                    foreach ($sertifikat->certificateRecipients as $recipient) {
                        $certificatePath = null;
                        if ($sertifikat->file_path) {
                            $certificatePath = storage_path('app/' . ltrim($sertifikat->file_path, '/'));
                        } else {
                            $certificatePath = storage_path('app/certificates/' . $sertifikat->id . '.pdf');
                        }

                        if (file_exists($certificatePath)) {
                            $certificates[] = [
                                'sertifikat' => $sertifikat,
                                'recipient' => $recipient->user,
                                'pdf_path' => $certificatePath,
                                'email' => $recipient->user->email
                            ];
                        }
                    }
                }
            }

            if (empty($certificates)) {
                return redirect()->route('certificates.index')
                    ->with('error', 'Tidak ada sertifikat yang dapat dikirim. Pastikan file PDF tersedia dan email sudah diisi.');
            }

            $result = $this->emailService->sendBulkCertificateEmails($certificates);

            $message = "Email berhasil dikirim ke {$result['sent']} penerima";
            if ($result['failed'] > 0) {
                $message .= ". Gagal mengirim ke {$result['failed']} penerima";
                if (!empty($result['errors'])) {
                    Log::warning('Email sending errors', ['errors' => $result['errors']]);
                }
            }

            return redirect()->route('certificates.index')->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Failed to send certificate emails', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->route('certificates.index')
                ->with('error', 'Gagal mengirim email: ' . $e->getMessage());
        }
    }

    public function show(Request $request, $certificate)
    {
        // Handle both UUID string and model binding
        if ($certificate instanceof Sertifikat) {
            $sertifikat = $certificate;
        } else {
            // Find by ID (UUID)
            $sertifikat = Sertifikat::findOrFail($certificate);
        }

        $sertifikat->load([
            'templateSertif' => function ($query) {
                $query->withTrashed(); // Include soft deleted templates
            },
            'certificateRecipients.user'
        ]);

        // Log untuk debugging
        Log::info('Sertifikat show - Details', [
            'id' => $sertifikat->id,
            'nomor_sertif' => $sertifikat->nomor_sertif,
            'email' => $sertifikat->email,
            'file_path' => $sertifikat->file_path,
            'templateSertifId' => $sertifikat->templateSertifId,
            'has_templateSertif' => $sertifikat->templateSertif !== null,
            'templateSertif_title' => $sertifikat->templateSertif?->title,
            'created_at' => $sertifikat->created_at,
            'raw_certificate_param' => $certificate,
            'certificate_type' => gettype($certificate),
        ]);

        // Get email from sertifikat or from first recipient if available
        $email = $sertifikat->email;
        if (!$email && $sertifikat->certificateRecipients && $sertifikat->certificateRecipients->count() > 0) {
            $firstRecipient = $sertifikat->certificateRecipients->first();
            $email = $firstRecipient->user->email ?? null;
        }

        // Ensure data is properly serialized - use toArray() to ensure all fields are included
        $sertifikatArray = $sertifikat->toArray();

        // Override with explicit values to ensure they're included
        $sertifikatData = [
            'id' => (string) $sertifikat->id,
            'nomor_sertif' => $sertifikat->nomor_sertif ?? null,
            'email' => $email,
            'file_path' => $sertifikat->file_path,
            'created_at' => $sertifikat->created_at ? $sertifikat->created_at->toISOString() : null,
            'templateSertif' => $sertifikat->templateSertif ? [
                'id' => (string) $sertifikat->templateSertif->id,
                'title' => $sertifikat->templateSertif->title,
            ] : null,
            'certificateRecipients' => $sertifikat->certificateRecipients ? $sertifikat->certificateRecipients->map(function ($recipient) {
                return [
                    'id' => (string) $recipient->id,
                    'issuedAt' => $recipient->issuedAt ? $recipient->issuedAt->toISOString() : null,
                    'user' => $recipient->user ? [
                        'id' => (string) $recipient->user->id,
                        'name' => $recipient->user->name,
                        'email' => $recipient->user->email,
                    ] : null,
                ];
            })->toArray() : null,
        ];

        // Log final data untuk debugging
        Log::info('Sertifikat show - Final serialized data', [
            'sertifikatData' => $sertifikatData,
            'has_id' => isset($sertifikatData['id']),
            'has_file_path' => isset($sertifikatData['file_path']),
            'has_template' => isset($sertifikatData['templateSertif']),
        ]);

        return Inertia::render('Certificates/Show', [
            'sertifikat' => $sertifikatData,
            'user' => Auth::user()
        ]);
    }

    public function destroy(Request $request, $certificate)
    {
        try {
            // Handle both UUID string and model binding
            if ($certificate instanceof Sertifikat) {
                $sertifikat = $certificate;
            } else {
                // Find by ID (UUID)
                $sertifikat = Sertifikat::findOrFail($certificate);
            }

            // Load relasi sebelum delete
            $sertifikat->load('certificateRecipients');

            // Simpan data penting sebelum delete
            $certificateId = $sertifikat->id;
            $nomorSertif = $sertifikat->nomor_sertif;

            // Get file path sebelum delete
            // file_path disimpan sebagai relative path dari storage/app/
            // Contoh: "certificates/certificate_SERT-0023_1763149859.pdf"
            $filePath = null;
            if ($sertifikat->file_path) {
                // Pastikan path sudah benar (relative dari storage/app/)
                $filePath = storage_path('app/' . ltrim($sertifikat->file_path, '/'));
            } else {
                // Fallback ke path lama (untuk sertifikat lama yang belum punya file_path)
                $filePath = storage_path('app/certificates/' . $certificateId . '.pdf');
            }

            // Hapus relasi certificateRecipients terlebih dahulu (jika ada)
            if ($sertifikat->certificateRecipients) {
                $recipientCount = $sertifikat->certificateRecipients->count();
                $sertifikat->certificateRecipients()->delete();
                Log::info('Certificate recipients deleted', [
                    'certificate_id' => $certificateId,
                    'recipient_count' => $recipientCount
                ]);
            }

            // Hapus sertifikat dari database (soft delete)
            $sertifikat->delete();

            // Hapus file PDF jika ada
            if ($filePath && file_exists($filePath)) {
                @unlink($filePath);
                Log::info('Certificate PDF file deleted', [
                    'file_path' => $filePath,
                    'certificate_id' => $certificateId,
                    'nomor_sertif' => $nomorSertif
                ]);
            }

            Log::info('Certificate deleted successfully', [
                'certificate_id' => $certificateId,
                'nomor_sertif' => $nomorSertif
            ]);

            return redirect()->route('certificates.index')
                ->with('success', 'Sertifikat ' . ($nomorSertif ?? '') . ' berhasil dihapus');
        } catch (\Exception $e) {
            Log::error('Failed to delete certificate', [
                'certificate_id' => is_string($certificate) ? $certificate : ($certificate->id ?? 'unknown'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->route('certificates.index')
                ->with('error', 'Gagal menghapus sertifikat: ' . $e->getMessage());
        }
    }

    public function verifyCertificate(Request $request, $certificate)
    {
        try {
            // Handle both UUID string and model-bound Sertifikat instances
            if ($certificate instanceof Sertifikat) {
                $sertifikat = $certificate;
            } else {
                // Try to find by nomor_sertif first (from URL parameter)
                $sertifikat = Sertifikat::where('nomor_sertif', $certificate)->first();

                // If not found by nomor_sertif, try by UUID
                if (!$sertifikat) {
                    $sertifikat = Sertifikat::find($certificate);
                }
            }

            if (!$sertifikat) {
                Log::warning('Certificate not found for verification', [
                    'certificate_param' => $certificate
                ]);

                return Inertia::render('Verification/Certificate', [
                    'certificate' => null,
                    'success' => false,
                    'message' => 'Sertifikat tidak ditemukan. Pastikan nomor sertifikat benar.'
                ]);
            }

            $sertifikat->load([
                'templateSertif' => function ($query) {
                    $query->withTrashed(); // Include soft deleted templates
                },
                'certificateRecipients.user'
            ]);

            // Get email from sertifikat or certificateRecipients
            $email = $sertifikat->email;
            if (!$email && $sertifikat->certificateRecipients && $sertifikat->certificateRecipients->count() > 0) {
                $firstRecipient = $sertifikat->certificateRecipients->first();
                $email = $firstRecipient->user->email ?? null;
            }

            // Build recipients list
            $recipients = [];
            if ($sertifikat->certificateRecipients && $sertifikat->certificateRecipients->count() > 0) {
                $recipients = $sertifikat->certificateRecipients->map(function ($recipient) {
                    return [
                        'name' => $recipient->user->name ?? 'Unknown',
                        'email' => $recipient->user->email ?? null,
                        'issued_at' => $recipient->issuedAt ? $recipient->issuedAt->format('d/m/Y H:i:s') : null,
                    ];
                })->toArray();
            } else if ($email) {
                // If no certificateRecipients but email exists, create a recipient entry
                $recipients = [[
                    'name' => 'Penerima Sertifikat',
                    'email' => $email,
                    'issued_at' => $sertifikat->created_at ? $sertifikat->created_at->format('d/m/Y H:i:s') : null,
                ]];
            }

            $verificationData = [
                'certificate_id' => (string) $sertifikat->id,
                'certificate_number' => $sertifikat->nomor_sertif ?? 'N/A',
                'template_title' => $sertifikat->templateSertif->title ?? 'Unknown Template',
                'issued_at' => $sertifikat->created_at ? $sertifikat->created_at->format('d/m/Y H:i:s') : 'N/A',
                'recipients' => $recipients,
                'verification_status' => 'valid',
                'verified_at' => now()->format('d/m/Y H:i:s'),
                'verification_hash' => hash('sha256', $sertifikat->id . ($sertifikat->nomor_sertif ?? '') . ($sertifikat->created_at ? $sertifikat->created_at->toISOString() : ''))
            ];

            Log::info('Certificate verified successfully', [
                'certificate_id' => $sertifikat->id,
                'certificate_number' => $sertifikat->nomor_sertif
            ]);

            return Inertia::render('Verification/Certificate', [
                'certificate' => $verificationData,
                'success' => true,
                'message' => 'Sertifikat berhasil diverifikasi'
            ]);
        } catch (\Exception $e) {
            Log::error('Certificate verification failed', [
                'certificate_param' => is_string($certificate) ? $certificate : ($certificate->id ?? 'unknown'),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return Inertia::render('Verification/Certificate', [
                'certificate' => null,
                'success' => false,
                'message' => 'Gagal memverifikasi sertifikat: ' . $e->getMessage()
            ]);
        }
    }
}

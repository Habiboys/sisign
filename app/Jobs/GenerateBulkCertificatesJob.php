<?php

namespace App\Jobs;

use App\Models\Sertifikat;
use App\Models\TemplateSertif;
use App\Models\User;
use App\Services\CertificateService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateBulkCertificatesJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $template;
    protected $row;
    protected $userId;
    protected $passphrase;

    /**
     * Create a new job instance.
     */
    public function __construct(TemplateSertif $template, array $row, string|int $userId, ?string $passphrase = null)
    {
        $this->template = $template;
        $this->row = $row;
        $this->userId = $userId;
        $this->passphrase = $passphrase;
    }

    /**
     * Execute the job.
     */
    public function handle(CertificateService $certificateService): void
    {
        if ($this->batch()->cancelled()) {
            return;
        }

        try {
            // Re-use the logic from CertificateService but for a single row
            // We need to expose a method in CertificateService to handle a single row from Excel
            // For now, I will implement the logic here calling a new method in service
            
            $certificateService->processSingleExcelRow($this->template, $this->row, $this->passphrase);
            
        } catch (\Exception $e) {
            Log::error('Failed to generate certificate in job', [
                'template_id' => $this->template->id,
                'row' => $this->row,
                'error' => $e->getMessage()
            ]);
            
            // Fail the job so it shows up in failed jobs
            $this->fail($e);
        }
    }
}

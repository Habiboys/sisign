<?php

namespace App\Jobs;

use App\Models\Sertifikat;
use App\Mail\CertificateMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendCertificateEmailsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 300;

    protected $certificateIds;
    protected $userId;

    /**
     * Create a new job instance.
     */
    public function __construct(array $certificateIds, $userId)
    {
        $this->certificateIds = $certificateIds;
        $this->userId = $userId;
        $this->onQueue('emails');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('SendCertificateEmailsJob started', [
            'user_id' => $this->userId,
            'certificate_count' => count($this->certificateIds)
        ]);

        $successCount = 0;
        $failedCount = 0;

        foreach ($this->certificateIds as $certId) {
            try {
                $certificate = Sertifikat::find($certId);
                
                if (!$certificate) {
                    Log::warning('Certificate not found', ['id' => $certId]);
                    $failedCount++;
                    continue;
                }

                if (!$certificate->email) {
                    Log::warning('Certificate has no email', ['id' => $certId]);
                    $failedCount++;
                    continue;
                }

                // Mark as pending before sending
                $certificate->update([
                    'email_sent_status' => 'pending'
                ]);

                // Send email
                Mail::to($certificate->email)->send(new CertificateMail($certificate));
                
                // Update status on success
                $certificate->update([
                    'email_sent_at' => now(),
                    'email_sent_status' => 'sent',
                    'email_sent_error' => null
                ]);

                $successCount++;
                
                Log::info('Email sent successfully', [
                    'certificate_id' => $certId,
                    'email' => $certificate->email
                ]);

            } catch (\Exception $e) {
                $failedCount++;
                
                Log::error('Failed to send certificate email', [
                    'certificate_id' => $certId,
                    'error' => $e->getMessage()
                ]);

                // Update status on failure
                if (isset($certificate)) {
                    $certificate->update([
                        'email_sent_status' => 'failed',
                        'email_sent_error' => $e->getMessage()
                    ]);
                }
            }
        }

        Log::info('SendCertificateEmailsJob completed', [
            'user_id' => $this->userId,
            'total' => count($this->certificateIds),
            'success' => $successCount,
            'failed' => $failedCount
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('SendCertificateEmailsJob failed completely', [
            'user_id' => $this->userId,
            'certificate_count' => count($this->certificateIds),
            'error' => $exception->getMessage()
        ]);
    }
}

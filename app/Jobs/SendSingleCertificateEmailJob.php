<?php

namespace App\Jobs;

use App\Mail\CertificateEmail;
use App\Models\Sertifikat;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendSingleCertificateEmailJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 120;

    protected $certificateId;
    protected $userId;

    /**
     * Create a new job instance.
     */
    public function __construct(string $certificateId, $userId)
    {
        $this->certificateId = $certificateId;
        $this->userId = $userId;
        $this->onQueue('emails');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Check if batch has been cancelled
        if ($this->batch()->cancelled()) {
            return;
        }

        try {
            $certificate = Sertifikat::with('templateSertif')->find($this->certificateId);
            
            if (!$certificate) {
                Log::warning('Certificate not found for email', ['id' => $this->certificateId]);
                return;
            }

            if (!$certificate->email) {
                Log::warning('Certificate has no email', ['id' => $this->certificateId]);
                return;
            }

            // Mark as pending before sending
            $certificate->update([
                'email_sent_status' => 'pending'
            ]);

            // Get certificate file path
            $certificatePath = null;
            if ($certificate->file_path) {
                $certificatePath = storage_path('app/' . ltrim($certificate->file_path, '/'));
            } else {
                $certificatePath = storage_path('app/certificates/' . $certificate->id . '.pdf');
            }

            if (!file_exists($certificatePath)) {
                throw new \Exception('Certificate PDF file not found: ' . $certificatePath);
            }

            // Send email with all required parameters
            Mail::to($certificate->email)->send(new CertificateEmail(
                $certificate,
                null, // recipient (User object, optional)
                $certificate->templateSertif,
                $certificatePath
            ));
            
            // Update status on success
            $certificate->update([
                'email_sent_at' => now(),
                'email_sent_status' => 'sent',
                'email_sent_error' => null
            ]);

            Log::info('Email sent successfully', [
                'certificate_id' => $this->certificateId,
                'email' => $certificate->email
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send certificate email', [
                'certificate_id' => $this->certificateId,
                'error' => $e->getMessage()
            ]);

            // Update status on failure
            if (isset($certificate)) {
                $certificate->update([
                    'email_sent_status' => 'failed',
                    'email_sent_error' => $e->getMessage()
                ]);
            }

            // Re-throw exception to mark job as failed
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('SendSingleCertificateEmailJob failed', [
            'user_id' => $this->userId,
            'certificate_id' => $this->certificateId,
            'error' => $exception->getMessage()
        ]);

        // Mark certificate as failed if exists
        $certificate = Sertifikat::find($this->certificateId);
        if ($certificate) {
            $certificate->update([
                'email_sent_status' => 'failed',
                'email_sent_error' => $exception->getMessage()
            ]);
        }
    }
}

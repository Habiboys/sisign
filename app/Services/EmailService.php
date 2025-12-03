<?php

namespace App\Services;

use App\Models\Sertifikat;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Mail\Mailable;

class EmailService
{
    public function sendCertificateEmail(Sertifikat $sertifikat, ?User $recipient = null, ?string $certificatePath = null): bool
    {
        try {
            // Jika recipient tidak diberikan, gunakan email dari sertifikat
            if (!$recipient && $sertifikat->email) {
                // Cari user berdasarkan email
                $recipient = User::where('email', $sertifikat->email)->first();
            }

            // Jika masih tidak ada recipient, gunakan email langsung dari sertifikat
            $emailTo = $recipient ? $recipient->email : $sertifikat->email;

            if (!$emailTo) {
                throw new \Exception('Email penerima tidak ditemukan');
            }

            $template = $sertifikat->templateSertif;

            // Jika certificatePath tidak diberikan, gunakan file_path dari sertifikat
            if (!$certificatePath && $sertifikat->file_path) {
                $certificatePath = storage_path('app/' . ltrim($sertifikat->file_path, '/'));
            }

            if (!$certificatePath || !file_exists($certificatePath)) {
                throw new \Exception('File sertifikat tidak ditemukan: ' . ($certificatePath ?? 'N/A'));
            }

            // Update status menjadi pending sebelum kirim
            $sertifikat->update([
                'email_sent_status' => 'pending',
                'email_sent_error' => null
            ]);

            Mail::to($emailTo)->send(new CertificateEmail(
                $sertifikat,
                $recipient,
                $template,
                $certificatePath
            ));

            // Update status menjadi sent setelah berhasil
            $sertifikat->update([
                'email_sent_at' => now(),
                'email_sent_status' => 'sent',
                'email_sent_error' => null
            ]);

            Log::info('Certificate email sent successfully', [
                'sertifikat_id' => $sertifikat->id,
                'nomor_sertif' => $sertifikat->nomor_sertif,
                'email' => $emailTo
            ]);

            return true;
        } catch (\Exception $e) {
            // Update status menjadi failed
            $sertifikat->update([
                'email_sent_status' => 'failed',
                'email_sent_error' => $e->getMessage()
            ]);

            Log::error('Failed to send certificate email', [
                'sertifikat_id' => $sertifikat->id,
                'nomor_sertif' => $sertifikat->nomor_sertif,
                'error' => $e->getMessage()
            ]);

            return false;
        }
    }

    public function sendBulkCertificateEmails(array $certificates): array
    {
        $results = [
            'sent' => 0,
            'failed' => 0,
            'errors' => []
        ];

        foreach ($certificates as $certificate) {
            try {
                $sertifikat = $certificate['sertifikat'] ?? null;
                $recipient = $certificate['recipient'] ?? null;
                $pdfPath = $certificate['pdf_path'] ?? null;

                if (!$sertifikat) {
                    $results['failed']++;
                    $results['errors'][] = "Sertifikat tidak ditemukan";
                    continue;
                }

                $success = $this->sendCertificateEmail(
                    $sertifikat,
                    $recipient,
                    $pdfPath
                );

                if ($success) {
                    $results['sent']++;
                } else {
                    $results['failed']++;
                    $email = $recipient ? $recipient->email : ($sertifikat->email ?? 'N/A');
                    $results['errors'][] = "Gagal mengirim ke {$email}";
                }
            } catch (\Exception $e) {
                $results['failed']++;
                $email = $certificate['email'] ?? ($certificate['sertifikat']->email ?? 'N/A');
                $results['errors'][] = "Error sending to {$email}: " . $e->getMessage();
            }
        }

        return $results;
    }
}

class CertificateEmail extends Mailable
{
    public Sertifikat $sertifikat;
    public ?User $recipient;
    public $template;
    public string $certificatePath;
    public string $recipientName;
    public string $recipientEmail;

    public function __construct(Sertifikat $sertifikat, ?User $recipient, $template, string $certificatePath)
    {
        $this->sertifikat = $sertifikat;
        $this->recipient = $recipient;
        $this->template = $template;
        $this->certificatePath = $certificatePath;

        // Set recipient name and email
        if ($recipient) {
            $this->recipientName = $recipient->name;
            $this->recipientEmail = $recipient->email;
        } else {
            // Use email from sertifikat and try to extract name
            $this->recipientEmail = $sertifikat->email ?? 'Penerima';
            $this->recipientName = 'Penerima Sertifikat'; // Default name
        }
    }

    public function build()
    {
        return $this->subject('Sertifikat Digital - ' . ($this->template->title ?? 'Sertifikat'))
            ->view('emails.certificate')
            ->with([
                'sertifikat' => $this->sertifikat,
                'recipient' => $this->recipient,
                'recipientName' => $this->recipientName,
                'recipientEmail' => $this->recipientEmail,
                'template' => $this->template
            ])
            ->attach($this->certificatePath, [
                'as' => 'Sertifikat_' . $this->sertifikat->nomor_sertif . '.pdf',
                'mime' => 'application/pdf'
            ]);
    }
}

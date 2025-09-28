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
    public function sendCertificateEmail(Sertifikat $sertifikat, User $recipient, string $certificatePath): bool
    {
        try {
            $template = $sertifikat->templateSertif;

            Mail::to($recipient->email)->send(new CertificateEmail(
                $sertifikat,
                $recipient,
                $template,
                $certificatePath
            ));

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to send certificate email: ' . $e->getMessage());
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
                $success = $this->sendCertificateEmail(
                    $certificate['sertifikat'],
                    $certificate['recipient'],
                    $certificate['pdf_path']
                );

                if ($success) {
                    $results['sent']++;
                } else {
                    $results['failed']++;
                    $results['errors'][] = "Failed to send to {$certificate['email']}";
                }
            } catch (\Exception $e) {
                $results['failed']++;
                $results['errors'][] = "Error sending to {$certificate['email']}: " . $e->getMessage();
            }
        }

        return $results;
    }
}

class CertificateEmail extends Mailable
{
    public Sertifikat $sertifikat;
    public User $recipient;
    public $template;
    public string $certificatePath;

    public function __construct(Sertifikat $sertifikat, User $recipient, $template, string $certificatePath)
    {
        $this->sertifikat = $sertifikat;
        $this->recipient = $recipient;
        $this->template = $template;
        $this->certificatePath = $certificatePath;
    }

    public function build()
    {
        return $this->subject('Sertifikat Digital - ' . $this->template->title)
            ->view('emails.certificate')
            ->with([
                'sertifikat' => $this->sertifikat,
                'recipient' => $this->recipient,
                'template' => $this->template
            ])
            ->attach($this->certificatePath, [
                'as' => 'Sertifikat_' . $this->sertifikat->nomor_sertif . '.pdf',
                'mime' => 'application/pdf'
            ]);
    }
}

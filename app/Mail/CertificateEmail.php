<?php

namespace App\Mail;

use App\Models\Sertifikat;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CertificateEmail extends Mailable
{
    use Queueable, SerializesModels;

    public Sertifikat $sertifikat;
    public ?User $recipient;
    public $template;
    public string $certificatePath;
    public string $recipientName;
    public string $recipientEmail;

    /**
     * Create a new message instance.
     */
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

    /**
     * Build the message.
     */
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
